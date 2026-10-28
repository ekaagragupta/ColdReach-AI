import { describe, it, expect } from 'vitest';
import { db } from '../lib/db';
import { isCampaignActive, cancelCampaignExecution } from '../lib/campaign-queue';

describe('Campaign & Queue Lifecycle Suite', () => {
  it('creates and persists a campaign with individual recipients in the database', async () => {
    const campaign = await db.campaign.create({
      data: {
        title: 'Internship Outreach 2026',
        subject: 'Internship Inquiry',
        bodyText: 'Dear Team, I am interested in internships.',
        sendIntervalSec: 2,
        totalRecipients: 2,
        pendingCount: 2,
        status: 'DRAFT',
        recipients: {
          create: [
            { email: 'recruiter1@company.com', name: 'Recruiter One', company: 'Company A' },
            { email: 'recruiter2@company.com', name: 'Recruiter Two', company: 'Company B' },
          ],
        },
      },
      include: {
        recipients: true,
      },
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.recipients).toHaveLength(2);
    expect(campaign.recipients[0].status).toBe('PENDING');
    expect(campaign.recipients[1].status).toBe('PENDING');

    // Clean up
    await db.campaign.delete({ where: { id: campaign.id } });
  });

  it('correctly tracks active status and handles cancellation', () => {
    const dummyId = 'test-nonexistent-campaign';
    expect(isCampaignActive(dummyId)).toBe(false);
    expect(cancelCampaignExecution(dummyId)).toBe(false);
  });
});
