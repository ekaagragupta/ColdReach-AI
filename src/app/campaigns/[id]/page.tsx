'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Download,
  Search,
  RefreshCw,
  FileText,
  Pause,
  Play,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

interface CampaignDetail {
  id: string;
  title: string;
  subject: string;
  bodyText: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  sendIntervalSec: number;
  attachmentFilename: string | null;
  attachmentPath: string | null;
  attachmentSize: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  isRunning: boolean;
  progressPercent: number;
  counts: {
    TOTAL: number;
    PENDING: number;
    SENDING: number;
    SENT: number;
    FAILED: number;
    CANCELLED: number;
  };
  googleAccount?: {
    email: string;
    name: string | null;
  } | null;
}

interface RecipientItem {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  position: string | null;
  status: string;
  gmailMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.id as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadCampaign = async () => {
    if (!campaignId) return;
    try {
      const url = `/api/campaigns/${campaignId}?status=${statusFilter}&search=${encodeURIComponent(
        searchQuery
      )}&page=${page}&limit=50`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.campaign) {
        setCampaign(data.campaign);
        setRecipients(data.recipients || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaign();
  }, [campaignId, statusFilter, searchQuery, page]);

  // Polling while campaign is actively running
  useEffect(() => {
    if (!campaign?.isRunning && campaign?.status !== 'SENDING') return;

    const interval = setInterval(() => {
      loadCampaign();
    }, 2500);

    return () => clearInterval(interval);
  }, [campaign?.isRunning, campaign?.status, statusFilter, searchQuery, page]);

  // Handle Cancel Campaign
  const handleCancelCampaign = async () => {
    if (!confirm('Are you sure you want to cancel the remaining unsent emails in this campaign?')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      setActionMessage(data.message || 'Campaign cancelled.');
      await loadCampaign();
    } catch (err: any) {
      setActionMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Start / Resume Campaign
  const handleStartCampaign = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start sending');
      setActionMessage('Campaign execution started.');
      await loadCampaign();
    } catch (err: any) {
      setActionMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Campaign
  const handleDeleteCampaign = async () => {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) {
      return;
    }

    try {
      await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      router.push('/campaigns');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 p-8 text-center space-y-4">
        <h3 className="text-lg font-bold">Campaign Not Found</h3>
        <Link href="/campaigns" className="text-xs text-blue-400 hover:underline">
          Return to Campaigns
        </Link>
      </div>
    );
  }

  const isSending = campaign.isRunning || campaign.status === 'SENDING';

  return (
    <div className="flex-1 flex flex-col pb-20">
      <Header
        title={campaign.title}
        description={`Status: ${campaign.status} • Created on ${new Date(
          campaign.createdAt
        ).toLocaleDateString()}`}
      />

      <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Top Navigation & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Campaigns History
          </Link>

          <div className="flex items-center gap-2">
            {isSending ? (
              <button
                onClick={handleCancelCampaign}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                Cancel Remaining Sends
              </button>
            ) : campaign.counts.PENDING > 0 ? (
              <button
                onClick={handleStartCampaign}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Start / Resume Sending
              </button>
            ) : null}

            <a
              href={`/api/campaigns/${campaignId}/export`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV Results
            </a>

            <button
              onClick={handleDeleteCampaign}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete campaign"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
            {actionMessage}
          </div>
        )}

        {/* Live Progress Card */}
        <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isSending
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse'
                      : campaign.status === 'COMPLETED'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : campaign.status === 'CANCELLED'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isSending && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
                  {campaign.status}
                </span>

                {campaign.googleAccount && (
                  <span className="text-xs text-muted-foreground">
                    Sender: <strong>{campaign.googleAccount.email}</strong>
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Outreach Progress ({campaign.progressPercent}%)
              </h3>
            </div>

            <div className="text-xs text-muted-foreground">
              <span>Delay between emails: </span>
              <strong className="text-foreground">{campaign.sendIntervalSec}s</strong>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${campaign.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                {campaign.counts.SENT + campaign.counts.FAILED} of {campaign.totalRecipients} processed
              </span>
              <span>{campaign.counts.PENDING} pending</span>
            </div>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
              <span className="text-[11px] text-muted-foreground uppercase font-medium">
                Total
              </span>
              <p className="text-xl font-bold text-foreground mt-0.5">
                {campaign.totalRecipients}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
              <span className="text-[11px] text-emerald-400 uppercase font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Sent
              </span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {campaign.counts.SENT}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
              <span className="text-[11px] text-blue-400 uppercase font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pending
              </span>
              <p className="text-xl font-bold text-blue-400 mt-0.5">
                {campaign.counts.PENDING}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
              <span className="text-[11px] text-rose-400 uppercase font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Failed
              </span>
              <p className="text-xl font-bold text-rose-400 mt-0.5">
                {campaign.counts.FAILED}
              </p>
            </div>
          </div>

          {campaign.attachmentFilename && (
            <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>
                Resume Attached: <strong>{campaign.attachmentFilename}</strong>
              </span>
              {campaign.attachmentPath && (
                <a
                  href={`/api/attachment/preview?path=${encodeURIComponent(
                    campaign.attachmentPath
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline ml-2"
                >
                  Preview PDF
                </a>
              )}
            </div>
          )}
        </div>

        {/* Activity Table */}
        <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-foreground">
                Recipient Outreach Activity
              </h4>
              <p className="text-xs text-muted-foreground">
                Individual email delivery records, Gmail message IDs, and error traces.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search recipient..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-input bg-secondary/40 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                />
              </div>

              <button
                onClick={loadCampaign}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Refresh table"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex border-b border-border/60 gap-4 text-xs font-semibold">
            {['ALL', 'SENT', 'FAILED', 'PENDING', 'CANCELLED'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setStatusFilter(tab);
                  setPage(1);
                }}
                className={`pb-2 transition-colors border-b-2 ${
                  statusFilter === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
                {tab === 'ALL' && ` (${campaign.totalRecipients})`}
                {tab === 'SENT' && ` (${campaign.counts.SENT})`}
                {tab === 'FAILED' && ` (${campaign.counts.FAILED})`}
                {tab === 'PENDING' && ` (${campaign.counts.PENDING})`}
                {tab === 'CANCELLED' && ` (${campaign.counts.CANCELLED})`}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-border/60 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 border-b border-border/80 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Sent At</th>
                  <th className="py-2.5 px-3">Gmail Message ID</th>
                  <th className="py-2.5 px-3">Error / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground font-sans">
                      No recipients matching filter.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary/20">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-foreground block">{r.email}</span>
                        {r.name && (
                          <span className="text-[10px] text-muted-foreground block font-sans">
                            {r.name}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-sans">
                        {r.company || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'SENT'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : r.status === 'SENDING'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse'
                              : r.status === 'FAILED'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                              : r.status === 'CANCELLED'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[10px]">
                        {r.gmailMessageId ? (
                          <span className="text-emerald-400/90">{r.gmailMessageId}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-rose-400 max-w-xs truncate font-sans">
                        {r.errorMessage || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
