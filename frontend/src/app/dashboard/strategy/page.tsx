'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
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
const WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export default function StrategyPage() {
  const [strategy, setStrategy] = useState<any>(null);
  const [form, setForm] = useState({ positioningStatement: '', targetAudience: '', voiceDos: '', voiceDonts: '' });
  const [cadence, setCadence] = useState<any[]>([]);
  const [checkingDrift, setCheckingDrift] = useState(false);

  const [pillarOpen, setPillarOpen] = useState(false);
  const [editingPillar, setEditingPillar] = useState<any | null>(null);
  const [pillarForm, setPillarForm] = useState({ name: '', description: '', targetPercentage: 20, topicBank: '' });

  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [cadenceForm, setCadenceForm] = useState({ platform: 'TWITTER', weekday: 1, timeOfDay: '09:00' });

  async function load() {
    const data = await api.get<any>('/api/strategy');
    setStrategy(data);
    if (data) {
      setForm({
        positioningStatement: data.positioningStatement || '',
        targetAudience: data.targetAudience || '',
        voiceDos: (data.voiceDos || []).join('\n'),
        voiceDonts: (data.voiceDonts || []).join('\n'),
      });
    }
    const c = await api.get<any[]>('/api/strategy/cadence');
    setCadence(c);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function saveStrategy() {
    try {
      const data = await api.put('/api/strategy', {
        positioningStatement: form.positioningStatement || undefined,
        targetAudience: form.targetAudience || undefined,
        voiceDos: form.voiceDos.split('\n').map((s) => s.trim()).filter(Boolean),
        voiceDonts: form.voiceDonts.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      setStrategy(data);
      toast.success('Strateji kaydedildi');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function runDriftCheck() {
    setCheckingDrift(true);
    try {
      const data = await api.post('/api/strategy/drift-check');
      setStrategy(data);
      toast.success('Denetim tamamlandı');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCheckingDrift(false);
    }
  }

  function openNewPillar() {
    setEditingPillar(null);
    setPillarForm({ name: '', description: '', targetPercentage: 20, topicBank: '' });
    setPillarOpen(true);
  }

  function openEditPillar(p: any) {
    setEditingPillar(p);
    setPillarForm({
      name: p.name,
      description: p.description || '',
      targetPercentage: p.targetPercentage,
      topicBank: (p.topicBank || []).join(', '),
    });
    setPillarOpen(true);
  }

  async function savePillar() {
    try {
      const payload = {
        name: pillarForm.name,
        description: pillarForm.description || undefined,
        targetPercentage: Number(pillarForm.targetPercentage),
        topicBank: pillarForm.topicBank.split(',').map((s) => s.trim()).filter(Boolean),
      };
      if (editingPillar) await api.put(`/api/strategy/pillars/${editingPillar.id}`, payload);
      else await api.post('/api/strategy/pillars', payload);
      toast.success(editingPillar ? 'Güncellendi' : 'Oluşturuldu');
      setPillarOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function removePillar(id: string) {
    if (!confirm('Bu sütunu silmek istediğine emin misin?')) return;
    try {
      await api.del(`/api/strategy/pillars/${id}`);
      toast.success('Silindi');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function addCadence() {
    try {
      await api.post('/api/strategy/cadence', cadenceForm);
      toast.success('Kural eklendi');
      setCadenceOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function removeCadence(id: string) {
    try {
      await api.del(`/api/strategy/cadence/${id}`);
      toast.success('Silindi');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const totalPct = (strategy?.pillars || [])
    .filter((p: any) => p.active !== false)
    .reduce((s: number, p: any) => s + p.targetPercentage, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marka Stratejisi</h1>
        <p className="text-sm text-muted-foreground">
          Pozisyonlama, ses rehberi ve içerik sütunları — tüm içerik üretimi buradan beslenir.
        </p>
      </div>

      <Tabs defaultValue="voice">
        <TabsList>
          <TabsTrigger value="voice">Marka Sesi</TabsTrigger>
          <TabsTrigger value="pillars">İçerik Sütunları</TabsTrigger>
          <TabsTrigger value="cadence">Yayın Sıklığı</TabsTrigger>
        </TabsList>

        <TabsContent value="voice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pozisyonlama &amp; Ses Rehberi</CardTitle>
              <CardDescription>Tek cümlelik konumlandırma + yapılması/yapılmaması gerekenler.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Pozisyonlama cümlesi (örn: X yapan Y için Z sağlayan tek çözüm)"
                value={form.positioningStatement}
                onChange={(e) => setForm({ ...form, positioningStatement: e.target.value })}
              />
              <Input
                placeholder="Hedef kitle"
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Textarea
                  placeholder="Yapılması gerekenler (her satıra bir madde)"
                  rows={5}
                  value={form.voiceDos}
                  onChange={(e) => setForm({ ...form, voiceDos: e.target.value })}
                />
                <Textarea
                  placeholder="Yapılmaması gerekenler (her satıra bir madde)"
                  rows={5}
                  value={form.voiceDonts}
                  onChange={(e) => setForm({ ...form, voiceDonts: e.target.value })}
                />
              </div>
              <Button variant="gradient" onClick={saveStrategy}>
                Kaydet
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ses Sapması Denetimi</CardTitle>
                  <CardDescription>Son gönderileri yukarıdaki kurallara göre AI ile denetle.</CardDescription>
                </div>
                <Button variant="outline" onClick={runDriftCheck} disabled={!strategy || checkingDrift}>
                  {checkingDrift ? 'Denetleniyor...' : 'Şimdi Denetle'}
                </Button>
              </div>
            </CardHeader>
            {strategy?.driftNotes && (
              <CardContent>
                <p className="whitespace-pre-line text-sm">{strategy.driftNotes}</p>
                {strategy.driftCheckedAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Son denetim: {new Date(strategy.driftCheckedAt).toLocaleString('tr-TR')}
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="pillars" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Toplam hedef dağılım:{' '}
              <span className={totalPct > 100 ? 'font-semibold text-destructive' : ''}>{totalPct}%</span>
            </p>
            <Dialog open={pillarOpen} onOpenChange={setPillarOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient" onClick={openNewPillar} disabled={!strategy}>
                  <Plus className="mr-2 h-4 w-4" /> Yeni Sütun
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingPillar ? 'Sütunu Düzenle' : 'Yeni İçerik Sütunu'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Sütun adı (örn: Eğitim)"
                    value={pillarForm.name}
                    onChange={(e) => setPillarForm({ ...pillarForm, name: e.target.value })}
                  />
                  <Textarea
                    placeholder="Açıklama (opsiyonel)"
                    value={pillarForm.description}
                    onChange={(e) => setPillarForm({ ...pillarForm, description: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="Hedef yüzde"
                    value={pillarForm.targetPercentage}
                    onChange={(e) => setPillarForm({ ...pillarForm, targetPercentage: Number(e.target.value) })}
                  />
                  <Input
                    placeholder="Konu bankası (virgülle ayır)"
                    value={pillarForm.topicBank}
                    onChange={(e) => setPillarForm({ ...pillarForm, topicBank: e.target.value })}
                  />
                  <Button variant="gradient" className="w-full" onClick={savePillar}>
                    Kaydet
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {!strategy && (
            <p className="text-sm text-muted-foreground">
              Sütun eklemeden önce “Marka Sesi” sekmesinden stratejini kaydet.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(strategy?.pillars || []).map((p: any) => (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    <Badge variant="info">%{p.targetPercentage}</Badge>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                </CardHeader>
                <CardContent>
                  {p.topicBank?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {p.topicBank.map((t: string) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditPillar(p)}>
                      <Edit className="mr-1 h-3.5 w-3.5" /> Düzenle
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removePillar(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cadence" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Platform × gün × saat yayın sıklığı matrisi.</p>
            <Dialog open={cadenceOpen} onOpenChange={setCadenceOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient">
                  <Plus className="mr-2 h-4 w-4" /> Yeni Kural
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Yeni Yayın Kuralı</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={cadenceForm.platform}
                    onChange={(e) => setCadenceForm({ ...cadenceForm, platform: e.target.value })}
                  >
                    {Object.entries(PLATFORM_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={cadenceForm.weekday}
                    onChange={(e) => setCadenceForm({ ...cadenceForm, weekday: Number(e.target.value) })}
                  >
                    {WEEKDAYS.map((w, i) => (
                      <option key={i} value={i}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="time"
                    value={cadenceForm.timeOfDay}
                    onChange={(e) => setCadenceForm({ ...cadenceForm, timeOfDay: e.target.value })}
                  />
                  <Button variant="gradient" className="w-full" onClick={addCadence}>
                    Ekle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-2">
            {cadence.map((c: any) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">{PLATFORM_LABELS[c.platform] || c.platform}</Badge>
                    <span>{WEEKDAYS[c.weekday]}</span>
                    <span className="text-muted-foreground">{c.timeOfDay}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeCadence(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {cadence.length === 0 && <p className="text-sm text-muted-foreground">Henüz kural eklenmedi.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
