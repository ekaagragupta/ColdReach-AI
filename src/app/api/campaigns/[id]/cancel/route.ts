import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cancelCampaignExecution } from '@/lib/campaign-queue';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;

    // Abort running in-memory worker
    cancelCampaignExecution(campaignId);

    // Update remaining pending or sending recipients to CANCELLED
    const updateResult = await db.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: { in: ['PENDING', 'SENDING'] },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    await db.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'CANCELLED',
        pendingCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Campaign cancelled. ${updateResult.count} unsent recipient(s) were cancelled.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
