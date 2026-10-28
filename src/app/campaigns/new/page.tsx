'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import {
  Users,
  Upload,
  FileText,
  Mail,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
  Eye,
  Send,
  ShieldCheck,
  RefreshCw,
  Plus,
  ArrowRight,
  Info,
  X,
  FileCheck,
  Search,
} from 'lucide-react';

interface Recipient {
  email: string;
  name?: string;
  company?: string;
  position?: string;
}

interface InvalidRecipient {
  raw: string;
  reason: string;
}

export default function NewCampaignPage() {
  const router = useRouter();

  // Wizard Steps: 1: Recipients, 2: Email & Attachment, 3: Review & Send
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Google Account Status
  const [googleAccount, setGoogleAccount] = useState<{
    configured: boolean;
    connected: boolean;
    account: { email: string; name: string | null } | null;
  }>({ configured: false, connected: false, account: null });

  // Recipient input state
  const [inputTab, setInputTab] = useState<'paste' | 'csv' | 'manual'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualPosition, setManualPosition] = useState('');

  // Validated recipients list
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [invalidRecipients, setInvalidRecipients] = useState<InvalidRecipient[]>([]);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [suppressedCount, setSuppressedCount] = useState(0);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [isValidatingRecipients, setIsValidatingRecipients] = useState(false);

  // Email Composer state
  const [campaignTitle, setCampaignTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sendIntervalSec, setSendIntervalSec] = useState(3);

  // PDF Attachment state
  const [attachment, setAttachment] = useState<{
    filename: string;
    path: string;
    sizeFormatted: string;
    sizeBytes: number;
  } | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test Email state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Final Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Google connection status on mount
  useEffect(() => {
    fetch('/api/auth/google/status')
      .then((res) => res.json())
      .then((data) => {
        setGoogleAccount(data);
        if (data.account?.email) {
          setTestEmailAddress(data.account.email);
        }
      })
      .catch((err) => console.error(err));

    // Load persisted draft from localStorage if available
    try {
      const saved = localStorage.getItem('coldreach_draft_campaign');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.subject) setSubject(parsed.subject);
        if (parsed.bodyText) setBodyText(parsed.bodyText);
        if (parsed.campaignTitle) setCampaignTitle(parsed.campaignTitle);
      }
    } catch {}
  }, []);

  // Persist draft subject/body to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'coldreach_draft_campaign',
        JSON.stringify({ campaignTitle, subject, bodyText })
      );
    } catch {}
  }, [campaignTitle, subject, bodyText]);

  // Recipient Parsing & Validation Trigger
  const handleValidateRecipients = async (
    type: 'paste' | 'csv' | 'manual',
    content: any
  ) => {
    setIsValidatingRecipients(true);
    setFormError(null);

    try {
      const res = await fetch('/api/recipients/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, checkSuppression: true }),
      });
      const data = await res.json();

      if (data.valid) {
        if (type === 'manual') {
          // Append manual recipient to existing list
          setRecipients((prev) => {
            const seen = new Set(prev.map((r) => r.email));
            const newOnes = data.valid.filter((r: Recipient) => !seen.has(r.email));
            return [...prev, ...newOnes];
          });
        } else {
          setRecipients(data.valid);
        }
        setInvalidRecipients(data.invalid || []);
        setDuplicatesRemoved(data.duplicatesRemoved || 0);
        setSuppressedCount(data.suppressedCount || 0);
      } else if (data.error) {
        setFormError(data.error);
      }
    } catch (err: any) {
      setFormError(err.message || 'Validation request failed');
    } finally {
      setIsValidatingRecipients(false);
    }
  };

  // CSV File Upload handler
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleValidateRecipients('csv', content);
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // PDF Attachment Upload handler
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfUploadError(null);
    setIsUploadingPdf(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/attachment/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAttachment({
          filename: data.originalFilename || data.filename,
          path: data.path,
          sizeFormatted: data.sizeFormatted,
          sizeBytes: data.sizeBytes,
        });
      } else {
        setPdfUploadError(data.error || 'Failed to upload PDF resume.');
      }
    } catch (err: any) {
      setPdfUploadError(err.message || 'Network error uploading PDF.');
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove individual recipient
  const handleRemoveRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  // Send single test email
  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      alert('Please enter a test recipient email address');
      return;
    }
    if (!subject.trim() || !bodyText.trim()) {
      alert('Please fill in both Subject and Body before sending a test email');
      return;
    }

    setIsSendingTest(true);
    setTestEmailResult(null);

    try {
      // First create a temporary draft campaign to test
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '[Draft Test] ' + (subject.slice(0, 20) || 'Test Campaign'),
          subject: subject.trim(),
          bodyText: bodyText.trim(),
          attachmentPath: attachment?.path || null,
          attachmentFilename: attachment?.filename || null,
          attachmentSize: attachment?.sizeBytes || null,
          recipients: [{ email: testEmailAddress.trim().toLowerCase() }],
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to prepare test campaign');

      // Send the test email
      const testRes = await fetch(`/api/campaigns/${createData.campaignId}/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail: testEmailAddress }),
      });
      const testData = await testRes.json();

      if (testRes.ok && testData.success) {
        setTestEmailResult({
          success: true,
          message: `Test email sent successfully to ${testEmailAddress}! Check your inbox.`,
        });
      } else {
        setTestEmailResult({
          success: false,
          message: testData.error || 'Failed to send test email',
        });
      }
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Create Campaign and Launch
  const handleCreateAndLaunchCampaign = async () => {
    setIsCreatingCampaign(true);
    setFormError(null);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignTitle.trim() || `Outreach: ${subject.slice(0, 30)}`,
          subject: subject.trim(),
          bodyText: bodyText.trim(),
          sendIntervalSec,
          attachmentPath: attachment?.path || null,
          attachmentFilename: attachment?.filename || null,
          attachmentSize: attachment?.sizeBytes || null,
          recipients,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      // Automatically trigger sending engine
      await fetch(`/api/campaigns/${data.campaignId}/start`, {
        method: 'POST',
      });

      // Clear draft storage
      localStorage.removeItem('coldreach_draft_campaign');

      // Redirect to campaign activity monitor page
      router.push(`/campaigns/${data.campaignId}`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to initiate campaign');
      setShowConfirmModal(false);
      setIsCreatingCampaign(false);
    }
  };

  // Filtered recipients for search
  const filteredRecipients = recipients.filter((r) => {
    if (!recipientSearch.trim()) return true;
    const q = recipientSearch.toLowerCase();
    return (
      r.email.toLowerCase().includes(q) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.company && r.company.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col pb-20">
      <Header
        title="Create Cold Outreach Campaign"
        description="Configure your common subject, email body, single resume attachment, and recipient list."
      />

      <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === 1
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground bg-secondary/50'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px]">
                1
              </span>
              Recipients ({recipients.length})
            </button>

            <span className="text-muted-foreground text-xs">→</span>

            <button
              onClick={() => {
                if (recipients.length > 0) setStep(2);
              }}
              disabled={recipients.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === 2
                  ? 'bg-blue-600 text-white shadow-sm'
                  : recipients.length > 0
                  ? 'text-muted-foreground hover:text-foreground bg-secondary/50'
                  : 'text-muted-foreground/40 bg-secondary/20 cursor-not-allowed'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px]">
                2
              </span>
              Message & Resume
            </button>

            <span className="text-muted-foreground text-xs">→</span>

            <button
              onClick={() => {
                if (recipients.length > 0 && subject && bodyText) setStep(3);
              }}
              disabled={recipients.length === 0 || !subject || !bodyText}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === 3
                  ? 'bg-blue-600 text-white shadow-sm'
                  : recipients.length > 0 && subject && bodyText
                  ? 'text-muted-foreground hover:text-foreground bg-secondary/50'
                  : 'text-muted-foreground/40 bg-secondary/20 cursor-not-allowed'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px]">
                3
              </span>
              Review & Confirmation
            </button>
          </div>

          {/* Quick Gmail Status Indicator */}
          <div className="flex items-center gap-2 text-xs">
            {googleAccount.connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                From: {googleAccount.account?.email}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Gmail not connected
              </span>
            )}
          </div>
        </div>

        {formError && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* STEP 1: RECIPIENT MANAGEMENT */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Add Recipients</h3>
                  <p className="text-xs text-muted-foreground">
                    Provide contacts via paste, CSV upload, or manual entry. Addresses are automatically validated and deduplicated.
                  </p>
                </div>
                <a
                  href="/api/recipients/template"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV Template
                </a>
              </div>

              {/* Input Method Tabs */}
              <div className="flex border-b border-border/60 gap-4">
                <button
                  onClick={() => setInputTab('paste')}
                  className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                    inputTab === 'paste'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Paste Email Addresses
                </button>
                <button
                  onClick={() => setInputTab('csv')}
                  className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                    inputTab === 'csv'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Upload CSV File
                </button>
                <button
                  onClick={() => setInputTab('manual')}
                  className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                    inputTab === 'manual'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Manual Entry Form
                </button>
              </div>

              {/* Tab A: Paste */}
              {inputTab === 'paste' && (
                <div className="space-y-3">
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste email addresses separated by newlines, commas, or semicolons...&#10;e.g.&#10;sarah.connor@cyberdyne.tech&#10;Alex Chen <alex@innovate.ai>&#10;priya@globalfin.org"
                    className="w-full p-3.5 rounded-xl border border-input bg-secondary/30 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleValidateRecipients('paste', pastedText)}
                      disabled={!pastedText.trim() || isValidatingRecipients}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
                    >
                      {isValidatingRecipients ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Process & Validate Emails
                    </button>
                  </div>
                </div>
              )}

              {/* Tab B: CSV Upload */}
              {inputTab === 'csv' && (
                <div className="p-8 border-2 border-dashed border-border/80 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 bg-secondary/10">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Select a CSV file</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
                      Must contain at least an `email` column. Supports optional columns: `name`, `company`, `position`.
                    </p>
                  </div>
                  <label className="cursor-pointer px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                    <span>Browse CSV File</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleCsvFileUpload}
                    />
                  </label>
                </div>
              )}

              {/* Tab C: Manual Entry */}
              {inputTab === 'manual' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Email Address (Required) *
                      </label>
                      <input
                        type="email"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="recruiter@company.com"
                        className="w-full p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Contact Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Sarah Connor"
                        className="w-full p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Company (Optional)
                      </label>
                      <input
                        type="text"
                        value={manualCompany}
                        onChange={(e) => setManualCompany(e.target.value)}
                        placeholder="Cyberdyne Systems"
                        className="w-full p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Position / Role (Optional)
                      </label>
                      <input
                        type="text"
                        value={manualPosition}
                        onChange={(e) => setManualPosition(e.target.value)}
                        placeholder="Head of Engineering"
                        className="w-full p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (!manualEmail.trim()) return;
                        handleValidateRecipients('manual', [
                          {
                            email: manualEmail,
                            name: manualName,
                            company: manualCompany,
                            position: manualPosition,
                          },
                        ]);
                        setManualEmail('');
                        setManualName('');
                        setManualCompany('');
                        setManualPosition('');
                      }}
                      disabled={!manualEmail.trim()}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to Recipient List
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Validation Feedback & Metrics */}
            {recipients.length > 0 && (
              <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Valid Recipients ({recipients.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Deduplicated & validated. Each person will receive their own separate email.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Filter recipients..."
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 rounded-lg border border-input bg-secondary/40 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                      />
                    </div>
                    <button
                      onClick={() => setRecipients([])}
                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Validation Stats Pills */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {recipients.length} Valid Recipients
                  </span>
                  {duplicatesRemoved > 0 && (
                    <span className="px-2.5 py-1 rounded-md bg-secondary text-muted-foreground border border-border">
                      {duplicatesRemoved} duplicate(s) removed
                    </span>
                  )}
                  {suppressedCount > 0 && (
                    <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {suppressedCount} previously contacted / suppressed
                    </span>
                  )}
                  {invalidRecipients.length > 0 && (
                    <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {invalidRecipients.length} invalid dropped
                    </span>
                  )}
                </div>

                {/* Invalid flagged emails details */}
                {invalidRecipients.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs space-y-1">
                    <p className="font-semibold text-rose-400">Flagged Invalid Addresses:</p>
                    <div className="max-h-24 overflow-y-auto space-y-1 text-muted-foreground font-mono text-[11px]">
                      {invalidRecipients.map((inv, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{inv.raw}</span>
                          <span className="text-rose-400/80">{inv.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recipient List Table */}
                <div className="max-h-80 overflow-y-auto border border-border/60 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 sticky top-0 border-b border-border/80 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Company</th>
                        <th className="py-2.5 px-3">Position</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                      {filteredRecipients.map((r, i) => (
                        <tr key={r.email} className="hover:bg-secondary/20">
                          <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-2 px-3 font-semibold text-foreground">{r.email}</td>
                          <td className="py-2 px-3 text-muted-foreground">{r.name || '—'}</td>
                          <td className="py-2 px-3 text-muted-foreground">{r.company || '—'}</td>
                          <td className="py-2 px-3 text-muted-foreground">{r.position || '—'}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleRemoveRecipient(r.email)}
                              className="text-muted-foreground hover:text-rose-400 p-1"
                              title="Remove recipient"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Continue to Step 2 Button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-2 shadow-sm"
                  >
                    <span>Proceed to Message & Resume</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: EMAIL COMPOSER & RESUME PDF */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-5">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Email Composer</h3>
                  <p className="text-xs text-muted-foreground">
                    This exact subject, body, and attached resume PDF will be sent separately to each recipient.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Total Recipients: </span>
                  <span className="text-xs font-bold text-foreground">{recipients.length}</span>
                </div>
              </div>

              {/* Read-Only From & To indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    From (Connected Gmail)
                  </label>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {googleAccount.account?.email || 'Not connected (Connect in Settings)'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    To (Outreach List)
                  </label>
                  <p className="text-xs font-semibold text-foreground">
                    {recipients.length} individual recipients (sent separately, no CC/BCC)
                  </p>
                </div>
              </div>

              {/* Campaign Title (Internal reference) */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Campaign Title (For your dashboard reference)
                </label>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. Summer 2026 SWE Internship Outreach"
                  className="w-full p-2.5 rounded-lg border border-input bg-secondary/20 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Subject Field */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Email Subject Line *
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {subject.length} characters
                  </span>
                </div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Software Engineer Application — Ekaagra Gupta"
                  className="w-full p-2.5 rounded-lg border border-input bg-secondary/20 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Email Body Field */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Common Email Body *
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {bodyText.length} characters
                  </span>
                </div>
                <textarea
                  rows={10}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Hi there,&#10;&#10;I hope you are having a great week. I am reaching out to express my strong interest in Software Engineering opportunities on your team...&#10;&#10;I have attached my resume for your review. Would love to connect!&#10;&#10;Best regards,&#10;Ekaagra Gupta"
                  className="w-full p-3.5 rounded-xl border border-input bg-secondary/20 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed font-sans"
                />
              </div>

              {/* Resume PDF Attachment Section */}
              <div className="pt-2 border-t border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Resume PDF Attachment
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Upload your resume PDF once. The exact same PDF is attached to every outgoing email.
                    </p>
                  </div>
                </div>

                {attachment ? (
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{attachment.filename}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {attachment.sizeFormatted} • Validated PDF (%PDF signature checked)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/attachment/preview?path=${encodeURIComponent(attachment.path)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </a>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => setAttachment(null)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove attachment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border-2 border-dashed border-border/80 rounded-xl flex flex-col items-center justify-center text-center space-y-2 bg-secondary/10">
                    <FileText className="w-8 h-8 text-muted-foreground/60" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Upload Resume PDF</p>
                      <p className="text-[11px] text-muted-foreground">
                        Accepts valid PDF documents only up to 25MB.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPdf}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2"
                    >
                      {isUploadingPdf ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Verifying PDF...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          Choose PDF Document
                        </>
                      )}
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />

                {pdfUploadError && (
                  <p className="text-xs text-rose-400">{pdfUploadError}</p>
                )}
              </div>

              {/* Sending Interval */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-foreground block">
                    Delay Between Outgoing Emails
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Spreads out sends to avoid triggering Google burst abuse rate limits.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={sendIntervalSec}
                    onChange={(e) => setSendIntervalSec(Number(e.target.value) || 3)}
                    className="w-16 p-1.5 rounded-lg border border-input bg-secondary/30 text-xs text-center font-bold"
                  />
                  <span className="text-xs text-muted-foreground">seconds</span>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4 border-t border-border/60">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/50 transition-colors"
                >
                  Back to Recipients
                </button>

                <button
                  onClick={() => setStep(3)}
                  disabled={!subject.trim() || !bodyText.trim()}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-all flex items-center gap-2 shadow-sm"
                >
                  <span>Review Campaign & Send</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & CONFIRMATION */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-6">
              <div>
                <h3 className="text-base font-semibold text-foreground">Review Campaign Outreach</h3>
                <p className="text-xs text-muted-foreground">
                  Confirm all details before initiating individual delivery through your connected Gmail account.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60">
                  <span className="text-[11px] text-muted-foreground block">Sending Account</span>
                  <span className="text-xs font-bold text-foreground truncate block mt-0.5">
                    {googleAccount.account?.email || 'Gmail Not Connected'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60">
                  <span className="text-[11px] text-muted-foreground block">Total Outgoing Emails</span>
                  <span className="text-xs font-bold text-blue-400 block mt-0.5">
                    {recipients.length} individual messages
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60">
                  <span className="text-[11px] text-muted-foreground block">Est. Duration</span>
                  <span className="text-xs font-bold text-foreground block mt-0.5">
                    ~{Math.ceil((recipients.length * sendIntervalSec) / 60)} minutes ({sendIntervalSec}s delay)
                  </span>
                </div>
              </div>

              {/* Message Preview Box */}
              <div className="border border-border/60 rounded-xl overflow-hidden bg-background">
                <div className="px-4 py-3 bg-secondary/40 border-b border-border/60 space-y-1">
                  <div className="flex text-xs">
                    <span className="w-20 text-muted-foreground">From:</span>
                    <span className="font-semibold">{googleAccount.account?.email}</span>
                  </div>
                  <div className="flex text-xs">
                    <span className="w-20 text-muted-foreground">To:</span>
                    <span className="font-semibold text-blue-400">
                      [Individual Recipient Address] ({recipients.length} total)
                    </span>
                  </div>
                  <div className="flex text-xs">
                    <span className="w-20 text-muted-foreground">Subject:</span>
                    <span className="font-semibold">{subject}</span>
                  </div>
                  {attachment && (
                    <div className="flex text-xs pt-1">
                      <span className="w-20 text-muted-foreground">Attachment:</span>
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                        <FileText className="w-3.5 h-3.5" />
                        {attachment.filename} ({attachment.sizeFormatted})
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5 text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                  {bodyText}
                </div>
              </div>

              {/* Send Test Email Section */}
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-blue-400" />
                      Send Live Test Email
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Verify exactly how your email and resume attachment appear in a real Gmail inbox before starting.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="Enter test recipient email..."
                    className="w-full sm:flex-1 p-2 rounded-lg border border-input bg-secondary/40 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendTestEmail}
                    disabled={isSendingTest || !testEmailAddress}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {isSendingTest ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Send Test Email
                  </button>
                </div>

                {testEmailResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      testEmailResult.success
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {testEmailResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{testEmailResult.message}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-border/60">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/50 transition-colors"
                >
                  Back to Editor
                </button>

                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!googleAccount.connected || recipients.length === 0}
                  className="px-6 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Campaign ({recipients.length} Recipients)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Send className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground">
                Confirm & Launch Outreach Campaign
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                You are about to send{' '}
                <strong className="text-foreground">{recipients.length}</strong> separate cold emails directly from your authorized Gmail account:{' '}
                <strong className="text-blue-400">{googleAccount.account?.email}</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/60 text-[11px] text-muted-foreground space-y-1">
              <p>• Every email is sent individually to that recipient alone.</p>
              <p>• Resume PDF is attached to each outgoing message.</p>
              <p>• Delay between sends: {sendIntervalSec} seconds.</p>
              <p>• Messages accepted by Gmail cannot be recalled.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isCreatingCampaign}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAndLaunchCampaign}
                disabled={isCreatingCampaign}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-2"
              >
                {isCreatingCampaign ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Starting Campaign...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Yes, Send Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
