'use client';
import { useEffect, useState } from 'react';
import { Newspaper, Send, Sparkles, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

interface Stats {
  postCount: number;
  publishedCount: number;
  pendingCount: number;
  sourceCount: number;
  personaCount: number;
  accountCount: number;
  recentPosts: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await api.get<Stats>('/api/dashboard/stats');
    setStats(data);
  }

  useEffect(() => {
    load().catch(console.error);
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function generateNow() {
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId') || 'demo-user';
      const post = await api.post('/api/posts/generate', { userId });
      toast.success('Yeni taslak oluşturuldu');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Üretim başarısız');
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    { label: 'Toplam Gönderi', value: stats?.postCount ?? 0, icon: Newspaper, color: 'text-violet-400' },
    { label: 'Yayında', value: stats?.publishedCount ?? 0, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Onay Bekliyor', value: stats?.pendingCount ?? 0, icon: Clock, color: 'text-amber-400' },
    { label: 'Haber Kaynağı', value: stats?.sourceCount ?? 0, icon: TrendingUp, color: 'text-cyan-400' },
    { label: 'AI Kişilik', value: stats?.personaCount ?? 0, icon: Sparkles, color: 'text-pink-400' },
    { label: 'Sosyal Hesap', value: stats?.accountCount ?? 0, icon: Send, color: 'text-indigo-400' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Genel Bakış</h1>
          <p className="text-sm text-muted-foreground">Tüm kanallarındaki otonom aktivitenin özeti.</p>
        </div>
        <Button variant="gradient" onClick={generateNow} disabled={loading}>
          <Sparkles className="mr-2 h-4 w-4" />
          {loading ? 'Üretiliyor...' : 'Şimdi İçerik Üret'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <p className="mt-3 text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son Gönderiler</CardTitle>
          <CardDescription>AI tarafından üretilen veya yayınlanan son içerikler</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentPosts?.length ? (
            <div className="space-y-3">
              {stats.recentPosts.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{p.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.persona?.name || '—'} • {timeAgo(p.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      p.status === 'PUBLISHED'
                        ? 'success'
                        : p.status === 'PENDING_APPROVAL'
                        ? 'warning'
                        : p.status === 'FAILED'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Henüz gönderi yok. &quot;Şimdi İçerik Üret&quot; ile başla.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
