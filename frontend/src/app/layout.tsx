import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'ATBSocialMedia — Otonom Sosyal Medya Platformu',
  description: 'AI destekli, tam otonom sosyal medya ve WhatsApp yönetim paneli',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-background">
        {children}
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
