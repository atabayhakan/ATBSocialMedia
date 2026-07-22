'use client';
import { useEffect, useState } from 'react';
import { Plus, Wand2, Check, X, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const PLATFORM_LABELS: Record<string, string> = {
  TWITTER: 'X/Twitter',
  LINKEDIN: 'LinkedIn',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  TELEGRAM: 'Telegram',
  BLUESKY: 'Bluesky',
};
const KIND_LABELS: Record<string, string> = { DM: 'DM', MENTION: 'Etiketleme', COMMENT: 'Yorum' };
const PRIORITY_BADGE: Record<string, any> = { URGENT: 'destructive', HIGH: 'warning', MEDIUM: 'info', LOW: 'outline' };
const SEVERITY_BADGE: Record<string, any> = { CRITICAL: 'destructive', HIGH: 'warning', MEDIUM: 'info', LOW: 'outline' };
const TRIAGE_CATEGORY_LABELS: Record<string, string> = {
  LEGITIMATE_COMPLAINT: 'Haklı Şikayet',
  FAIR_CRITICISM: 'Adil Eleştiri',
  MISUNDERSTANDING: 'Yanlış Anlaşılma',
  TROLL: 'Trol',
  COORDINATED_ATTACK: 'Koordineli Saldırı',
};

function respondByLabel(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'SLA süresi doldu';
  const hours = Math.round(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours} saat kaldı`;
  return `${Math.round(hours / 24)} gün kaldı`;
}

export default function EngagementPage() {
  const [items, setItems] = useState<any[]>([]);
  const [crises, setCrises] = useState<any[]>([]);
  const [impersonators, setImpersonators] = useState<any[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ platform: 'TWITTER', kind: 'DM', authorHandle: '', content: '', permalink: '' });

  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [escalateForm, setEscalateForm] = useState({ title: '', triageCategory: 'LEGITIMATE_COMPLAINT', severity: 'MEDIUM' });

  const [apologizingId, setApologizingId] = useState<string | null>(null);
  const [impersonatorForm, setImpersonatorForm] = useState({ platform: 'TWITTER', impersonatingHandle: '' });

  async function loadItems() {
    setItems(await api.get<any[]>('/api/engagement'));
  }
  async function loadCrises() {
    setCrises(await api.get<any[]>('/api/crisis'));
  }
  async function loadImpersonators() {
    setImpersonators(await api.get<any[]>('/api/crisis/impersonators'));
  }

  useEffect(() => {
    loadItems().catch(console.error);
    loadCrises().catch(console.error);
    loadImpersonators().catch(console.error);
  }, []);

  async function addItem() {
    try {
      await api.post('/api/engagement', addForm);
      toast.success('Eklendi ve triyaj edildi');
      setAddOpen(false);
      setAddForm({ platform: 'TWITTER', kind: 'DM', authorHandle: '', content: '', permalink: '' });
      loadItems();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function draftReply(id: string) {
    setDraftingId(id);
    try {
      const item = await api.post<any>(`/api/engagement/${id}/draft-reply`);
      setReplyDrafts((d) => ({ ...d, [id]: item.replyBody }));
      loadItems();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDraftingId(null);
    }
  }

  async function sendReply(id: string) {
    try {
      await api.post(`/api/engagement/${id}/reply`, { replyBody: replyDrafts[id] });
      toast.success('Yanıtlandı olarak işaretlendi');
      loadItems();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function ignoreItem(id: string) {
    try {
      await api.put(`/api/engagement/${id}/status`, { status: 'IGNORED' });
      toast.success('Yoksayıldı');
      loadItems();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function openEscalate(id: string) {
    setEscalatingId(id);
    setEscalateForm({ title: '', triageCategory: 'LEGITIMATE_COMPLAINT', severity: 'MEDIUM' });
  }

  async function submitEscalate() {
    if (!escalatingId) return;
    try {
      await api.post(`/api/engagement/${escalatingId}/escalate`, escalateForm);
      toast.success('Krize yükseltildi');
      setEscalatingId(null);
      loadItems();
      loadCrises();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function draftApology(id: string) {
    setApologizingId(id);
    try {
      await api.post(`/api/crisis/${id}/apology`);
      toast.success('Özür taslağı oluşturuldu');
      loadCrises();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setApologizingId(null);
    }
  }

  async function resolveCrisis(id: string) {
    try {
      await api.post(`/api/crisis/${id}/resolve`);
      toast.success('Çözüldü olarak işaretlendi');
      loadCrises();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function addImpersonator() {
    try {
      await api.post('/api/crisis/impersonators', impersonatorForm);
      toast.success('Eklendi');
      setImpersonatorForm({ platform: 'TWITTER', impersonatingHandle: '' });
      loadImpersonators();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const activeItems = items.filter((i: any) => i.status === 'NEW' || i.status === 'TRIAGED');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Etkileşim</h1>
          <p className="text-sm text-muted-foreground">DM, etiketleme ve yorumları triyaj et, krizleri yönet.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient">
              <Plus className="mr-2 h-4 w-4" /> Manuel Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Gelen Mesajı Ekle</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={addForm.platform}
                onChange={(e) => setAddForm({ ...addForm, platform: e.target.value })}
              >
                {Object.entries(PLATFORM_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={addForm.kind}
                onChange={(e) => setAddForm({ ...addForm, kind: e.target.value })}
              >
                {Object.entries(KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Yazar (@handle)"
                value={addForm.authorHandle}
                onChange={(e) => setAddForm({ ...addForm, authorHandle: e.target.value })}
              />
              <Textarea
                placeholder="İçerik"
                value={addForm.content}
                onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
              />
              <Input
                placeholder="Bağlantı (opsiyonel)"
                value={addForm.permalink}
                onChange={(e) => setAddForm({ ...addForm, permalink: e.target.value })}
              />
              <Button
                variant="gradient"
                className="w-full"
                disabled={!addForm.authorHandle || !addForm.content}
                onClick={addItem}
              >
                Ekle ve Triyaj Et
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Gelen Kutusu</TabsTrigger>
          <TabsTrigger value="crisis">Kriz Durumları</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-3">
          {items.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Henüz kayıt yok. "Manuel Ekle"yle bir DM/etiketleme/yorum yapıştır.
              </CardContent>
            </Card>
          )}
          {items.map((item: any) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{item.authorHandle}</CardTitle>
                    <CardDescription>
                      {PLATFORM_LABELS[item.platform] || item.platform} · {KIND_LABELS[item.kind]}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {item.category && <Badge variant="secondary">{item.category}</Badge>}
                    {item.priority && <Badge variant={PRIORITY_BADGE[item.priority]}>{item.priority}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{item.content}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.status}</Badge>
                  {item.slaDueAt && activeItems.some((a: any) => a.id === item.id) && (
                    <span className="text-xs text-amber-500">⏱ {respondByLabel(item.slaDueAt)}</span>
                  )}
                </div>

                {replyDrafts[item.id] !== undefined && (
                  <Textarea
                    rows={3}
                    value={replyDrafts[item.id]}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  />
                )}

                {activeItems.some((a: any) => a.id === item.id) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" disabled={draftingId === item.id} onClick={() => draftReply(item.id)}>
                      <Wand2 className="mr-1 h-3.5 w-3.5" /> {draftingId === item.id ? 'Öneriliyor...' : 'Yanıt Öner'}
                    </Button>
                    {replyDrafts[item.id] !== undefined && (
                      <Button size="sm" variant="gradient" onClick={() => sendReply(item.id)}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Yanıtlandı İşaretle
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => ignoreItem(item.id)}>
                      <X className="mr-1 h-3.5 w-3.5" /> Yoksay
                    </Button>
                    <Dialog open={escalatingId === item.id} onOpenChange={(o) => !o && setEscalatingId(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="destructive" onClick={() => openEscalate(item.id)}>
                          <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Krize Yükselt
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Krize Yükselt</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Input
                            placeholder="Başlık"
                            value={escalateForm.title}
                            onChange={(e) => setEscalateForm({ ...escalateForm, title: e.target.value })}
                          />
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={escalateForm.triageCategory}
                            onChange={(e) => setEscalateForm({ ...escalateForm, triageCategory: e.target.value })}
                          >
                            {Object.entries(TRIAGE_CATEGORY_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={escalateForm.severity}
                            onChange={(e) => setEscalateForm({ ...escalateForm, severity: e.target.value })}
                          >
                            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="gradient"
                            className="w-full"
                            disabled={!escalateForm.title}
                            onClick={submitEscalate}
                          >
                            Krize Dönüştür
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="crisis" className="space-y-4">
          <div className="space-y-3">
            {crises.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">Henüz kriz yok.</CardContent>
              </Card>
            )}
            {crises.map((c: any) => (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <Badge variant={SEVERITY_BADGE[c.severity]}>{c.severity}</Badge>
                  </div>
                  <CardDescription>
                    {TRIAGE_CATEGORY_LABELS[c.triageCategory] || c.triageCategory} · {c.items?.length || 0} bağlı kayıt
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant={c.status === 'RESOLVED' ? 'success' : 'outline'}>{c.status}</Badge>
                  {c.apologyDraft && (
                    <p className="whitespace-pre-line rounded-md border border-border p-2 text-sm">{c.apologyDraft}</p>
                  )}
                  {c.status !== 'RESOLVED' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={apologizingId === c.id}
                        onClick={() => draftApology(c.id)}
                      >
                        {apologizingId === c.id ? 'Oluşturuluyor...' : 'Özür Taslağı Oluştur'}
                      </Button>
                      <Button size="sm" variant="gradient" onClick={() => resolveCrisis(c.id)}>
                        Çözüldü İşaretle
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sahte Hesaplar</CardTitle>
              <CardDescription>Marka kimliğine bürünen hesapları takip et.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={impersonatorForm.platform}
                  onChange={(e) => setImpersonatorForm({ ...impersonatorForm, platform: e.target.value })}
                >
                  {Object.entries(PLATFORM_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="@sahte-hesap"
                  value={impersonatorForm.impersonatingHandle}
                  onChange={(e) => setImpersonatorForm({ ...impersonatorForm, impersonatingHandle: e.target.value })}
                />
                <Button variant="outline" disabled={!impersonatorForm.impersonatingHandle} onClick={addImpersonator}>
                  Ekle
                </Button>
              </div>
              <div className="space-y-2">
                {impersonators.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                    <span>
                      {PLATFORM_LABELS[r.platform] || r.platform} · {r.impersonatingHandle}
                    </span>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                ))}
                {impersonators.length === 0 && <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
