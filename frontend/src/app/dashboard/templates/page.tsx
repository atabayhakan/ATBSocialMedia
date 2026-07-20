'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Image as ImageIcon, Eye, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ImageTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  panelPosition: 'TOP' | 'CENTER' | 'BOTTOM';
  textColor: 'LIGHT' | 'DARK';
  isDefault: boolean;
  previewUrl: string;
  createdAt: string;
}

const emptyForm = {
  name: '',
  panelPosition: 'BOTTOM' as ImageTemplate['panelPosition'],
  textColor: 'LIGHT' as ImageTemplate['textColor'],
  isDefault: false,
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await api.get<ImageTemplate[]>('/api/image-templates');
    setTemplates(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    setOpen(true);
  }

  function openEdit(t: ImageTemplate) {
    setEditingId(t.id);
    setForm({ name: t.name, panelPosition: t.panelPosition, textColor: t.textColor, isDefault: t.isDefault });
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    setOpen(true);
  }

  async function save() {
    try {
      if (editingId) {
        await api.put(`/api/image-templates/${editingId}`, form);
        toast.success('Şablon güncellendi');
      } else {
        if (!file) return toast.error('Arka plan görseli seç');
        const fd = new FormData();
        fd.append('background', file);
        fd.append('name', form.name || 'Şablon');
        fd.append('panelPosition', form.panelPosition);
        fd.append('textColor', form.textColor);
        fd.append('isDefault', String(form.isDefault));
        await api.upload('/api/image-templates', fd);
        toast.success('Şablon eklendi');
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setFile(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Bu şablonu silmek istediğine emin misin?')) return;
    try {
      await api.del(`/api/image-templates/${id}`);
      toast.success('Silindi');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Silinemedi');
    }
  }

  async function makeDefault(t: ImageTemplate) {
    try {
      await api.put(`/api/image-templates/${t.id}`, { isDefault: true });
      toast.success('Varsayılan şablon ayarlandı');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function preview(id: string) {
    setBusyId(id);
    try {
      const r = await api.post<{ url: string }>(`/api/image-templates/${id}/preview`);
      setPreviewSrc(r.url);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Görsel Şablonları</h1>
          <p className="text-sm text-muted-foreground">
            Arka plan görseli yükle, AI ürettiği metni otomatik bindirir — Canva&apos;ya bağımlı olmadan,
            ücretsiz.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" /> Şablon Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Şablonu Düzenle' : 'Yeni Görsel Şablonu'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {!editingId && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Arka plan görseli (PNG/JPEG/WEBP, en fazla 8MB)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm"
                  />
                </div>
              )}
              <Input
                placeholder="Şablon adı"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Metin paneli konumu</label>
                  <select
                    value={form.panelPosition}
                    onChange={(e) => setForm({ ...form, panelPosition: e.target.value as ImageTemplate['panelPosition'] })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="TOP">Üst</option>
                    <option value="CENTER">Orta</option>
                    <option value="BOTTOM">Alt</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Metin rengi</label>
                  <select
                    value={form.textColor}
                    onChange={(e) => setForm({ ...form, textColor: e.target.value as ImageTemplate['textColor'] })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="LIGHT">Açık (koyu arka planlar için)</option>
                    <option value="DARK">Koyu (açık arka planlar için)</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Varsayılan şablon yap (otomatik gönderi üretiminde kullanılır)
              </label>
              <Button variant="gradient" className="w-full" onClick={save}>
                {editingId ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Henüz şablon yok. &quot;Şablon Ekle&quot; ile bir arka plan görseli yükle.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="aspect-[4/5] w-full overflow-hidden rounded-t-xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- kullanıcı yüklediği rastgele görsel, next/image optimize edemez */}
                <img src={t.previewUrl} alt={t.name} className="h-full w-full object-cover" />
              </div>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.isDefault && (
                    <Badge variant="success">
                      <Star className="mr-1 h-3 w-3" /> Varsayılan
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {!t.isDefault && (
                  <Button size="sm" variant="outline" onClick={() => makeDefault(t)}>
                    <Star className="mr-1 h-3.5 w-3.5" /> Varsayılan yap
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => preview(t.id)} disabled={busyId === t.id}>
                  <Eye className="mr-1 h-3.5 w-3.5" /> {busyId === t.id ? 'Üretiliyor...' : 'Önizle'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Düzenle
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Kaldır
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewSrc} onOpenChange={(o) => !o && setPreviewSrc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Önizleme</DialogTitle>
          </DialogHeader>
          {previewSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- sunucuda dinamik üretilen önizleme
            <img src={previewSrc} alt="Önizleme" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
