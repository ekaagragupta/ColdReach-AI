import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeCampaign, isCampaignActive } from '@/lib/campaign-queue';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        googleAccount: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (!campaign.googleAccount) {
      // Try to re-link to any active connected Google account
      const activeAccount = await db.googleAccount.findFirst({
        orderBy: { connectedAt: 'desc' },
      });

      if (!activeAccount) {
        return NextResponse.json(
          { error: 'No connected Gmail account found. Please connect your Gmail account in Settings first.' },
          { status: 400 }
        );
      }

      await db.campaign.update({
        where: { id: campaignId },
        data: { googleAccountId: activeAccount.id },
      });
    }

    if (isCampaignActive(campaignId)) {
      return NextResponse.json({ message: 'Campaign is already running.' });
    }

    // Check if there are any pending recipients
    const pendingCount = await db.campaignRecipient.count({
      where: { campaignId, status: 'PENDING' },
    });

    if (pendingCount === 0) {
      return NextResponse.json(
        { error: 'No pending recipients left to send in this campaign.' },
        { status: 400 }
      );
    }

    // Launch execution in background
    executeCampaign(campaignId).catch((err) => {
      console.error(`Error in executeCampaign for ${campaignId}:`, err);
    });

    return NextResponse.json({
      success: true,
      message: 'Campaign sending started.',
      pendingCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
