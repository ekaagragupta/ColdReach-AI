import { db } from './db';
import { getAuthorizedClient } from './google-auth';
import { sendEmailViaGmail } from './gmail-sender';

// In-memory registry of running campaigns and their abort controllers
const runningCampaigns = new Map<string, { abortController: AbortController }>();

export function isCampaignActive(campaignId: string): boolean {
  return runningCampaigns.has(campaignId);
}

export function cancelCampaignExecution(campaignId: string): boolean {
  const job = runningCampaigns.get(campaignId);
  if (job) {
    job.abortController.abort();
    runningCampaigns.delete(campaignId);
    return true;
  }
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a campaign in the background.
 */
export async function executeCampaign(campaignId: string): Promise<void> {
  if (runningCampaigns.has(campaignId)) {
    console.log(`Campaign ${campaignId} is already running.`);
    return;
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  if (campaign.recipients.length === 0) {
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return;
  }

  const abortController = new AbortController();
  runningCampaigns.set(campaignId, { abortController });

  // Update campaign status to SENDING
  await db.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'SENDING',
      startedAt: campaign.startedAt || new Date(),
    },
  });

  // Start asynchronous processing (non-blocking)
  (async () => {
    try {
      const { client: authClient, accessToken, email: fromEmail, name: fromName } =
        await getAuthorizedClient(campaign.googleAccountId || undefined);

      const delayMs = Math.max(1, campaign.sendIntervalSec || 3) * 1000;

      for (let i = 0; i < campaign.recipients.length; i++) {
        if (abortController.signal.aborted) {
          console.log(`Campaign ${campaignId} was aborted.`);
          break;
        }

        const recipient = campaign.recipients[i];

        // Mark recipient as SENDING
        await db.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'SENDING' },
        });

        let sendResult = await sendEmailViaGmail({
          authClient,
          accessToken,
          fromEmail,
          fromName,
          toEmail: recipient.email,
          subject: campaign.subject,
          bodyText: campaign.bodyText,
          bodyHtml: campaign.bodyHtml || undefined,
          attachmentPath: campaign.attachmentPath,
          attachmentFilename: campaign.attachmentFilename,
        });

        // Retry logic for transient failures (with backoff)
        if (!sendResult.success && sendResult.isTransient) {
          const backoffDelays = [2000, 4000];
          for (let attempt = 0; attempt < backoffDelays.length; attempt++) {
            if (abortController.signal.aborted) break;
            console.log(`Retrying send for ${recipient.email} in ${backoffDelays[attempt]}ms...`);
            await sleep(backoffDelays[attempt]);

            sendResult = await sendEmailViaGmail({
              authClient,
              accessToken,
              fromEmail,
              fromName,
              toEmail: recipient.email,
              subject: campaign.subject,
              bodyText: campaign.bodyText,
              bodyHtml: campaign.bodyHtml || undefined,
              attachmentPath: campaign.attachmentPath,
              attachmentFilename: campaign.attachmentFilename,
            });

            if (sendResult.success || !sendResult.isTransient) break;
          }
        }

        if (sendResult.success) {
          await db.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'SENT',
              gmailMessageId: sendResult.messageId,
              gmailThreadId: sendResult.threadId,
              sentAt: new Date(),
              errorMessage: null,
            },
          });

          await db.campaign.update({
            where: { id: campaignId },
            data: {
              sentCount: { increment: 1 },
              pendingCount: { decrement: 1 },
            },
          });
        } else {
          await db.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              errorMessage: sendResult.error || 'Failed to send email',
            },
          });

          await db.campaign.update({
            where: { id: campaignId },
            data: {
              failedCount: { increment: 1 },
              pendingCount: { decrement: 1 },
            },
          });

          // If daily quota reached, stop sending remaining emails immediately
          if (sendResult.isQuotaError) {
            console.warn(`Campaign ${campaignId} halted: Gmail quota exceeded.`);
            await db.campaign.update({
              where: { id: campaignId },
              data: { status: 'PAUSED' },
            });
            break;
          }
        }

        // Delay between recipients to respect Google limits
        if (i < campaign.recipients.length - 1 && !abortController.signal.aborted) {
          await sleep(delayMs);
        }
      }

      // Final status reconciliation
      const finalCounts = await db.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: { status: true },
      });

      const countsMap = Object.fromEntries(
        finalCounts.map((c) => [c.status, c._count.status])
      );

      const pending = countsMap['PENDING'] || 0;
      const sent = countsMap['SENT'] || 0;
      const failed = countsMap['FAILED'] || 0;

      let finalStatus = 'COMPLETED';
      if (abortController.signal.aborted) {
        finalStatus = 'CANCELLED';
        // Mark any remaining SENDING or PENDING as CANCELLED
        await db.campaignRecipient.updateMany({
          where: { campaignId, status: { in: ['PENDING', 'SENDING'] } },
          data: { status: 'CANCELLED' },
        });
      } else if (pending > 0) {
        finalStatus = 'PAUSED';
      }

      await db.campaign.update({
        where: { id: campaignId },
        data: {
          status: finalStatus,
          completedAt: finalStatus === 'COMPLETED' ? new Date() : null,
          sentCount: sent,
          failedCount: failed,
          pendingCount: finalStatus === 'CANCELLED' ? 0 : pending,
        },
      });
    } catch (err: any) {
      console.error(`Fatal error in campaign ${campaignId} execution:`, err);
      await db.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
        },
      });
    } finally {
      runningCampaigns.delete(campaignId);
    }
  })();
}
