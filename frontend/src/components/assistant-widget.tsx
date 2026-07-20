'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { Bot, X, Send, FileText, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Msg {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME: Msg = {
  role: 'assistant',
  content:
    'Merhaba! Ben ATB Asistan. Bu platformla ilgili her şeyi sorabilirsin: içerik üretimi, yayınlama, WhatsApp, Canva, hatalar... Çözemediğim teknik sorunlarda sana Claude için Tanı Raporu hazırlarım.',
};

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    api
      .get<Msg[]>('/api/assistant/history')
      // Geçmiş yüklenmeden kullanıcı mesaj yazdıysa (messages doldu) onu EZME —
      // yalnız hâlâ boşken geçmişi (yoksa karşılamayı) uygula.
      .then((h) => setMessages((m) => (m.length ? m : h.length ? h : [WELCOME])))
      .catch(() => setMessages((m) => (m.length ? m : [WELCOME])));
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const { reply, navigateTo } = await api.post<{ reply: string; navigateTo: string | null }>(
        '/api/assistant/chat',
        { message: text }
      );
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      if (navigateTo) {
        toast.info('Seni ilgili sayfaya götürüyorum...');
        router.push(navigateTo);
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Bir hata oluştu: ' + (e.message || 'bilinmeyen') }]);
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    try {
      await api.del('/api/assistant/history');
      setMessages([WELCOME]);
      toast.success('Sohbet temizlendi');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function makeReport() {
    setBusy(true);
    try {
      // Yanıt düz metin (markdown) döndüğü için api.ts'in JSON'a zorlayan
      // request()'ini değil, doğrudan fetch'i kullanıyoruz.
      const session = await getSession();
      const res = await fetch(`${API_URL}/api/assistant/report`, {
        headers: session?.backendToken ? { Authorization: `Bearer ${session.backendToken}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      setReport(await res.text());
      setCopied(false);
    } catch (e: any) {
      toast.error('Rapor oluşturulamadı: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyReport() {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success("Kopyalandı — Cowork'te Claude'a yapıştır");
  }

  return (
    <>
      {/* Yüzen buton */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="ATB Asistan"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105"
        >
          <Bot className="h-7 w-7" />
        </button>
      )}

      {/* Sohbet paneli */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-violet-500/15 to-cyan-500/15 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">ATB Asistan</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Sistem hakkında her şeyi sor</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={makeReport} title="Claude için Tanı Raporu" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <FileText className="h-4 w-4" />
              </button>
              <button onClick={clearChat} title="Sohbeti temizle" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} title="Kapat" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={m.id || i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> düşünüyor...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Bir soru yaz... (Enter ile gönder)"
                className="max-h-24 flex-1 resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <Button size="icon" variant="gradient" disabled={busy || !input.trim()} onClick={send}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tanı raporu modalı */}
      {report !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setReport(null)}>
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Claude için Tanı Raporu</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="gradient" onClick={copyReport}>
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </Button>
                <button onClick={() => setReport(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs text-muted-foreground">{report}</pre>
            <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              Bu raporu kopyalayıp Cowork&apos;te Claude&apos;a yapıştır — sunucuya bağlanıp sorunu inceleyecektir.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
