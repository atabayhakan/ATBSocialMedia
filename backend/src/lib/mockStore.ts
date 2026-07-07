import { randomUUID } from 'crypto';

type Model = Record<string, any>;

class MockStore {
  private data: Record<string, Model[]> = {
    User: [],
    Niche: [],
    NewsSource: [],
    NewsItem: [],
    Persona: [],
    Post: [],
    PostTarget: [],
    SocialAccount: [],
    WhatsAppConfig: [],
    WhatsAppMessage: [],
    WhatsAppReply: [],
    CanvaConfig: [],
    AuditLog: [],
  };

  constructor() {
    this.seed();
  }

  private now() {
    return new Date();
  }

  private seed() {
    const userId = 'demo-user';
    const now = this.now();

    this.data.User.push({
      id: userId,
      email: 'demo@atbsocialmedia.local',
      name: 'Demo Kullanıcı',
      role: 'OWNER',
      timezone: 'Europe/Istanbul',
      createdAt: now,
      updatedAt: now,
    });

    const personaId = 'persona-default';
    this.data.Persona.push({
      id: personaId,
      userId,
      name: 'ATB Asistan',
      tone: 'Samimi, profesyonel, enerjik, Türkçe doğal konuşma dili',
      language: 'tr',
      voiceRules:
        'Kısa ve öz cümleler kullan. Emoji kullanma. Rakamları yazıyla değil, rakamla yaz. Markdown kullanma.',
      forbiddenTopics: 'Politika, din, kişisel yorumlar',
      isDefault: true,
      createdAt: now,
    });

    const nicheId = 'niche-tech';
    this.data.Niche.push({
      id: nicheId,
      userId,
      name: 'Teknoloji',
      keywords: ['yapay zeka', 'teknoloji', 'startup', 'yazılım'],
      active: true,
      createdAt: now,
    });

    this.data.NewsSource.push({
      id: 'src-techcrunch',
      userId,
      nicheId,
      type: 'RSS',
      url: 'https://techcrunch.com/feed/',
      name: 'TechCrunch',
      language: 'en',
      active: true,
      intervalMin: 30,
      lastFetchedAt: null,
      createdAt: now,
    });

    this.data.NewsSource.push({
      id: 'src-theverge',
      userId,
      nicheId,
      type: 'RSS',
      url: 'https://www.theverge.com/rss/index.xml',
      name: 'The Verge',
      language: 'en',
      active: true,
      intervalMin: 30,
      lastFetchedAt: null,
      createdAt: now,
    });

    [
      {
        title: 'Yapay Zeka Çip Üreticisi Cerebras, 8 Milyar Dolarlık Değerleme Üzerinden Yatırım Aldı',
        summary: 'Cerebras Systems, devasa AI çiplerine olan talep artışıyla yeni bir finansman turu kapattı.',
        url: 'https://example.com/cerebras-yatirim',
        sourceId: 'src-techcrunch',
      },
      {
        title: 'OpenAI, Yeni "GPT-5 Turbo" Modelini Duyurdu: Yüzde 40 Daha Hızlı',
        summary: 'Şirket, yeni modelin daha düşük maliyetle çalıştığını ve daha doğru yanıt verdiğini açıkladı.',
        url: 'https://example.com/openai-gpt5-turbo',
        sourceId: 'src-theverge',
      },
      {
        title: 'Apple, Vision Pro 2 İçin Samsung ile Ekran Anlaşması İmzaladı',
        summary: 'Yeni nesil karma gerçeklik başlığının 2026 sonunda piyasaya çıkması bekleniyor.',
        url: 'https://example.com/apple-vision-pro-2',
        sourceId: 'src-techcrunch',
      },
    ].forEach((n) => {
      this.data.NewsItem.push({
        id: randomUUID(),
        ...n,
        content: n.summary,
        imageUrl: null,
        language: 'tr',
        publishedAt: new Date(Date.now() - Math.random() * 86400000 * 2),
        fetchedAt: now,
        used: false,
      });
    });
  }

  getModel<T = any>(name: string): T[] {
    if (!this.data[name]) this.data[name] = [];
    return this.data[name] as T[];
  }

  private id() {
    return randomUUID();
  }

  // Prisma-uyumlu yüzey
  user = this.proxy('User');
  niche = this.proxy('Niche');
  newsSource = this.proxy('NewsSource');
  newsItem = this.proxy('NewsItem');
  persona = this.proxy('Persona');
  post = this.proxy('Post');
  postTarget = this.proxy('PostTarget');
  socialAccount = this.proxy('SocialAccount');
  whatsAppConfig = this.proxy('WhatsAppConfig');
  whatsAppMessage = this.proxy('WhatsAppMessage');
  whatsAppReply = this.proxy('WhatsAppReply');
  canvaConfig = this.proxy('CanvaConfig');
  auditLog = this.proxy('AuditLog');

  private proxy(model: string) {
    const store = this;
    return {
      findMany: async (args: any = {}) => {
        let rows = [...store.getModel(model)];
        if (args.where) rows = store.applyWhere(rows, args.where);
        if (args.orderBy) rows = store.applyOrder(rows, args.orderBy);
        if (args.include) {
          rows = rows.map((r) => store.applyInclude(r, args.include, model));
        }
        if (args.take) rows = rows.slice(0, args.take);
        return rows;
      },
      findUnique: async (args: any) => {
        const rows = store.getModel(model);
        const key = Object.keys(args.where)[0];
        const value = args.where[key];
        let row = rows.find((r) => r[key] === value);
        if (!row) return null;
        if (args.include) row = store.applyInclude({ ...row }, args.include, model);
        return row;
      },
      findFirst: async (args: any = {}) => {
        const rows = store.getModel(model);
        let filtered = [...rows];
        if (args.where) filtered = store.applyWhere(filtered, args.where);
        if (args.orderBy) filtered = store.applyOrder(filtered, args.orderBy);
        const found = filtered[0];
        if (!found) return null;
        return args.include ? store.applyInclude({ ...found }, args.include, model) : found;
      },
      count: async (args: any = {}) => {
        const rows = store.getModel(model);
        if (!args.where) return rows.length;
        return store.applyWhere([...rows], args.where).length;
      },
      create: async (args: any) => {
        const rows = store.getModel(model);
        const data = { id: store.id(), createdAt: new Date(), updatedAt: new Date(), ...args.data };
        rows.push(data);
        return args.include ? store.applyInclude({ ...data }, args.include, model) : data;
      },
      createMany: async (args: any) => {
        const rows = store.getModel(model);
        const items = (Array.isArray(args.data) ? args.data : [args.data]).map((d: any) => ({
          id: store.id(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...d,
        }));
        rows.push(...items);
        return { count: items.length };
      },
      update: async (args: any) => {
        const rows = store.getModel(model);
        const idx = rows.findIndex((r) => r.id === args.where.id);
        if (idx === -1) throw new Error(`${model}#${args.where.id} bulunamadı`);
        const updated = { ...rows[idx], ...args.data, updatedAt: new Date() };
        rows[idx] = updated;
        return args.include ? store.applyInclude({ ...updated }, args.include, model) : updated;
      },
      updateMany: async (args: any) => {
        const rows = store.getModel(model);
        let count = 0;
        rows.forEach((r, i) => {
          if (store.matchesWhere(r, args.where)) {
            rows[i] = { ...r, ...args.data, updatedAt: new Date() };
            count++;
          }
        });
        return { count };
      },
      delete: async (args: any) => {
        const rows = store.getModel(model);
        const idx = rows.findIndex((r) => r.id === args.where.id);
        if (idx === -1) throw new Error(`${model}#${args.where.id} bulunamadı`);
        const [removed] = rows.splice(idx, 1);
        return removed;
      },
      deleteMany: async (args: any = {}) => {
        const rows = store.getModel(model);
        const before = rows.length;
        const filtered = rows.filter((r) => !store.matchesWhere(r, args.where || {}));
        store.data[model] = filtered;
        return { count: before - filtered.length };
      },
      upsert: async (args: any) => {
        const rows = store.getModel(model);
        const whereKey = Object.keys(args.where)[0];
        const idx = rows.findIndex((r) => r[whereKey] === args.where[whereKey]);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...args.update, updatedAt: new Date() };
          return args.include ? store.applyInclude({ ...rows[idx] }, args.include, model) : rows[idx];
        }
        const created = { id: store.id(), ...args.create, createdAt: new Date(), updatedAt: new Date() };
        rows.push(created);
        return args.include ? store.applyInclude({ ...created }, args.include, model) : created;
      },
      groupBy: async (args: any) => {
        const rows = store.getModel(model);
        let filtered = [...rows];
        if (args.where) filtered = store.applyWhere(filtered, args.where);
        const groups = new Map<string, any>();
        for (const r of filtered) {
          const key = JSON.stringify(args.by.map((b: string) => r[b]));
          if (!groups.has(key)) {
            const group: any = {};
            args.by.forEach((b: string) => (group[b] = r[b]));
            group._count = 0;
            groups.set(key, group);
          }
          groups.get(key)._count++;
        }
        return [...groups.values()];
      },
    };
  }

  private matchesWhere(row: any, where: any): boolean {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
      if (v === null) {
        if (row[k] !== null && row[k] !== undefined) return false;
      } else if (typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        if ('in' in v) {
          if (!v.in.includes(row[k])) return false;
        } else if ('not' in v) {
          if (v.not === null && (row[k] === null || row[k] === undefined)) return false;
          if (row[k] === v.not) return false;
        } else if ('contains' in v) {
          if (typeof row[k] !== 'string' || !row[k].includes(v.contains)) return false;
        } else if ('gte' in v) {
          if (!(new Date(row[k]) >= new Date(v.gte))) return false;
        } else if ('lt' in v) {
          if (!(new Date(row[k]) < new Date(v.lt))) return false;
        } else if ('startsWith' in v) {
          if (typeof row[k] !== 'string' || !row[k].startsWith(v.startsWith)) return false;
        } else {
          if (row[k] !== v) return false;
        }
      } else if (Array.isArray(v)) {
        if (!Array.isArray(row[k]) || !v.every((x) => row[k].includes(x))) return false;
      } else {
        if (row[k] !== v) return false;
      }
    }
    return true;
  }

  private applyWhere(rows: any[], where: any): any[] {
    return rows.filter((r) => this.matchesWhere(r, where));
  }

  private applyOrder(rows: any[], orderBy: any): any[] {
    const entries = Object.entries(orderBy);
    return [...rows].sort((a, b) => {
      for (const [k, dir] of entries) {
        const av = a[k];
        const bv = b[k];
        const cmp =
          av instanceof Date && bv instanceof Date
            ? av.getTime() - bv.getTime()
            : av < bv
            ? -1
            : av > bv
            ? 1
            : 0;
        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  private applyInclude(row: any, include: any, model: string): any {
    const out = { ...row };
    for (const [relName, relVal] of Object.entries(include)) {
      const fk = `${relName}Id`;
      const isList = ['personas', 'niches', 'sources', 'accounts', 'posts', 'targets', 'messages', 'items', 'replies'].includes(relName);

      if (isList) {
        const reverseFk = this.inferReverseFk(model, relName);
        out[relName] = this.getModel(this.capitalize(relName)).filter((r: any) => r[reverseFk] === row.id);
        if (relVal && typeof relVal === 'object' && relVal.include) {
          out[relName] = out[relName].map((r: any) => this.applyInclude(r, relVal.include, this.capitalize(relName)));
        }
      } else {
        const fkId = row[fk];
        if (fkId == null) {
          out[relName] = null;
        } else {
          const relModel = this.capitalize(relName);
          out[relName] = this.getModel(relModel).find((r: any) => r.id === fkId) || null;
        }
      }
    }
    return out;
  }

  private inferReverseFk(parentModel: string, relationName: string): string {
    return parentModel.charAt(0).toLowerCase() + parentModel.slice(1) + 'Id';
  }

  private capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  $connect() {
    return Promise.resolve();
  }
  $disconnect() {
    return Promise.resolve();
  }
  $queryRaw() {
    return Promise.resolve([{ '?column?': 1 }]);
  }
}

export const mockStore = new MockStore();
