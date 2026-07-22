'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Newspaper,
  Users,
  MessageCircle,
  Palette,
  Image as ImageIcon,
  Share2,
  Settings,
  Sparkles,
  Compass,
} from 'lucide-react';

const items = [
  { href: '/dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { href: '/dashboard/strategy', label: 'Marka Stratejisi', icon: Compass },
  { href: '/dashboard/calendar', label: 'İçerik Takvimi', icon: Calendar },
  { href: '/dashboard/sources', label: 'Haber Kaynakları', icon: Newspaper },
  { href: '/dashboard/personas', label: 'AI Kişilikler', icon: Users },
  { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/dashboard/templates', label: 'Görsel Şablonları', icon: ImageIcon },
  { href: '/dashboard/canva', label: 'Canva Tasarım', icon: Palette },
  { href: '/dashboard/social', label: 'Sosyal Hesaplar', icon: Share2 },
  { href: '/dashboard/settings', label: 'Ayarlar', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 backdrop-blur md:block">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold gradient-text">ATBSocialMedia</span>
      </div>
      <nav className="space-y-1 p-4">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
