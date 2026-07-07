'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw, Rss } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'RSS', url: '', name: '', language: 'en', targetLanguage: '', intervalMin: 30 });

  async function load() {
    const data = await api.get<any[]>('/api/sources');
    setSources(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function add() {
    try {
      const { targetLanguage, ...rest } = form;
      await api.post('/api/sources', { ...rest, ...(targetLanguage ? { targetLanguage } : {}) });
      toast.success('Kaynak eklendi');
      setOpen(false);
      setForm({ type: 'RSS', url: '', name: '', language: 'en', targetLanguage: '', intervalMin: 30 });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(id: string) {
    await api.del(`/api/sources/${id}`);
    toast.success('Silindi');
    load();
  }

  async function refresh(id: string) {
    toast.promise(api.post(`/api/sources/${id}/refresh`), {
      loading: 'Taranıyor...',
      success: 'Tamamlandı',
      error: 'Hata',
    });
    setTimeout(load, 3000);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Haber Kaynakları</h1>
          <p className="text-sm text-muted-foreground">RSS, web scraping veya API ile içerik kaynaklarını yönet.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient">
              <Plus className="mr-2 h-4 w-4" /> Kaynak Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Haber Kaynağı</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="RSS">RSS</option>
                <option value="WEB_SCRAPE">Web Scrape</option>
                <option value="API">API</option>
              </select>
              <Input
                placeholder="İsim (örn: TechCrunch)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder="URL (https://...)"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Kaynak dili (en/tr)"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Dakika"
                  value={form.intervalMin}
                  onChange={(e) => setForm({ ...form, intervalMin: Number(e.target.value) })}
                />
              </div>
              <Input
                placeholder="Yayın dili (opsiyonel — boşsa Ayarlar'daki genel dil)"
                value={form.targetLanguage}
                onChange={(e) => setForm({ ...form, targetLanguage: e.target.value })}
              />
              <Button variant="gradient" className="w-full" onClick={add}>
                Ekle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/15">
                    <Rss className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <CardDescription className="truncate">{s.url}</CardDescription>
                  </div>
                </div>
                <Badge variant={s.active ? 'success' : 'secondary'}>{s.type}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {s.lastFetchedAt ? timeAgo(s.lastFetchedAt) : 'Henüz taranmadı'}
                </span>
                <span className="text-muted-foreground">{s._count?.items || 0} haber</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => refresh(s.id)}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Tara
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
