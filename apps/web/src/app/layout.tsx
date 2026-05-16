import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Sales AI Platform',
  description: 'CRM dashboard for sales teams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}