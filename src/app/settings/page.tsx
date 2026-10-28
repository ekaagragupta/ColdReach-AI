'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import {
  ShieldCheck,
  Mail,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  LogOut,
  Sliders,
  Database,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function SettingsContent() {
  const searchParams = useSearchParams();
  const authParam = searchParams.get('auth');
  const errorParam = searchParams.get('error');

  const [googleStatus, setGoogleStatus] = useState<{
    configured: boolean;
    connected: boolean;
    account: {
      email: string;
      name: string | null;
      connectedAt: string;
    } | null;
  }>({ configured: false, connected: false, account: null });

  const [settings, setSettings] = useState({
    defaultSendInterval: 3,
    dailySendLimit: 500,
    maxRetries: 2,
  });

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const loadData = async () => {
    try {
      const [googleRes, settingsRes] = await Promise.all([
        fetch('/api/auth/google/status'),
        fetch('/api/settings'),
      ]);

      const googleData = await googleRes.json();
      const settingsData = await settingsRes.json();

      setGoogleStatus(googleData);
      if (settingsData.settings) {
        setSettings({
          defaultSendInterval: settingsData.settings.defaultSendInterval,
          dailySendLimit: settingsData.settings.dailySendLimit,
          maxRetries: settingsData.settings.maxRetries,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initiate Google OAuth consent flow.');
        setConnecting(false);
      }
    } catch (err: any) {
      alert(err.message);
      setConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect your Google Gmail account?')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/auth/google/disconnect', { method: 'POST' });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-20">
      <Header
        title="Settings & Integrations"
        description="Manage Google Gmail OAuth 2.0 authorization, sending intervals, and token security."
      />

      <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
        {/* Banner from OAuth Callback */}
        {authParam === 'success' && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Google Gmail account connected successfully via official OAuth 2.0!</span>
          </div>
        )}

        {errorParam && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Google authorization error: {errorParam}</span>
          </div>
        )}

        {/* Section 1: Google Gmail Account Connection */}
        <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Gmail Account Integration
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Emails are sent directly from your personal Gmail address using Google’s official API.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {googleStatus.connected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Not Connected
                </span>
              )}
            </div>
          </div>

          {/* Account status details */}
          {googleStatus.connected && googleStatus.account ? (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Authorized Email Address:</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{googleStatus.account.email}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Connected on {new Date(googleStatus.account.connectedAt).toLocaleDateString()} • Minimal Scope: `gmail.send`
                </p>
              </div>

              <button
                onClick={handleDisconnectGmail}
                disabled={disconnecting}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                {disconnecting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                Disconnect Account
              </button>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-secondary/20 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Connect your Google Account
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">
                  Authorize ColdReach AI to send emails through your Gmail account. We never store your password, and OAuth tokens are AES-256 encrypted at rest.
                </p>
              </div>

              <button
                onClick={handleConnectGmail}
                disabled={connecting}
                className="px-4 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 shrink-0"
              >
                {connecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Connect Gmail Account
                  </>
                )}
              </button>
            </div>
          )}

          {/* Security details callout */}
          <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/40 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              Security & Google OAuth Privacy Guarantee
            </p>
            <p>• We request only the minimal necessary scope: `https://www.googleapis.com/auth/gmail.send`.</p>
            <p>• We cannot read your inbox, delete your emails, or modify your contacts.</p>
            <p>• All refresh tokens are encrypted at rest with hardware-accelerated AES-256-GCM.</p>
          </div>
        </div>

        {/* Section 2: Google Cloud Credentials Setup Walkthrough */}
        <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-3">
          <button
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                Google Cloud Project Setup Walkthrough
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Step-by-step instructions for creating your Google Cloud Client ID and Secret.
              </p>
            </div>
            {showSetupGuide ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showSetupGuide && (
            <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-3 font-sans leading-relaxed">
              <ol className="list-decimal list-inside space-y-2.5">
                <li>
                  <strong className="text-foreground">Open Google Cloud Console:</strong> Go to{' '}
                  <a
                    href="https://console.cloud.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    console.cloud.google.com <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  and create or select a project.
                </li>
                <li>
                  <strong className="text-foreground">Enable the Gmail API:</strong> In the search bar, search for <em>&quot;Gmail API&quot;</em> and click <strong>Enable</strong>.
                </li>
                <li>
                  <strong className="text-foreground">Configure OAuth Consent Screen:</strong>
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                    <li>Select <strong>External</strong> User Type.</li>
                    <li>Enter App Name (e.g. <em>ColdReach AI</em>) and your email.</li>
                    <li>Add Scope: <code>https://www.googleapis.com/auth/gmail.send</code>.</li>
                    <li>Add your personal Gmail address to <strong>Test Users</strong>.</li>
                  </ul>
                </li>
                <li>
                  <strong className="text-foreground">Create OAuth 2.0 Credentials:</strong>
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                    <li>Go to <strong>APIs & Services → Credentials</strong>.</li>
                    <li>Click <strong>Create Credentials → OAuth client ID</strong>.</li>
                    <li>Application Type: <strong>Web application</strong>.</li>
                    <li>
                      Authorized redirect URIs: Add{' '}
                      <code className="text-blue-400 bg-secondary px-1.5 py-0.5 rounded">
                        http://localhost:3000/api/auth/google/callback
                      </code>
                    </li>
                  </ul>
                </li>
                <li>
                  <strong className="text-foreground">Save to .env.local:</strong> Copy your Client ID and Client Secret into your project&apos;s <code>.env.local</code> file:
                  <pre className="mt-1 p-2.5 rounded-lg bg-black text-white font-mono text-[11px] overflow-x-auto">
{`GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"`}
                  </pre>
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Section 3: Sending Engine Limits & Preferences */}
        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              Sending Engine Limits & Throttling
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure batching speed and observe Google Gmail quota guidelines.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Delay Between Emails (Seconds)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.defaultSendInterval}
                onChange={(e) =>
                  setSettings({ ...settings, defaultSendInterval: Number(e.target.value) })
                }
                className="w-full p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Recommended: 3 to 5 seconds
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Daily Send Quota Ceiling
              </label>
              <input
                type="number"
                min={10}
                max={2000}
                value={settings.dailySendLimit}
                onChange={(e) =>
                  setSettings({ ...settings, dailySendLimit: Number(e.target.value) })
                }
                className="w-full p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Free Gmail: 500/day • Workspace: 2,000/day
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Transient Retry Attempts
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={settings.maxRetries}
                onChange={(e) =>
                  setSettings({ ...settings, maxRetries: Number(e.target.value) })
                }
                className="w-full p-2.5 rounded-lg border border-input bg-secondary/30 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Exponential backoff for 429/5xx
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            {saveSuccess ? (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Settings updated successfully.
              </span>
            ) : (
              <span />
            )}

            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
