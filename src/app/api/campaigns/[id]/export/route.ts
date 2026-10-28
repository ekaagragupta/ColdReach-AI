import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import Papa from 'papaparse';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const rows = campaign.recipients.map((r) => ({
      Recipient: r.email,
      Name: r.name || '',
      Company: r.company || '',
      Position: r.position || '',
      Status: r.status,
      'Sent At': r.sentAt ? r.sentAt.toISOString() : '',
      'Gmail Message ID': r.gmailMessageId || '',
      Error: r.errorMessage || '',
    }));

    const csvData = Papa.unparse(rows);
    const sanitizedTitle = campaign.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `coldreach_${sanitizedTitle}_results.csv`;

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
