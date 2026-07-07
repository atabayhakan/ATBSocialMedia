'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, Bot, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type PublishMode = 'FULLY_AUTONOMOUS' | 'APPROVAL';

interface Settings {
  defaultMode: PublishMode;
  notifications: { telegramConfigured: boolean; smtpConfigured: boolean };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api.get<Settings>('/api/settings');
    setSettings(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function setMode(mode: PublishMode) {
    if (!settings || settings.defaultMode === mode) return;
    setSaving(true);
    try {
      await api.put<{ defaultMode: PublishMode }>('/api/settings', { defaultMode: mode });
      setSettings({ ...settings, defaultMode: mode });
      toast.success('Otonom mod güncellendi');
    } catch (e: any) {
      toast.error(e.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ayarlar</h1>
        <p className="text-sm text-muted-foreground">Sistem genelinde davranış ve entegrasyon tercihleri.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Otonom Mod
          </CardTitle>
          <CardDescription>AI&apos;ın otonom paylaşım davranışını belirle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer">
            <div>
              <p className="font-medium">Tam Otonom Mod</p>
              <p className="text-sm text-muted-foreground">AI yazar, görseli seçer ve direkt yayınlar.</p>
            </div>
            <input
              type="radio"
              name="mode"
              disabled={saving || !settings}
              checked={settings?.defaultMode === 'FULLY_AUTONOMOUS'}
              onChange={() => setMode('FULLY_AUTONOMOUS')}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer">
            <div>
              <p className="font-medium">Onay Destekli Mod <span className="ml-2 text-xs text-amber-400">(Önerilen)</span></p>
              <p className="text-sm text-muted-foreground">AI taslağı hazırlar, senden onay bekler.</p>
            </div>
            <input
              type="radio"
              name="mode"
              disabled={saving || !settings}
              checked={settings?.defaultMode === 'APPROVAL'}
              onChange={() => setMode('APPROVAL')}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Bildirim Durumu
          </CardTitle>
          <CardDescription>
            Kritik WhatsApp mesajları bu kanallara bildirilir. Değiştirmek için <code>backend/.env</code> içindeki
            <code> TELEGRAM_BOT_TOKEN</code>/<code>TELEGRAM_CHAT_ID</code> veya <code>SMTP_*</code> değişkenlerini
            düzenleyip backend&apos;i yeniden başlat (güvenlik nedeniyle bu anahtarlar panelden düzenlenmez).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <p className="font-medium">Telegram</p>
            {settings?.notifications.telegramConfigured ? (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Yapılandırılmış
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" /> Yapılandırılmamış
              </span>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <p className="font-medium">SMTP (E-posta)</p>
            {settings?.notifications.smtpConfigured ? (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Yapılandırılmış
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" /> Yapılandırılmamış
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
