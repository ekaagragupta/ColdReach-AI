import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RecipientInput, processRecipients } from '@/lib/validation';

export async function GET() {
  try {
    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        googleAccount: {
          select: { email: true, name: true },
        },
      },
    });

    return NextResponse.json({ campaigns });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      subject,
      bodyText,
      bodyHtml,
      attachmentPath,
      attachmentFilename,
      attachmentSize,
      attachmentMime,
      sendIntervalSec = 3,
      recipients = [],
    } = body;

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: 'Subject line is required.' }, { status: 400 });
    }

    if (!bodyText || !bodyText.trim()) {
      return NextResponse.json({ error: 'Email body is required.' }, { status: 400 });
    }

    // Check connected Google account
    const activeAccount = await db.googleAccount.findFirst({
      orderBy: { connectedAt: 'desc' },
    });

    if (!activeAccount) {
      return NextResponse.json(
        { error: 'No Google Gmail account is connected. Please connect your account in Settings first.' },
        { status: 400 }
      );
    }

    // Deduplicate and validate recipients
    const processed = processRecipients(recipients as RecipientInput[]);
    if (processed.valid.length === 0) {
      return NextResponse.json({ error: 'At least one valid recipient email is required.' }, { status: 400 });
    }

    // Create campaign and recipients inside transaction
    const campaign = await db.campaign.create({
      data: {
        title: title?.trim() || `Campaign: ${subject.slice(0, 30)}...`,
        subject: subject.trim(),
        bodyText: bodyText.trim(),
        bodyHtml: bodyHtml?.trim() || null,
        attachmentPath: attachmentPath || null,
        attachmentFilename: attachmentFilename || null,
        attachmentSize: attachmentSize || null,
        attachmentMime: attachmentMime || 'application/pdf',
        sendIntervalSec: Math.max(1, Number(sendIntervalSec) || 3),
        googleAccountId: activeAccount.id,
        totalRecipients: processed.valid.length,
        pendingCount: processed.valid.length,
        status: 'DRAFT',
        recipients: {
          create: processed.valid.map((r) => ({
            email: r.email,
            name: r.name || null,
            company: r.company || null,
            position: r.position || null,
            status: 'PENDING',
          })),
        },
      },
      include: {
        recipients: true,
      },
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      totalRecipients: campaign.totalRecipients,
      duplicatesRemoved: processed.duplicatesRemoved,
    });
  } catch (err: any) {
    console.error('Create campaign error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
