'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Send,
  PlusCircle,
  History,
  Users,
  Settings,
  Mail,
  ShieldCheck,
  ExternalLink,
  Sun,
  Moon,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const [googleStatus, setGoogleStatus] = useState<{
    configured: boolean;
    connected: boolean;
    account: { email: string; name: string | null } | null;
  }>({ configured: false, connected: false, account: null });

  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check dark mode
    if (document.documentElement.classList.contains('light')) {
      setIsDark(false);
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }

    // Fetch Google connection status
    fetch('/api/auth/google/status')
      .then((res) => res.json())
      .then((data) => {
        setGoogleStatus(data);
      })
      .catch((err) => console.error('Failed to load Google status:', err));
  }, [pathname]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      setIsDark(false);
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  const navItems = [
    { label: 'Dashboard', href: '/', icon: Send },
    { label: 'New Campaign', href: '/campaigns/new', icon: PlusCircle },
    { label: 'Campaign History', href: '/campaigns', icon: History },
    { label: 'Recipients & Suppression', href: '/recipients', icon: Users },
    { label: 'Settings & OAuth', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-xl flex flex-col justify-between h-screen sticky top-0 shrink-0 z-30">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-border/80">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Mail className="w-4 h-4" />
            </div>
            <span>
              ColdReach <span className="text-blue-500 font-extrabold text-sm tracking-wide">AI</span>
            </span>
          </Link>
          <button
            onClick={toggleTheme}
            title="Toggle theme"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-muted-foreground'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Connected Account Section */}
      <div className="p-4 border-t border-border/80 space-y-3">
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
          <div className="flex items-center justify-between text-xs font-medium mb-1.5">
            <span className="text-muted-foreground">Connected Gmail</span>
            {googleStatus.connected ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Offline
              </span>
            )}
          </div>

          {googleStatus.connected && googleStatus.account ? (
            <div className="truncate">
              <p className="text-xs font-semibold text-foreground truncate">
                {googleStatus.account.email}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Official Gmail API OAuth 2.0
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Gmail account not connected. Connect to send outreach.
              </p>
              <Link
                href="/settings"
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Connect Gmail
              </Link>
            </div>
          )}
        </div>

        <div className="px-2 text-[11px] text-muted-foreground/70 flex justify-between items-center">
          <span>ColdReach AI v1.0</span>
          <span>Google API Validated</span>
        </div>
      </div>
    </aside>
  );
}
