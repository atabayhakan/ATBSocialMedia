'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Bell, Moon, Sun, Search, Clock, AlertTriangle, MessageCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

interface NotificationItem {
  type: 'PENDING' | 'FAILED' | 'CRITICAL_WA';
  title: string;
  detail: string;
  href: string;
  createdAt: string;
}

const typeIcons = {
  PENDING: { icon: Clock, color: 'text-amber-400' },
  FAILED: { icon: AlertTriangle, color: 'text-rose-400' },
  CRITICAL_WA: { icon: MessageCircle, color: 'text-cyan-400' },
};

export function Topbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<{ count: number; items: NotificationItem[] }>({
    count: 0,
    items: [],
  });
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const load = () =>
      api
        .get<{ count: number; items: NotificationItem[] }>('/api/dashboard/notifications')
        .then(setNotifications)
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Ara..." className="pl-9" />
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          title={resolvedTheme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
          onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
        >
          {/* mounted olmadan tema bilinmez (SSR); hidrasyon uyuşmazlığını önle */}
          {mounted && resolvedTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <div className="relative" ref={panelRef}>
          <Button variant="ghost" size="icon" className="relative" title="Bildirimler" onClick={() => setOpen((o) => !o)}>
            <Bell className="h-4 w-4" />
            {notifications.count > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {notifications.count > 9 ? '9+' : notifications.count}
              </span>
            )}
          </Button>

          {open && (
            <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Bildirimler</p>
              </div>
              {notifications.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  <p className="text-sm text-muted-foreground">Her şey yolunda — bildirim yok.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {notifications.items.map((n, i) => {
                    const { icon: Icon, color } = typeIcons[n.type];
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setOpen(false);
                          router.push(n.href);
                        }}
                        className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-accent/50"
                      >
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{n.detail}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
