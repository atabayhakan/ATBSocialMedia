'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, CheckCircle2, XCircle, Globe, Cpu } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type PublishMode = 'FULLY_AUTONOMOUS' | 'APPROVAL';

interface Settings {
  defaultMode: PublishMode;
  publishLanguage: string;
  notifications: { telegramConfigured: boolean; smtpConfigured: boolean };
}

interface AssistantConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

const LANGUAGES = [
  { code: 'tr', name: 'Türkçe' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'ar', name: 'العربية' },
  { code: 'ru', name: 'Русский' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [assistant, setAssistant] = useState<AssistantConfig | null>(null);
  const [assistantKey, setAssistantKey] = useState('');
  const [assistantSaving, setAssistantSaving] = useState(false);

  async function load() {
    const [s, a] = await Promise.all([
      api.get<Settings>('/api/settings'),
      api.get<AssistantConfig>('/api/assistant/config'),
    ]);
    setSettings(s);
    setAssistant(a);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function setMode(mode: PublishMode) {
    if (!settings || settings.defaultMode === mode) return;
    setSaving(true);
    try {
      await api.put('/api/settings', { defaultMode: mode });
      setSettings({ ...settings, defaultMode: mode });
      toast.success('Otonom mod güncellendi');
    } catch (e: any) {
      toast.error(e.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function setLanguage(publishLanguage: string) {
    if (!settings || settings.publishLanguage === publishLanguage) return;
    setSaving(true);
    try {
      await api.put('/api/settings', { publishLanguage });
      setSettings({ ...settings, publishLanguage });
      toast.success('Yayın dili güncellendi');
    } catch (e: any) {
      toast.error(e.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function saveAssistant(patch: Partial<AssistantConfig & { apiKey: string }>) {
    if (!assistant) return;
    setAssistantSaving(true);
    try {
      const updated = await api.put<AssistantConfig>('/api/assistant/config', patch);
      setAssistant(updated);
      setAssistantKey('');
      toast.success('Asistan yapılandırması kaydedildi');
    } catch (e: any) {
      toast.error(e.message || 'Kaydedilemedi');
    } finally {
      setAssistantSaving(false);
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
            <Globe className="h-5 w-5" /> Yayın Dili
          </CardTitle>
          <CardDescription>
            Üretilen tüm içerikler bu dilde yazılır. Haber Kaynakları&apos;nda kaynak başına farklı bir dil de seçebilirsin
            (kaynak dili genel ayarı geçersiz kılar).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={settings?.publishLanguage || 'tr'}
            disabled={saving || !settings}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" /> Asistan AI Sağlayıcısı
          </CardTitle>
          <CardDescription>
            ATB Asistan varsayılan olarak sistemin genel AI&apos;ını kullanır. Bu bölümü aktive edip kendi API bilgilerini
            girersen asistan o sağlayıcıyla çalışır (OpenAI-uyumlu her API: OpenRouter, Groq, Anthropic gateway...).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer">
            <div>
              <p className="font-medium">Özel sağlayıcı kullan</p>
              <p className="text-sm text-muted-foreground">
                {assistant?.enabled
                  ? 'Aktif — asistan aşağıdaki API ile çalışıyor.'
                  : 'Kapalı — asistan sistemin genel AI’ını kullanıyor.'}
              </p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-violet-500"
              disabled={assistantSaving || !assistant}
              checked={assistant?.enabled ?? false}
              onChange={(e) => saveAssistant({ enabled: e.target.checked })}
            />
          </label>

          {assistant?.enabled && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <Input
                placeholder="Base URL (örn: https://openrouter.ai/api/v1)"
                value={assistant.baseUrl}
                onChange={(e) => setAssistant({ ...assistant, baseUrl: e.target.value })}
              />
              <Input
                placeholder="Model (örn: anthropic/claude-sonnet-4.5)"
                value={assistant.model}
                onChange={(e) => setAssistant({ ...assistant, model: e.target.value })}
              />
              <Input
                type="password"
                placeholder={assistant.hasKey ? 'API Key (kayıtlı — değiştirmek için yaz)' : 'API Key'}
                value={assistantKey}
                onChange={(e) => setAssistantKey(e.target.value)}
              />
              <Button
                variant="gradient"
                disabled={assistantSaving}
                onClick={() =>
                  saveAssistant({
                    baseUrl: assistant.baseUrl,
                    model: assistant.model,
                    ...(assistantKey ? { apiKey: assistantKey } : {}),
                  })
                }
              >
                {assistantSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          )}
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
