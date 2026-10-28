import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deletePdfAttachment } from '@/lib/pdf';
import { isCampaignActive } from '@/lib/campaign-queue';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status') || 'ALL';
    const searchQuery = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        googleAccount: {
          select: { email: true, name: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Build recipient where clause
    const whereClause: any = { campaignId };
    if (statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    }
    if (searchQuery.trim()) {
      whereClause.OR = [
        { email: { contains: searchQuery.trim() } },
        { name: { contains: searchQuery.trim() } },
        { company: { contains: searchQuery.trim() } },
        { position: { contains: searchQuery.trim() } },
      ];
    }

    const [recipients, totalMatching] = await Promise.all([
      db.campaignRecipient.findMany({
        where: whereClause,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.campaignRecipient.count({ where: whereClause }),
    ]);

    // Calculate real-time counts
    const statusCounts = await db.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { status: true },
    });

    const counts: Record<string, number> = {
      TOTAL: campaign.totalRecipients,
      PENDING: 0,
      SENDING: 0,
      SENT: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    statusCounts.forEach((sc) => {
      counts[sc.status] = sc._count.status;
    });

    const isRunning = isCampaignActive(campaignId);
    const progressPercent =
      campaign.totalRecipients > 0
        ? Math.round(((counts.SENT + counts.FAILED) / campaign.totalRecipients) * 100)
        : 0;

    return NextResponse.json({
      campaign: {
        ...campaign,
        isRunning,
        progressPercent,
        counts,
      },
      recipients,
      pagination: {
        total: totalMatching,
        page,
        limit,
        totalPages: Math.ceil(totalMatching / limit),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Delete attachment file from disk if exists
    if (campaign.attachmentPath) {
      await deletePdfAttachment(campaign.attachmentPath);
    }

    await db.campaign.delete({
      where: { id: campaignId },
    });

    return NextResponse.json({ success: true, message: 'Campaign deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
