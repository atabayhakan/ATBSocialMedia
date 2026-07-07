'use client';
import { useEffect, useState } from 'react';
import { Smartphone, CheckCircle2, XCircle, MessageSquare, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/utils';

export default function WhatsAppPage() {
  const [status, setStatus] = useState<any>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [mode, setMode] = useState<'QR_BAILEYS' | 'BUSINESS_API'>('QR_BAILEYS');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testText, setTestText] = useState('');
  const [testTo, setTestTo] = useState('');

  async function load() {
    const s = await api.get<any>('/api/whatsapp/status');
    setStatus(s);
    if (s.qrAvailable) {
      const q = await api.get<{ qr: string }>('/api/whatsapp/qr');
      setQr(q.qr);
    } else {
      setQr(null);
    }
    if (s.isConnected) {
      const m = await api.get<any[]>('/api/whatsapp/messages');
      setMessages(m);
    }
  }

  useEffect(() => {
    load().catch(console.error);
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function saveConfig() {
    try {
      await api.post('/api/whatsapp/config', { mode, phoneNumber, phoneNumberId, accessToken });
      toast.success('Konfigürasyon kaydedildi');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function sendTest() {
    try {
      await api.post('/api/whatsapp/send', { to: testTo, text: testText, mode });
      toast.success('Mesaj gönderildi');
      setTestText('');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">İki yöntemden birini seç: QR (ücretsiz) veya Resmi Business API.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
                {status?.isConnected ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-rose-400" />}
              </div>
              <div>
                <p className="font-medium">{status?.isConnected ? 'Bağlı' : 'Bağlı değil'}</p>
                <p className="text-xs text-muted-foreground">
                  {status?.config?.mode === 'QR_BAILEYS' ? 'Baileys' : 'Business API'}
                </p>
              </div>
            </div>
            <Badge variant={status?.isConnected ? 'success' : 'destructive'}>
              {status?.isConnected ? 'ONLINE' : 'OFFLINE'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15">
                <MessageSquare className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="font-medium">Toplam Mesaj</p>
                <p className="text-xs text-muted-foreground">Son 100</p>
              </div>
            </div>
            <span className="text-2xl font-bold">{messages.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium">Mod</p>
                <p className="text-xs text-muted-foreground">Bağlantı yöntemi</p>
              </div>
            </div>
            <Badge variant="info">{status?.config?.mode || 'Tanımsız'}</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
        <TabsList>
          <TabsTrigger value="QR_BAILEYS">
            <Smartphone className="mr-2 h-4 w-4" /> Yöntem A — QR (Baileys)
          </TabsTrigger>
          <TabsTrigger value="BUSINESS_API">Yöntem B — Business API</TabsTrigger>
        </TabsList>

        <TabsContent value="QR_BAILEYS" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>QR ile Bağlan</CardTitle>
              <CardDescription>
                Backend başlatıldığında otomatik bir QR üretilir. WhatsApp → Bağlı Cihazlar → Cihaz Bağla ile okut.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {qr ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-xl border border-border bg-white p-4">
                    <img src={qr} alt="WhatsApp QR" className="h-64 w-64" />
                  </div>
                  <p className="text-sm text-muted-foreground">QR'ı telefonunla okut, 30 saniye içinde bağlantı kurulur.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Smartphone className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Şu an aktif bir QR yok. Backend'i WA_QR_ENABLED=true ile başlattığından emin ol.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="BUSINESS_API" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meta Business API Konfigürasyonu</CardTitle>
              <CardDescription>Meta Developer portalından aldığın bilgileri gir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Telefon Numarası (örn: +90...)" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              <Input placeholder="Phone Number ID" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
              <Input type="password" placeholder="Access Token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
              <Button variant="gradient" onClick={saveConfig}>
                Konfigürasyonu Kaydet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Test Mesajı Gönder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input placeholder="Alıcı (90... veya 90...@s.whatsapp.net)" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <Input placeholder="Mesaj" value={testText} onChange={(e) => setTestText(e.target.value)} className="md:col-span-2" />
          </div>
          <Button variant="gradient" className="mt-3" onClick={sendTest}>
            Gönder
          </Button>
        </CardContent>
      </Card>

      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Son Mesajlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {messages.slice(0, 20).map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md rounded-2xl px-4 py-2 text-sm ${
                      m.fromMe ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {m.body}
                    <div className="mt-1 text-[10px] opacity-70">{timeAgo(m.receivedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
