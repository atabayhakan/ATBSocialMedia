'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Twitter, Linkedin, Instagram, Facebook, Music2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const platformIcons: Record<string, any> = {
  TWITTER: Twitter,
  LINKEDIN: Linkedin,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TIKTOK: Music2,
};

const platformColors: Record<string, string> = {
  TWITTER: 'from-sky-500 to-blue-500',
  LINKEDIN: 'from-blue-600 to-blue-700',
  INSTAGRAM: 'from-pink-500 to-purple-500',
  FACEBOOK: 'from-blue-500 to-indigo-600',
  TIKTOK: 'from-slate-700 to-slate-900',
};

export default function SocialPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    platform: 'TWITTER',
    accountName: '',
    externalId: '',
    accessToken: '',
    refreshToken: '',
  });

  async function load() {
    const data = await api.get<any[]>('/api/social/accounts');
    setAccounts(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function add() {
    try {
      await api.post('/api/social/accounts', form);
      toast.success('Hesap eklendi');
      setOpen(false);
      setForm({ platform: 'TWITTER', accountName: '', externalId: '', accessToken: '', refreshToken: '' });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(id: string) {
    await api.del(`/api/social/accounts/${id}`);
    load();
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
            <Button variant="gradient">
              <Plus className="mr-2 h-4 w-4" /> Hesap Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Sosyal Hesap</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="TWITTER">Twitter / X</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="TIKTOK">TikTok</option>
              </select>
              <Input placeholder="Hesap adı" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
              <Input placeholder="External ID / Page ID" value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
              <Input type="password" placeholder="Access Token" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
              <Input type="password" placeholder="Refresh Token (opsiyonel)" value={form.refreshToken} onChange={(e) => setForm({ ...form, refreshToken: e.target.value })} />
              <Button variant="gradient" className="w-full" onClick={add}>
                Kaydet
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
                  <Badge variant={a.active ? 'success' : 'secondary'}>{a.active ? 'Aktif' : 'Pasif'}</Badge>
                </div>
              </CardHeader>
              <CardContent>
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
