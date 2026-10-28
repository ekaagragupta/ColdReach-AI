import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'ColdReach AI — Gmail Cold Outreach Platform',
  description:
    'Automate personalized-recipient, common-template cold email outreach with resume attachments using your own Gmail account.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased flex font-sans">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
