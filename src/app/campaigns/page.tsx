'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  Send,
  Download,
  ArrowUpRight,
  RefreshCw,
  Trash2,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface CampaignItem {
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

export default function CampaignHistoryPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (data.campaigns) setCampaigns(data.campaigns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-20">
      <Header
        title="Campaign History"
        description="Comprehensive log of all cold email campaigns sent through your authorized Gmail account."
      />

      <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border/80 rounded-2xl bg-card/40 space-y-3">
            <h3 className="text-sm font-semibold">No campaigns yet</h3>
            <p className="text-xs text-muted-foreground">
              Launch your first personalized outreach campaign.
            </p>
            <Link
              href="/campaigns/new"
              className="inline-flex px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              New Campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4 hover:border-border transition-colors group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(camp.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-foreground group-hover:text-blue-400 transition-colors">
                    <Link href={`/campaigns/${camp.id}`}>{camp.title}</Link>
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">{camp.subject}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-border/40">
                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Delivery Success</span>
                      <span>
                        {camp.sentCount} / {camp.totalRecipients} ({camp.totalRecipients > 0 ? Math.round((camp.sentCount / camp.totalRecipients) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-emerald-400"
                        style={{
                          width: `${
                            camp.totalRecipients > 0
                              ? Math.round((camp.sentCount / camp.totalRecipients) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {camp.attachmentFilename && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      Attachment: <strong>{camp.attachmentFilename}</strong>
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/campaigns/${camp.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Activity Monitor
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/campaigns/${camp.id}/export`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Export CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={(e) => handleDelete(camp.id, e)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
