import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot } from 'lucide-react';

export default function SettingsPage() {
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
          <CardDescription>AI'ın otonom paylaşım davranışını belirle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">Tam Otonom Mod</p>
              <p className="text-sm text-muted-foreground">AI yazar, görseli seçer ve direkt yayınlar.</p>
            </div>
            <input type="radio" name="mode" defaultChecked />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">Onay Destekli Mod <span className="ml-2 text-xs text-amber-400">(Önerilen)</span></p>
              <p className="text-sm text-muted-foreground">AI taslağı hazırlar, senden onay bekler.</p>
            </div>
            <input type="radio" name="mode" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Bildirim Tercihleri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Telegram Bot Token" type="password" />
          <Input placeholder="Telegram Chat ID" />
          <Input placeholder="SMTP Host" />
          <Input placeholder="SMTP Port" defaultValue="587" />
          <Input placeholder="SMTP Kullanıcı" />
          <Input placeholder="SMTP Şifre" type="password" />
          <Button variant="gradient">Kaydet</Button>
        </CardContent>
      </Card>
    </div>
  );
}
