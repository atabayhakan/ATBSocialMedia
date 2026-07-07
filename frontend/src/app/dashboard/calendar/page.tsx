'use client';
import { useEffect, useState } from 'react';
import { Check, X, Eye, Twitter, Linkedin, Instagram, Facebook, Music2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate, timeAgo } from '@/lib/utils';

const platformIcons: Record<string, any> = {
  TWITTER: Twitter,
  LINKEDIN: Linkedin,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TIKTOK: Music2,
};

export default function CalendarPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [tab, setTab] = useState('PENDING_APPROVAL');

  async function load() {
    const data = await api.get<any[]>(`/api/posts?status=${tab}`);
    setPosts(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [tab]);

  async function approve(id: string) {
    try {
      await api.post(`/api/posts/${id}/approve`, {});
      toast.success('Onaylandı');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function reject(id: string) {
    await api.post(`/api/posts/${id}/reject`, {});
    toast('Reddedildi');
    load();
  }

  async function publishNow(id: string) {
    try {
      await api.post(`/api/posts/${id}/publish`, {});
      toast.success('Yayınlandı');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">İçerik Takvimi</h1>
        <p className="text-sm text-muted-foreground">Bekleyen taslakları incele, onayla veya reddet.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="PENDING_APPROVAL">Onay Bekliyor</TabsTrigger>
          <TabsTrigger value="APPROVED">Onaylandı</TabsTrigger>
          <TabsTrigger value="SCHEDULED">Zamanlandı</TabsTrigger>
          <TabsTrigger value="PUBLISHED">Yayında</TabsTrigger>
          <TabsTrigger value="REJECTED">Reddedildi</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3">
          {posts.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">Bu kategoride içerik yok.</CardContent>
            </Card>
          )}
          {posts.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg">{p.title}</CardTitle>
                    <CardDescription>
                      {p.persona?.name || '—'} • {timeAgo(p.createdAt)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.targets?.map((t: any) => {
                      const Icon = platformIcons[t.platform];
                      return Icon ? (
                        <div key={t.id} className="rounded-md bg-muted p-1.5">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm">{p.body}</p>
                {p.hashtags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.hashtags.map((h: string) => (
                      <Badge key={h} variant="secondary">
                        {h}
                      </Badge>
                    ))}
                  </div>
                )}
                {p.mediaUrls?.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {p.mediaUrls.map((m: string) => (
                      <img key={m} src={m} className="h-20 w-20 rounded object-cover" alt="" />
                    ))}
                  </div>
                )}
                {p.scheduledAt && (
                  <p className="mt-3 text-xs text-muted-foreground">📅 Zamanlanmış: {formatDate(p.scheduledAt)}</p>
                )}
                <div className="mt-4 flex gap-2">
                  {tab === 'PENDING_APPROVAL' && (
                    <>
                      <Button size="sm" variant="gradient" onClick={() => approve(p.id)}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Onayla
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => reject(p.id)}>
                        <X className="mr-1 h-3.5 w-3.5" /> Reddet
                      </Button>
                    </>
                  )}
                  {(tab === 'APPROVED' || tab === 'SCHEDULED') && (
                    <Button size="sm" variant="gradient" onClick={() => publishNow(p.id)}>
                      Şimdi Yayınla
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
