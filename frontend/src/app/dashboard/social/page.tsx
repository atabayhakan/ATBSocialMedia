'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Twitter, Linkedin, Instagram, Facebook, Music2, Send, Bird } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const platformIcons: Record<string, any> = {
  TWITTER: Twitter,
  LINKEDIN: Linkedin,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TIKTOK: Music2,
  TELEGRAM: Send,
  BLUESKY: Bird,
};

const platformColors: Record<string, string> = {
  TWITTER: 'from-sky-500 to-blue-500',
  LINKEDIN: 'from-blue-600 to-blue-700',
  INSTAGRAM: 'from-pink-500 to-purple-500',
  FACEBOOK: 'from-blue-500 to-indigo-600',
  TIKTOK: 'from-slate-700 to-slate-900',
  TELEGRAM: 'from-sky-400 to-cyan-500',
  BLUESKY: 'from-sky-500 to-blue-400',
};

// Platform başına alanların ne anlama geldiği (kimlik bilgileri farklı)
const platformHints: Record<string, { externalId: string; accessToken: string; help: string }> = {
  TWITTER: { externalId: 'Kullanıcı ID', accessToken: 'Access Token (OAuth2)', help: 'developer.x.com üzerinden uygulama oluşturup token al.' },
  LINKEDIN: { externalId: 'Üye/Sayfa ID', accessToken: 'Access Token', help: 'LinkedIn Developer portalından w_member_social izniyle token al.' },
  INSTAGRAM: { externalId: 'IG Business Account ID', accessToken: 'Access Token', help: 'Meta Graph API — Instagram Business hesabı gerekir. Görsel zorunludur.' },
  FACEBOOK: { externalId: 'Page ID', accessToken: 'Page Access Token', help: 'Meta Graph API üzerinden sayfa token’ı al.' },
  TIKTOK: { externalId: 'Open ID', accessToken: 'Access Token', help: 'TikTok Developer portal — video içerik zorunludur.' },
  TELEGRAM: { externalId: 'Kanal (@kanaladi veya chat_id)', accessToken: 'Bot Token', help: 'Telegram’da @BotFather ile bot oluştur, botu kanalına yönetici ekle. En kolay kanal budur.' },
  BLUESKY: { externalId: 'Handle (örn: atb.bsky.social)', accessToken: 'App Password', help: 'Bluesky → Settings → App Passwords’tan üret (normal şifreni girme). Onay gerekmez.' },
};

const emptyForm = {
  platform: 'TWITTER',
  accountName: '',
  externalId: '',
  accessToken: '',
  refreshToken: '',
  expiresAt: '',
};

// <input type="datetime-local"> yerel saat bekler (ISO değil, saat dilimi eki yok).
function toLocalInputValue(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function expiryBadge(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 0) return <Badge variant="destructive">Süresi doldu</Badge>;
  if (ms < 24 * 60 * 60 * 1000) return <Badge variant="warning">Yakında doluyor</Badge>;
  return <Badge variant="secondary">Bitiş: {formatDate(expiresAt)}</Badge>;
}

export default function SocialPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const data = await api.get<any[]>('/api/social/accounts');
    setAccounts(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(a: any) {
    setEditingId(a.id);
    setForm({
      platform: a.platform,
      accountName: a.accountName,
      externalId: a.externalId,
      accessToken: '',
      refreshToken: '',
      expiresAt: toLocalInputValue(a.expiresAt),
    });
    setOpen(true);
  }

  async function save() {
    try {
      let expiresAt: string | null = null;
      if (form.expiresAt && !isNaN(new Date(form.expiresAt).getTime())) {
        expiresAt = new Date(form.expiresAt).toISOString();
      }
      const body = {
        ...form,
        accountName: form.accountName.trim(),
        externalId: form.externalId.trim(),
        accessToken: form.accessToken.trim() || undefined,
        refreshToken: form.refreshToken.trim() || undefined,
        expiresAt: expiresAt || undefined,
      };
      if (editingId) {
        await api.put(`/api/social/accounts/${editingId}`, body);
        toast.success('Hesap güncellendi');
      } else {
        await api.post('/api/social/accounts', body);
        toast.success('Hesap eklendi');
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function testAccount(id: string) {
    try {
      const res = await api.post<any>(`/api/social/accounts/${id}/test`);
      toast.success(`Bağlantı Başarılı! (${res.name})`);
    } catch (e: any) {
      toast.error(e.message || 'Bağlantı testi başarısız');
    }
  }

  async function remove(id: string) {
    if (!confirm('Bu hesabı kaldırmak istediğine emin misin?')) return;
    try {
      await api.del(`/api/social/accounts/${id}`);
      toast.success('Kaldırıldı');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Kaldırılamadı');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sosyal Hesaplar</h1>
          <p className="text-sm text-muted-foreground">Yayın yapılacak platformları bağla.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" /> Hesap Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Hesabı Düzenle' : 'Yeni Sosyal Hesap'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                disabled={!!editingId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
              >
                <option value="TWITTER">Twitter / X</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="TIKTOK">TikTok</option>
                <option value="TELEGRAM">Telegram (kanal)</option>
                <option value="BLUESKY">Bluesky</option>
              </select>
              <p className="text-xs text-muted-foreground">{platformHints[form.platform]?.help}</p>
              <Input placeholder="Hesap adı (panelde görünecek)" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
              <Input placeholder={platformHints[form.platform]?.externalId || 'External ID'} value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
              <Input
                type="password"
                placeholder={editingId ? 'Boş bırak = mevcut token korunur' : platformHints[form.platform]?.accessToken || 'Access Token'}
                value={form.accessToken}
                onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              />
              <Input
                type="password"
                placeholder={editingId ? 'Boş bırak = mevcut refresh token korunur' : 'Refresh Token (opsiyonel)'}
                value={form.refreshToken}
                onChange={(e) => setForm({ ...form, refreshToken: e.target.value })}
              />
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Son kullanma tarihi (opsiyonel)</label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
              <Button variant="gradient" className="w-full" onClick={save}>
                {editingId ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const Icon = platformIcons[a.platform];
          return (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${platformColors[a.platform]}`}>
                      {Icon && <Icon className="h-5 w-5 text-white" />}
                    </div>
                    <div>
                      <CardTitle className="text-base">{a.accountName}</CardTitle>
                      <p className="text-xs text-muted-foreground">{a.platform}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={a.active ? 'success' : 'secondary'}>{a.active ? 'Aktif' : 'Pasif'}</Badge>
                    {expiryBadge(a.expiresAt)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => testAccount(a.id)}>
                  Test Et
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Düzenle
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Kaldır
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
