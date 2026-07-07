'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function PersonasPage() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    tone: '',
    language: 'tr',
    voiceRules: '',
    forbiddenTopics: '',
    isDefault: false,
  });

  async function load() {
    const data = await api.get<any[]>('/api/personas');
    setPersonas(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ name: '', tone: '', language: 'tr', voiceRules: '', forbiddenTopics: '', isDefault: false });
    setOpen(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setForm({
      name: p.name,
      tone: p.tone,
      language: p.language,
      voiceRules: p.voiceRules || '',
      forbiddenTopics: p.forbiddenTopics || '',
      isDefault: p.isDefault,
    });
    setOpen(true);
  }

  async function save() {
    try {
      if (editing) {
        await api.put(`/api/personas/${editing.id}`, form);
        toast.success('Güncellendi');
      } else {
        await api.post('/api/personas', form);
        toast.success('Oluşturuldu');
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(id: string) {
    await api.del(`/api/personas/${id}`);
    load();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Kişilikler</h1>
          <p className="text-sm text-muted-foreground">İçeriklerin ve WhatsApp yanıtlarının tonunu/personasını tanımla.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Yeni Persona
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? 'Persona Düzenle' : 'Yeni Persona'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="İsim" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Ton (örn: samimi, profesyonel, eğlenceli)" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} />
              <Input placeholder="Dil (tr/en)" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
              <Textarea placeholder="Ek ses kuralları (opsiyonel)" value={form.voiceRules} onChange={(e) => setForm({ ...form, voiceRules: e.target.value })} />
              <Textarea placeholder="Yasaklı konular (opsiyonel)" value={form.forbiddenTopics} onChange={(e) => setForm({ ...form, forbiddenTopics: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Varsayılan olarak kullan
              </label>
              <Button variant="gradient" className="w-full" onClick={save}>
                Kaydet
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {personas.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {p.name}
                    {p.isDefault && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{p.tone}</p>
                </div>
                <Badge variant="info">{p.language.toUpperCase()}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {p.voiceRules && (
                <p className="mb-2 text-xs text-muted-foreground line-clamp-2">📝 {p.voiceRules}</p>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                  <Edit className="mr-1 h-3.5 w-3.5" /> Düzenle
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
