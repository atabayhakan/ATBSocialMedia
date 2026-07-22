'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  X,
  RotateCcw,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Music2,
  Send,
  Bird,
  Trash2,
  Sparkles,
  Edit,
  Wand2,
  Megaphone,
  Recycle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, timeAgo } from '@/lib/utils';

const REPURPOSE_TYPE_LABELS: Record<string, string> = {
  BLOG: 'Blog Yazısı',
  PODCAST_TRANSCRIPT: 'Podcast Transkripti',
  NEWSLETTER: 'Bülten (Newsletter)',
  MANUAL_TEXT: 'Manuel Metin',
};

const platformIcons: Record<string, any> = {
  TWITTER: Twitter,
  LINKEDIN: Linkedin,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TIKTOK: Music2,
  TELEGRAM: Send,
  BLUESKY: Bird,
};
const PLATFORM_LABELS: Record<string, string> = {
  TWITTER: 'X/Twitter',
  LINKEDIN: 'LinkedIn',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  TELEGRAM: 'Telegram',
  BLUESKY: 'Bluesky',
};

export default function CalendarPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [tab, setTab] = useState('PENDING_APPROVAL');
  // Bir aksiyon uçuştayken ilgili gönderinin butonlarını kilitler (çift-submit koruması).
  const [acting, setActing] = useState<string | null>(null);

  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const [repurposing, setRepurposing] = useState(false);
  const [repurposeForm, setRepurposeForm] = useState({ type: 'BLOG', title: '', rawText: '' });

  // Satır-içi düzenleme: aynı anda tek gönderi düzenlenebilir.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', body: '' });
  const [hookSuggestions, setHookSuggestions] = useState<{ hook: string; score: number }[] | null>(null);
  const [ctaSuggestion, setCtaSuggestion] = useState<{ cta: string; rationale: string } | null>(null);
  const [loadingHooks, setLoadingHooks] = useState(false);
  const [loadingCta, setLoadingCta] = useState(false);

  async function load() {
    if (tab === 'SLOTS') {
      const data = await api.get<any[]>('/api/planner/slots');
      setSlots(data);
      return;
    }
    const data = await api.get<any[]>(`/api/posts?status=${tab}`);
    setPosts(data);
  }

  useEffect(() => {
    // Sekme hızlı değişirse eski isteğin cevabı yeni sekmenin verisini ezmesin (ignore guard).
    let active = true;
    if (tab === 'SLOTS') {
      api
        .get<any[]>('/api/planner/slots')
        .then((data) => active && setSlots(data))
        .catch((e) => active && console.error(e));
    } else {
      api
        .get<any[]>(`/api/posts?status=${tab}`)
        .then((data) => active && setPosts(data))
        .catch((e) => active && console.error(e));
    }
    return () => {
      active = false;
    };
  }, [tab]);

  async function generateSlots() {
    setGeneratingSlots(true);
    try {
      const result = await api.post<{ created: number }>('/api/planner/slots/generate');
      toast.success(result.created ? `${result.created} yeni slot oluşturuldu` : 'Yeni slot yok (zaten güncel)');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingSlots(false);
    }
  }

  async function removeSlot(id: string) {
    try {
      await api.del(`/api/planner/slots/${id}`);
      toast.success('Slot silindi');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function runRepurpose() {
    setRepurposing(true);
    try {
      const result = await api.post<{ postCount: number }>('/api/repurpose', repurposeForm);
      toast.success(`${result.postCount} taslak üretildi — Onay Bekliyor sekmesinde`);
      setRepurposeOpen(false);
      setRepurposeForm({ type: 'BLOG', title: '', rawText: '' });
      if (tab === 'PENDING_APPROVAL') load();
      else setTab('PENDING_APPROVAL');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRepurposing(false);
    }
  }

  function startEdit(p: any) {
    setEditingId(p.id);
    setEditForm({ title: p.title, body: p.body });
    setHookSuggestions(null);
    setCtaSuggestion(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setHookSuggestions(null);
    setCtaSuggestion(null);
  }

  async function saveEdit(id: string) {
    try {
      await api.put(`/api/posts/${id}`, editForm);
      toast.success('Kaydedildi');
      setEditingId(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function fetchHooks() {
    setLoadingHooks(true);
    try {
      const hooks = await api.post<{ hook: string; score: number }[]>('/api/content-tools/hooks', editForm);
      setHookSuggestions(hooks);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingHooks(false);
    }
  }

  async function fetchCta() {
    setLoadingCta(true);
    try {
      const cta = await api.post<{ cta: string; rationale: string }>('/api/content-tools/cta', editForm);
      setCtaSuggestion(cta);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingCta(false);
    }
  }

  async function runAction(id: string, fn: () => Promise<void>, okMsg: string) {
    if (acting) return;
    setActing(id);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'İşlem başarısız');
    } finally {
      setActing(null);
    }
  }

  const approve = (id: string) => runAction(id, () => api.post(`/api/posts/${id}/approve`, {}), 'Onaylandı');
  const reject = (id: string) => runAction(id, () => api.post(`/api/posts/${id}/reject`, {}), 'Reddedildi');
  const publishNow = (id: string) => runAction(id, () => api.post(`/api/posts/${id}/publish`, {}), 'Yayınlandı');
  const retryTarget = (postId: string, targetId: string) =>
    runAction(postId, () => api.post(`/api/posts/${postId}/publish`, { targetId }), 'Yeniden denendi');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">İçerik Takvimi</h1>
          <p className="text-sm text-muted-foreground">Bekleyen taslakları incele, onayla veya reddet.</p>
        </div>
        <Dialog open={repurposeOpen} onOpenChange={setRepurposeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Recycle className="mr-2 h-4 w-4" /> Yeniden Kullan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Uzun İçerikten Taslak Üret</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Blog yazısı, podcast transkripti veya bülten metni yapıştır — AI bunu birkaç bağımsız sosyal medya
                taslağına böler ve onay kuyruğuna ekler.
              </p>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={repurposeForm.type}
                onChange={(e) => setRepurposeForm({ ...repurposeForm, type: e.target.value })}
              >
                {Object.entries(REPURPOSE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Kaynak başlığı (örn: '2026 Sosyal Medya Trendleri' blog yazısı)"
                value={repurposeForm.title}
                onChange={(e) => setRepurposeForm({ ...repurposeForm, title: e.target.value })}
              />
              <Textarea
                placeholder="Ham metni buraya yapıştır (en az birkaç paragraf)"
                rows={10}
                value={repurposeForm.rawText}
                onChange={(e) => setRepurposeForm({ ...repurposeForm, rawText: e.target.value })}
              />
              <Button
                variant="gradient"
                className="w-full"
                disabled={repurposing || !repurposeForm.title || repurposeForm.rawText.length < 20}
                onClick={runRepurpose}
              >
                {repurposing ? 'Taslaklar üretiliyor... (biraz sürebilir)' : 'Taslaklar Üret'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="PENDING_APPROVAL">Onay Bekliyor</TabsTrigger>
          <TabsTrigger value="APPROVED">Onaylandı</TabsTrigger>
          <TabsTrigger value="SCHEDULED">Zamanlandı</TabsTrigger>
          <TabsTrigger value="PUBLISHED">Yayında</TabsTrigger>
          <TabsTrigger value="REJECTED">Reddedildi</TabsTrigger>
          <TabsTrigger value="SLOTS">Planlanan Slotlar</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3">
          {tab === 'SLOTS' ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Marka Stratejisi'ndeki yayın sıklığı kurallarından üretilen önümüzdeki 3 haftalık slotlar.
                </p>
                <Button size="sm" variant="gradient" disabled={generatingSlots} onClick={generateSlots}>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  {generatingSlots ? 'Üretiliyor...' : "Cadence'ten Slot Üret"}
                </Button>
              </div>
              {slots.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Henüz slot yok. Önce Marka Stratejisi &gt; Yayın Sıklığı'ndan kural ekle, sonra "Cadence'ten Slot
                    Üret"e bas.
                  </CardContent>
                </Card>
              )}
              <div className="space-y-2">
                {slots.map((s: any) => {
                  const Icon = platformIcons[s.platform];
                  return (
                    <Card key={s.id}>
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3 text-sm">
                          <Badge variant="outline" className="flex items-center gap-1">
                            {Icon && <Icon className="h-3 w-3" />}
                            {PLATFORM_LABELS[s.platform] || s.platform}
                          </Badge>
                          <span>{formatDate(s.scheduledFor)}</span>
                          {s.pillarName && <Badge variant="secondary">{s.pillarName}</Badge>}
                          <Badge variant={s.status === 'FILLED' ? 'success' : 'outline'}>
                            {s.status === 'FILLED' ? 'Dolu' : 'Boş'}
                          </Badge>
                        </div>
                        {s.status !== 'FILLED' && (
                          <Button size="sm" variant="ghost" onClick={() => removeSlot(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {posts.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Bu kategoride içerik yok.
                  </CardContent>
                </Card>
              )}
              {posts.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg">{p.title}</CardTitle>
                        <CardDescription>
                          {p.persona?.name || '—'} • {timeAgo(p.createdAt)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.targets?.map((t: any) => {
                          const Icon = platformIcons[t.platform];
                          if (!Icon) return null;
                          if (t.status === 'FAILED') {
                            return (
                              <button
                                key={t.id}
                                title={t.error || 'Yayınlanamadı — tekrar dene'}
                                disabled={acting === p.id}
                                onClick={() => retryTarget(p.id, t.id)}
                                className="flex items-center gap-1 rounded-md bg-rose-500/15 p-1.5 text-rose-400 hover:bg-rose-500/25 disabled:opacity-50"
                              >
                                <Icon className="h-3.5 w-3.5" />
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            );
                          }
                          return (
                            <div key={t.id} className="rounded-md bg-muted p-1.5">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingId === p.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        />
                        <Textarea
                          rows={5}
                          value={editForm.body}
                          onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" disabled={loadingHooks} onClick={fetchHooks}>
                            <Wand2 className="mr-1 h-3.5 w-3.5" /> {loadingHooks ? 'Öneriliyor...' : 'Hook Öner'}
                          </Button>
                          <Button size="sm" variant="outline" disabled={loadingCta} onClick={fetchCta}>
                            <Megaphone className="mr-1 h-3.5 w-3.5" /> {loadingCta ? 'Öneriliyor...' : 'CTA Öner'}
                          </Button>
                        </div>
                        {hookSuggestions && (
                          <div className="space-y-1 rounded-md border border-border p-2">
                            {hookSuggestions.map((h, i) => (
                              <button
                                key={i}
                                onClick={() => setEditForm({ ...editForm, title: h.hook })}
                                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-accent"
                              >
                                <span>{h.hook}</span>
                                <Badge variant="info">{h.score}/10</Badge>
                              </button>
                            ))}
                          </div>
                        )}
                        {ctaSuggestion && (
                          <button
                            onClick={() => setEditForm({ ...editForm, body: `${editForm.body}\n\n${ctaSuggestion.cta}` })}
                            className="w-full rounded-md border border-border p-2 text-left text-sm hover:bg-accent"
                          >
                            <span className="font-medium">{ctaSuggestion.cta}</span>
                            <p className="text-xs text-muted-foreground">{ctaSuggestion.rationale}</p>
                          </button>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" variant="gradient" onClick={() => saveEdit(p.id)}>
                            Kaydet
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            Vazgeç
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-line text-sm">{p.body}</p>
                        {p.hashtags?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {p.hashtags.map((h: string) => (
                              <Badge key={h} variant="secondary">
                                {h}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {p.mediaUrls?.length > 0 && (
                          <div className="mt-3 flex gap-2">
                            {p.mediaUrls.map((m: string) => (
                              <img key={m} src={m} className="h-20 w-20 rounded object-cover" alt="" />
                            ))}
                          </div>
                        )}
                        {p.scheduledAt && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            📅 Zamanlanmış: {formatDate(p.scheduledAt)}
                          </p>
                        )}
                        <div className="mt-4 flex gap-2">
                          {tab === 'PENDING_APPROVAL' && (
                            <>
                              <Button
                                size="sm"
                                variant="gradient"
                                disabled={acting === p.id}
                                onClick={() => approve(p.id)}
                              >
                                <Check className="mr-1 h-3.5 w-3.5" /> Onayla
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={acting === p.id}
                                onClick={() => reject(p.id)}
                              >
                                <X className="mr-1 h-3.5 w-3.5" /> Reddet
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                                <Edit className="mr-1 h-3.5 w-3.5" /> Düzenle
                              </Button>
                            </>
                          )}
                          {(tab === 'APPROVED' || tab === 'SCHEDULED') && (
                            <Button
                              size="sm"
                              variant="gradient"
                              disabled={acting === p.id}
                              onClick={() => publishNow(p.id)}
                            >
                              Şimdi Yayınla
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
