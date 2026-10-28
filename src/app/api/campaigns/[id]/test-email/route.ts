import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthorizedClient } from '@/lib/google-auth';
import { sendEmailViaGmail } from '@/lib/gmail-sender';
import { isValidEmail } from '@/lib/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail || !isValidEmail(testEmail)) {
      return NextResponse.json(
        { error: 'Please provide a valid recipient email address for the test.' },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { client: authClient, accessToken, email: fromEmail, name: fromName } =
      await getAuthorizedClient(campaign.googleAccountId || undefined);

    const result = await sendEmailViaGmail({
      authClient,
      accessToken,
      fromEmail,
      fromName,
      toEmail: testEmail.trim().toLowerCase(),
      subject: `[TEST] ${campaign.subject}`,
      bodyText: campaign.bodyText,
      bodyHtml: campaign.bodyHtml || undefined,
      attachmentPath: campaign.attachmentPath,
      attachmentFilename: campaign.attachmentFilename,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}!`,
        messageId: result.messageId,
      });
    }

    return NextResponse.json(
      { error: result.error || 'Failed to send test email via Gmail' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Test email error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
