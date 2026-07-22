'use client';
import { useEffect, useState } from 'react';
import { Plus, Wand2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const VERDICT_LABELS: Record<string, string> = {
  ACT_NOW: 'Hemen Harekete Geç',
  PLAN: 'Planla',
  WATCH: 'İzle',
  PASS: 'Geç',
};
const VERDICT_BADGE: Record<string, any> = {
  ACT_NOW: 'destructive',
  PLAN: 'warning',
  WATCH: 'info',
  PASS: 'outline',
};

function respondByLabel(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Süre doldu';
  const hours = Math.round(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours} saat kaldı`;
  return `${Math.round(hours / 24)} gün kaldı`;
}

export default function TrendsPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ title: '', description: '', sourceUrl: '' });
  const [generatingBriefing, setGeneratingBriefing] = useState<string | null>(null);

  async function loadSignals() {
    const data = await api.get<any[]>('/api/trends');
    setSignals(data);
  }

  async function loadReports() {
    const data = await api.get<any[]>('/api/trends/briefing');
    setReports(data);
  }

  useEffect(() => {
    loadSignals().catch(console.error);
    loadReports().catch(console.error);
  }, []);

  async function scan() {
    setScanning(true);
    try {
      const result = await api.post<{ created: number }>('/api/trends/scan');
      toast.success(result.created ? `${result.created} yeni sinyal bulundu` : 'Yeni sinyal yok (henüz taranmamış haber kalmadı)');
      loadSignals();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScanning(false);
    }
  }

  async function addManual() {
    try {
      await api.post('/api/trends', manualForm);
      toast.success('Sinyal eklendi');
      setManualOpen(false);
      setManualForm({ title: '', description: '', sourceUrl: '' });
      loadSignals();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function draft(id: string) {
    setDrafting(id);
    try {
      await api.post(`/api/trends/${id}/draft`);
      toast.success("Taslak oluşturuldu — İçerik Takvimi'nde onay bekliyor");
      loadSignals();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDrafting(null);
    }
  }

  async function generateBriefing(type: string) {
    setGeneratingBriefing(type);
    try {
      await api.post('/api/trends/briefing/generate', { type });
      toast.success('Özet oluşturuldu');
      loadReports();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingBriefing(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trendler</h1>
        <p className="text-sm text-muted-foreground">Haber akışından skorlanan sinyaller ve founder özetleri.</p>
      </div>

      <Tabs defaultValue="signals">
        <TabsList>
          <TabsTrigger value="signals">Sinyaller</TabsTrigger>
          <TabsTrigger value="briefings">Briefing'ler</TabsTrigger>
        </TabsList>

        <TabsContent value="signals" className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="gradient" disabled={scanning} onClick={scan}>
              <TrendingUp className="mr-2 h-4 w-4" />
              {scanning ? 'Taranıyor...' : 'Haber Akışını Tara'}
            </Button>
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Manuel Sinyal Ekle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Manuel Trend Sinyali</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Başlık"
                    value={manualForm.title}
                    onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                  />
                  <Textarea
                    placeholder="Açıklama (opsiyonel)"
                    value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  />
                  <Input
                    placeholder="Kaynak URL (opsiyonel)"
                    value={manualForm.sourceUrl}
                    onChange={(e) => setManualForm({ ...manualForm, sourceUrl: e.target.value })}
                  />
                  <Button variant="gradient" className="w-full" disabled={!manualForm.title} onClick={addManual}>
                    Skorla ve Ekle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {signals.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Henüz sinyal yok. "Haber Akışını Tara"ya bas veya manuel ekle.
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {signals.map((s: any) => (
              <Card key={s.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <Badge variant={VERDICT_BADGE[s.verdict]}>{VERDICT_LABELS[s.verdict]}</Badge>
                  </div>
                  {s.description && <CardDescription className="line-clamp-2">{s.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Alaka: {s.relevanceScore}/10</span>
                    <span>Özgünlük: {s.authenticityScore}/10</span>
                    <span>Eylem: {s.actionabilityScore}/10</span>
                    <span className="font-semibold text-foreground">Toplam: {s.totalScore}/30</span>
                  </div>
                  {s.respondByAt && <p className="mb-3 text-xs text-amber-500">⏱ {respondByLabel(s.respondByAt)}</p>}
                  {s.generatedPostId ? (
                    <Badge variant="success">Taslak oluşturuldu</Badge>
                  ) : (
                    <Button size="sm" variant="outline" disabled={drafting === s.id} onClick={() => draft(s.id)}>
                      <Wand2 className="mr-1 h-3.5 w-3.5" /> {drafting === s.id ? 'Üretiliyor...' : 'Taslak Oluştur'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="briefings" className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="gradient"
              disabled={!!generatingBriefing}
              onClick={() => generateBriefing('FOUNDER_BRIEFING_DAILY')}
            >
              {generatingBriefing === 'FOUNDER_BRIEFING_DAILY' ? 'Oluşturuluyor...' : 'Günlük Özet Oluştur'}
            </Button>
            <Button
              variant="outline"
              disabled={!!generatingBriefing}
              onClick={() => generateBriefing('FOUNDER_BRIEFING_WEEKLY')}
            >
              {generatingBriefing === 'FOUNDER_BRIEFING_WEEKLY' ? 'Oluşturuluyor...' : 'Haftalık Özet Oluştur'}
            </Button>
          </div>
          {reports.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">Henüz özet üretilmedi.</CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {reports.map((r: any) => (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {r.type === 'FOUNDER_BRIEFING_DAILY' ? 'Günlük Özet' : 'Haftalık Özet'}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm">{r.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
