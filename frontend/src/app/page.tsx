import { Sparkles, ArrowRight, Bot, Calendar, MessageCircle, Palette, Zap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <nav className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">ATBSocialMedia</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Düz <a>: /dashboard Basic Auth korumalı. Next.js <Link> bu rotayı
              sayfa açılışında prefetch edip tarayıcının giriş penceresini fırlatıyordu.
              Düz anchor hiç prefetch yapmaz; pencere yalnızca kullanıcı tıklayınca çıkar. */}
          <a href="/dashboard">
            <Button variant="ghost">Giriş</Button>
          </a>
          <a href="/dashboard">
            <Button variant="gradient">
              Panele Git <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </nav>

      <section className="container mx-auto px-6 pt-20 pb-32 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Gemini 1.5 Pro & Baileys destekli
        </div>
        <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
          Sosyal medyanı{' '}
          <span className="gradient-text">tam otonom</span>{' '}
          yönet
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          ATBSocialMedia; RSS kaynaklarından haber çeker, Gemini ile içerik üretir, Canva şablonlarına yerleştirir
          ve WhatsApp dahil tüm kanallarına sen uyurken paylaşır.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a href="/dashboard">
            <Button size="lg" variant="gradient">
              Hemen Başla <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
          <a href="/dashboard/whatsapp">
            <Button size="lg" variant="outline">
              WhatsApp Bağla
            </Button>
          </a>
        </div>
      </section>

      <section className="container mx-auto grid grid-cols-1 gap-6 px-6 pb-32 md:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Bot, title: 'AI İçerik Motoru', desc: 'Gemini 1.5 Pro ile kişiliğine uygun, çok dilli, hazır gönderiler.' },
          { icon: Calendar, title: 'Akıllı Takvim', desc: 'En verimli saatlerde otomatik zamanlama ve onay destekli mod.' },
          { icon: MessageCircle, title: 'WhatsApp Otonom', desc: 'QR kod ile bağlan, AI gelen mesajları anında yanıtlasın.' },
          { icon: Palette, title: 'Canva Entegrasyonu', desc: 'Şablonlarına otomatik metin yerleştirip markana uygun görsel üret.' },
          { icon: Zap, title: 'Çoklu Platform', desc: 'Twitter, LinkedIn, Instagram, Facebook ve TikTok tek panelden.' },
          { icon: ShieldCheck, title: 'Akıllı Filtreleme', desc: 'Kritik müşteri mesajları anında Telegram ve e-posta ile sana gelsin.' },
        ].map((f) => (
          <div key={f.title} className="glass rounded-2xl p-6 transition-all hover:border-primary/40">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15">
              <f.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
