import type { Metadata } from 'next';

import { AuthProvider } from '@/contexts/AuthContext';
import { I18nProvider } from '@/i18n/I18nProvider';
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
      <body>
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
