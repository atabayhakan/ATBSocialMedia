// MCP (Model Context Protocol) sunucusu — Streamable HTTP, stateless, JSON yanıtlı.
// Claude Code / Cowork gibi MCP istemcileri bu endpoint üzerinden paneli yönetir:
//   claude mcp add --transport http atb http://<host>/api/mcp --header "Authorization: Basic <b64>"
// Bağımlılıksız minimal implementasyon: initialize, tools/list, tools/call, ping.
// (Resmi SDK, tsconfig moduleResolution=node ile uyumsuz olduğu için kullanılmadı.)
import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../lib/env';
import { prisma } from '../lib/prisma';
import { generatePostForUser, approvePost, publishToPlatform } from '../services/publisher';
import { fetchAllSources } from '../services/newsFetcher';
import { buildLiveContext } from '../services/assistant';
import { searchAll } from '../services/search';

const PROTOCOL_FALLBACK = '2025-03-26';
const DEFAULT_USER = 'demo-user';

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any) => Promise<string>;
}

const TOOLS: McpTool[] = [
  {
    name: 'get_status',
    description:
      'ATBSocialMedia panelinin canlı durum özetini döndürür: gönderi sayıları (duruma göre), başarısız yayın hedefleri ve hataları, haber kaynakları, WhatsApp/Canva bağlantı durumu, otonom mod ve yayın dili.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => buildLiveContext(DEFAULT_USER),
  },
  {
    name: 'list_posts',
    description:
      'Gönderileri listeler. status verilmezse onay bekleyenleri döndürür. Her gönderi için id, başlık, durum, zamanlama bilgisi verir. approve_post/reject_post/publish_post için id buradan alınır.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'REJECTED'],
          description: 'Filtrelenecek gönderi durumu (varsayılan: PENDING_APPROVAL)',
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const status = args?.status || 'PENDING_APPROVAL';
      const posts = await prisma.post.findMany({
        where: { userId: DEFAULT_USER, status },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { targets: true },
      });
      if (!posts.length) return `${status} durumunda gönderi yok.`;
      return posts
        .map(
          (p: any) =>
            `id: ${p.id}\nbaşlık: ${p.title}\ndurum: ${p.status}${
              p.scheduledAt ? `\nzamanlanmış: ${new Date(p.scheduledAt).toISOString()}` : ''
            }${p.targets?.length ? `\nhedefler: ${p.targets.map((t: any) => `${t.platform}:${t.status}`).join(', ')}` : ''}\nmetin: ${p.body.slice(0, 200)}...`
        )
        .join('\n\n---\n\n');
    },
  },
  {
    name: 'generate_post',
    description:
      'Sıradaki kullanılmamış haberden AI ile yeni bir sosyal medya gönderisi taslağı üretir (onay kuyruğuna düşer). Üretim 60-90 saniye sürebilir.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      const post = await generatePostForUser(DEFAULT_USER);
      return `Taslak üretildi.\nid: ${post.id}\nbaşlık: ${post.title}\ndurum: ${post.status}\nmetin: ${post.body}`;
    },
  },
  {
    name: 'approve_post',
    description:
      'Bir gönderiyi onaylar. scheduledAt verilirse o tarihte yayınlanır (ISO 8601, örn: 2026-07-09T09:00:00+03:00 — kullanıcının saat dilimi Europe/Istanbul). Verilmezse 2 dakika içinde yayınlanır. Onay, tüm bağlı sosyal hesaplar için yayın hedefi oluşturur.',
    inputSchema: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: 'list_posts çıktısındaki gönderi id' },
        scheduledAt: { type: 'string', description: 'Opsiyonel ISO 8601 yayın zamanı' },
      },
      required: ['postId'],
      additionalProperties: false,
    },
    handler: async (args) => {
      // Sahiplik kısıtı: MCP token'ı yalnız DEFAULT_USER'ın gönderilerini yönetebilir
      // (list_posts ile mutasyonlar arasındaki kapsam tutarsızlığını giderir).
      const owned = await prisma.post.findFirst({ where: { id: args.postId, userId: DEFAULT_USER } });
      if (!owned) throw new Error('Gönderi bulunamadı');
      const scheduledAt = args.scheduledAt ? new Date(args.scheduledAt) : undefined;
      if (scheduledAt && isNaN(scheduledAt.getTime())) throw new Error('Geçersiz scheduledAt tarihi');
      const post = await approvePost(args.postId, scheduledAt);
      return scheduledAt
        ? `Onaylandı ve zamanlandı: "${post.title}" → ${scheduledAt.toISOString()}`
        : `Onaylandı, birkaç dakika içinde yayınlanacak: "${post.title}"`;
    },
  },
  {
    name: 'reject_post',
    description: 'Bir gönderi taslağını reddeder (yayınlanmaz).',
    inputSchema: {
      type: 'object',
      properties: { postId: { type: 'string' } },
      required: ['postId'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const { count } = await prisma.post.updateMany({
        where: { id: args.postId, userId: DEFAULT_USER },
        data: { status: 'REJECTED' },
      });
      if (!count) throw new Error('Gönderi bulunamadı');
      // Bekleyen hedefleri de iptal et (scheduler yayınlamaya devam etmesin).
      await prisma.postTarget.updateMany({
        where: { postId: args.postId, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'] } },
        data: { status: 'REJECTED' },
      });
      const post = await prisma.post.findUnique({ where: { id: args.postId } });
      return `Reddedildi: "${post?.title ?? args.postId}"`;
    },
  },
  {
    name: 'publish_post',
    description: 'Onaylanmış/zamanlanmış bir gönderiyi tüm hedeflerinde HEMEN yayınlar (zamanlamayı beklemez).',
    inputSchema: {
      type: 'object',
      properties: { postId: { type: 'string' } },
      required: ['postId'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const owned = await prisma.post.findFirst({ where: { id: args.postId, userId: DEFAULT_USER } });
      if (!owned) throw new Error('Gönderi bulunamadı');
      if (owned.status === 'REJECTED') return 'Reddedilmiş gönderi yayınlanamaz.';
      const targets = await prisma.postTarget.findMany({ where: { postId: args.postId } });
      if (!targets.length) return 'Bu gönderinin yayın hedefi yok (önce approve_post ile onayla; bağlı sosyal hesap olduğundan emin ol).';
      const results: string[] = [];
      for (const t of targets) {
        try {
          await publishToPlatform(args.postId, t.id);
          results.push(`${t.platform}: yayınlandı`);
        } catch (e: any) {
          results.push(`${t.platform}: HATA — ${e.message}`);
        }
      }
      return results.join('\n');
    },
  },
  {
    name: 'scan_sources',
    description: 'Tüm aktif haber kaynaklarını (RSS) şimdi tarar, yeni haberleri veritabanına ekler.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      const results = await fetchAllSources();
      return results.length
        ? results.map((r) => `${r.sourceId}: ${r.newCount} yeni / ${r.total} toplam`).join('\n')
        : 'Aktif kaynak yok.';
    },
  },
  {
    name: 'search_panel',
    description: 'Panelde arama yapar: sayfalar, gönderiler, kaynaklar, personalar, sosyal hesaplar.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Arama sorgusu (min 2 karakter)' } },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const results = await searchAll(DEFAULT_USER, args.query);
      return results.length
        ? results.map((r) => `[${r.type}] ${r.title} (${r.detail}) → ${r.href}`).join('\n')
        : 'Sonuç bulunamadı.';
    },
  },
];

function rpcResult(id: any, result: any) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: any, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

const router = Router();

// MCP, panel Basic Auth'undan bağımsız kendi Bearer token'ını doğrular
// (Caddy /api/mcp'yi basic auth'tan muaf tutar). MCP_TOKEN boşsa kontrol kapalı.
router.use((req, res, next) => {
  if (!env.MCP_TOKEN) return next();
  const header = req.header('authorization') || '';
  const provided = header.replace(/^Bearer\s+/i, '');
  const a = Buffer.from(provided);
  const b = Buffer.from(env.MCP_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Geçersiz MCP token' });
  }
  next();
});

router.post('/', async (req, res) => {
  const msg = req.body;

  // Batch istekleri desteklenmiyor (yeni MCP sürümlerinde kaldırıldı)
  if (Array.isArray(msg)) {
    return res.status(400).json(rpcError(null, -32600, 'Batch istekleri desteklenmiyor'));
  }
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return res.status(400).json(rpcError(null, -32600, 'Geçersiz JSON-RPC isteği'));
  }

  // Bildirimler (id'siz): 202 ile onayla
  if (msg.id === undefined || msg.id === null) {
    return res.status(202).end();
  }

  try {
    switch (msg.method) {
      case 'initialize':
        return res.json(
          rpcResult(msg.id, {
            protocolVersion: msg.params?.protocolVersion || PROTOCOL_FALLBACK,
            capabilities: { tools: {} },
            serverInfo: { name: 'atbsocialmedia', version: '1.0.0' },
          })
        );

      case 'ping':
        return res.json(rpcResult(msg.id, {}));

      case 'tools/list':
        return res.json(
          rpcResult(msg.id, {
            tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
          })
        );

      case 'tools/call': {
        const tool = TOOLS.find((t) => t.name === msg.params?.name);
        if (!tool) return res.json(rpcError(msg.id, -32602, `Bilinmeyen araç: ${msg.params?.name}`));
        try {
          const text = await tool.handler(msg.params?.arguments || {});
          return res.json(rpcResult(msg.id, { content: [{ type: 'text', text }] }));
        } catch (e: any) {
          return res.json(
            rpcResult(msg.id, { content: [{ type: 'text', text: `Hata: ${e.message}` }], isError: true })
          );
        }
      }

      default:
        return res.json(rpcError(msg.id, -32601, `Desteklenmeyen metod: ${msg.method}`));
    }
  } catch (e: any) {
    return res.json(rpcError(msg.id, -32603, e.message || 'Sunucu hatası'));
  }
});

// Stateless mod: SSE akışı ve oturum yönetimi yok
router.get('/', (_req, res) => res.status(405).json({ error: 'SSE desteklenmiyor (stateless mod)' }));
router.delete('/', (_req, res) => res.status(405).end());

export default router;
