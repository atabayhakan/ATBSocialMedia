import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthSessionProvider } from '@/components/session-provider';

export const metadata: Metadata = {
  title: 'ATBSocialMedia — Otonom Sosyal Medya Platformu',
  description: 'AI destekli, tam otonom sosyal medya ve WhatsApp yönetim paneli',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <AuthSessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
