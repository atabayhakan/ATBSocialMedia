'use client';
import { useEffect, useState } from 'react';
import { Palette, CheckCircle2, ExternalLink, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function CanvaPage() {
  const [status, setStatus] = useState<{ connected: boolean } | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [fill, setFill] = useState({ title: '', body: '', hashtags: '', templateId: '' });

  async function load() {
    const s = await api.get<{ connected: boolean }>('/api/canva/status');
    setStatus(s);
    if (s.connected) {
      const t = await api.get<any[]>('/api/canva/templates');
      setTemplates(t);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function connect() {
    const r = await api.get<{ url: string }>('/api/canva/connect');
    window.location.href = r.url;
  }

  async function autofill() {
    try {
      const hashtags = fill.hashtags.split(/\s+/).filter(Boolean);
      const result = await api.post<{ id: string; exportUrl?: string }>('/api/canva/fill', {
        ...fill,
        hashtags,
        templateId: fill.templateId || undefined,
      });
      toast.success('Tasarım oluşturuldu: ' + result.id);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Canva Tasarım</h1>
        <p className="text-sm text-muted-foreground">
          Canva şablonlarını bağla, AI ürettiği metinleri otomatik yerleştirsin.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500">
              <Palette className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold">Canva Bağlantısı</p>
              <p className="text-sm text-muted-foreground">
                {status?.connected ? 'Hesabın bağlı, şablonlar kullanılabilir.' : 'Henüz bağlı değil.'}
              </p>
            </div>
          </div>
          {status?.connected ? (
            <Badge variant="success">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Bağlı
            </Badge>
          ) : (
            <Button variant="gradient" onClick={connect}>
              <ExternalLink className="mr-2 h-4 w-4" /> Canva ile Bağlan
            </Button>
          )}
        </CardContent>
      </Card>

      {status?.connected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Otomatik Metin Yerleştirme</CardTitle>
              <CardDescription>AI tarafından üretilen metinleri Canva şablonundaki yer tutuculara yerleştir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Başlık" value={fill.title} onChange={(e) => setFill({ ...fill, title: e.target.value })} />
              <Textarea placeholder="Gövde metni" value={fill.body} onChange={(e) => setFill({ ...fill, body: e.target.value })} />
              <Input placeholder="#etiket1 #etiket2" value={fill.hashtags} onChange={(e) => setFill({ ...fill, hashtags: e.target.value })} />
              <select
                value={fill.templateId}
                onChange={(e) => setFill({ ...fill, templateId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Şablon seç (ilkini kullan) —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || t.id}
                  </option>
                ))}
              </select>
              <Button variant="gradient" onClick={autofill}>
                <Wand2 className="mr-2 h-4 w-4" /> AI ile Doldur
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Şablonların</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {templates.map((t) => (
                  <div key={t.id} className="rounded-lg border border-border p-3">
                    {t.thumbnail?.url && (
                      <img src={t.thumbnail.url} alt={t.title} className="mb-2 h-32 w-full rounded object-cover" />
                    )}
                    <p className="truncate text-sm font-medium">{t.title || 'Adsız'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
