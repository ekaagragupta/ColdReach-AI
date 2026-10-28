'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import {
  Users,
  ShieldAlert,
  Plus,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface SuppressionItem {
  id: string;
  email: string;
  reason: string | null;
  suppressedAt: string;
}

export default function RecipientsSuppressionPage() {
  const [suppressionList, setSuppressionList] = useState<SuppressionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('Previously Contacted');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const loadSuppression = async () => {
    try {
      const res = await fetch('/api/settings/suppression');
      const data = await res.json();
      if (data.suppressionList) setSuppressionList(data.suppressionList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppression();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      const res = await fetch('/api/settings/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), reason: newReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewEmail('');
        setMessage(`Added ${newEmail} to suppression list.`);
        loadSuppression();
      } else {
        setMessage(data.error || 'Failed to add');
      }
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleRemove = async (email: string) => {
    try {
      await fetch('/api/settings/suppression', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSuppressionList((prev) => prev.filter((s) => s.email !== email));
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = suppressionList.filter((item) =>
    item.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col pb-20">
      <Header
        title="Recipients & Suppression"
        description="Manage your suppression list to avoid re-contacting previously reached professionals."
      />

      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Top Action & Template */}
        <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Standard CSV Recipient Template</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Download the official template with columns: `email, name, company, position`.
            </p>
          </div>
          <a
            href="/api/recipients/template"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV Template
          </a>
        </div>

        {/* Add to Suppression Form */}
        <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Add Email to Suppression List
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suppressed email addresses will be automatically excluded when preparing campaigns.
            </p>
          </div>

          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. recruiter@example.com"
              className="flex-1 w-full p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="w-full sm:w-56 p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Previously Contacted">Previously Contacted</option>
              <option value="Unsubscribed / Requested No Contact">Unsubscribed / Opted Out</option>
              <option value="Invalid / Bounced">Invalid / Bounced</option>
              <option value="Competitor / Internal">Competitor / Internal</option>
            </select>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors shrink-0 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Suppression
            </button>
          </form>

          {message && (
            <p className="text-xs text-blue-400">{message}</p>
          )}
        </div>

        {/* Suppression List */}
        <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Active Suppression Entries ({suppressionList.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Addresses suppressed from future cold outreach batches.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search suppressed..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-input bg-secondary/40 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto border border-border/60 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 border-b border-border/80 text-[11px] uppercase text-muted-foreground sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Date Suppressed</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground font-sans">
                      No suppressed addresses recorded.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary/20">
                      <td className="py-2.5 px-3 font-semibold text-foreground">{item.email}</td>
                      <td className="py-2.5 px-3 text-muted-foreground font-sans">{item.reason || '—'}</td>
                      <td className="py-2.5 px-3 text-muted-foreground font-sans">
                        {new Date(item.suppressedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleRemove(item.email)}
                          className="text-muted-foreground hover:text-rose-400 p-1"
                          title="Remove from suppression"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
