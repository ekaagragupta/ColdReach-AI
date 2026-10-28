'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Download,
  Search,
  RefreshCw,
  Mail,
  FileText,
  Play,
  XCircle,
} from 'lucide-react';

interface CampaignSummary {
  id: string;
  title: string;
  subject: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  attachmentFilename: string | null;
  createdAt: string;
  googleAccount?: { email: string } | null;
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState<{
    configured: boolean;
    connected: boolean;
    account: { email: string } | null;
  }>({ configured: false, connected: false, account: null });

  const loadData = async () => {
    try {
      const [campRes, googleRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/auth/google/status'),
      ]);

      const campData = await campRes.json();
      const googleData = await googleRes.json();

      if (campData.campaigns) setCampaigns(campData.campaigns);
      setGoogleStatus(googleData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh stats every 8 seconds if there are campaigns
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Compute aggregate stats across all campaigns
  const totalRecipients = campaigns.reduce((acc, c) => acc + c.totalRecipients, 0);
  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + c.failedCount, 0);
  const totalPending = campaigns.reduce((acc, c) => acc + c.pendingCount, 0);

  const latestCampaign = campaigns[0] || null;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Dashboard"
        description="Monitor email outreach campaigns, delivery performance, and Gmail quota status."
      />

      <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Google Account Alert if not connected */}
        {!googleStatus.connected && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Connect your Google Gmail account
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  To send outreach emails directly from your personal Gmail address, authorize your account via Google OAuth.
                </p>
              </div>
            </div>
            <Link
              href="/settings"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors"
            >
              Connect Gmail
            </Link>
          </div>
        )}

        {/* Aggregate Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Total Recipients</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight">{totalRecipients.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {campaigns.length} campaign(s)</p>
          </div>

          <div className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Emails Sent</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-400">{totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalRecipients > 0 ? `${Math.round((totalSent / totalRecipients) * 100)}% delivery success` : '0%'}
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Pending / Queued</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-blue-400">{totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready for sending</p>
          </div>

          <div className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Failed / Rejected</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-rose-400">{totalFailed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Permanent or syntax errors</p>
          </div>
        </div>

        {/* Latest Campaign Spotlight */}
        {latestCampaign && (
          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                    Latest Campaign
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      latestCampaign.status === 'SENDING'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse'
                        : latestCampaign.status === 'COMPLETED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : latestCampaign.status === 'CANCELLED'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {latestCampaign.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground">{latestCampaign.title}</h3>
                <p className="text-xs text-muted-foreground">Subject: {latestCampaign.subject}</p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/campaigns/${latestCampaign.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                >
                  View Details & Activity
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <a
                  href={`/api/campaigns/${latestCampaign.id}/export`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </a>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {latestCampaign.sentCount + latestCampaign.failedCount} of {latestCampaign.totalRecipients} processed
                </span>
                <span>
                  {latestCampaign.totalRecipients > 0
                    ? Math.round(
                        ((latestCampaign.sentCount + latestCampaign.failedCount) /
                          latestCampaign.totalRecipients) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${
                      latestCampaign.totalRecipients > 0
                        ? Math.round(
                            ((latestCampaign.sentCount + latestCampaign.failedCount) /
                              latestCampaign.totalRecipients) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {latestCampaign.attachmentFilename && (
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 px-3 py-1.5 rounded-lg border border-border/40">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Attachment: {latestCampaign.attachmentFilename}</span>
              </div>
            )}
          </div>
        )}

        {/* All Campaigns Table */}
        <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Outreach Campaigns</h3>
              <p className="text-xs text-muted-foreground">Review history and real-time execution states.</p>
            </div>
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Send className="w-3 h-3" />
              Launch New Campaign
            </Link>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <p className="text-xs">Loading campaign data...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/80 rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">No campaigns created yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Upload your recipient list, common email subject, body, and resume attachment to start your cold outreach.
                </p>
              </div>
              <Link
                href="/campaigns/new"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Create Your First Campaign
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground uppercase tracking-wider text-[11px]">
                    <th className="pb-3 font-semibold">Campaign</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Progress</th>
                    <th className="pb-3 font-semibold">Sent</th>
                    <th className="pb-3 font-semibold">Failed</th>
                    <th className="pb-3 font-semibold">Created</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-secondary/30 transition-colors group">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/campaigns/${camp.id}`}
                          className="font-semibold text-foreground hover:text-blue-400 transition-colors"
                        >
                          {camp.title}
                        </Link>
                        <p className="text-[11px] text-muted-foreground truncate max-w-xs">{camp.subject}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            camp.status === 'SENDING'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse'
                              : camp.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : camp.status === 'CANCELLED'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {camp.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 w-32">
                        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{
                              width: `${
                                camp.totalRecipients > 0
                                  ? Math.round(
                                      ((camp.sentCount + camp.failedCount) / camp.totalRecipients) * 100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-medium text-emerald-400">
                        {camp.sentCount} / {camp.totalRecipients}
                      </td>
                      <td className="py-3 pr-4 text-rose-400 font-medium">{camp.failedCount}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(camp.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/campaigns/${camp.id}`}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="View Campaign"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                          <a
                            href={`/api/campaigns/${camp.id}/export`}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Download CSV"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
