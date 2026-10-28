'use client';

import React from 'react';
import Link from 'next/link';
import { PlusCircle, Sparkles } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
}

export function Header({ title, description, action }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-semibold text-foreground tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {action ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {action.label}
          </Link>
        ) : (
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Campaign
          </Link>
        )}
      </div>
    </header>
  );
}
