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
    AssistantConfig: [],
    AssistantMessage: [],
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
      defaultMode: 'APPROVAL',
      publishLanguage: 'tr',
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
  imageTemplate = this.proxy('ImageTemplate');
  auditLog = this.proxy('AuditLog');
  assistantConfig = this.proxy('AssistantConfig');
  assistantMessage = this.proxy('AssistantMessage');
  brandStrategy = this.proxy('BrandStrategy');
  contentPillar = this.proxy('ContentPillar');
  cadenceRule = this.proxy('CadenceRule');
  calendarSlot = this.proxy('CalendarSlot');
  repurposeSource = this.proxy('RepurposeSource');
  repurposeInsight = this.proxy('RepurposeInsight');
  trendSignal = this.proxy('TrendSignal');
  report = this.proxy('Report');
  engagementItem = this.proxy('EngagementItem');
  crisisEvent = this.proxy('CrisisEvent');
  impersonatorReport = this.proxy('ImpersonatorReport');

  private proxy(model: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- döndürülen closure'ların içinde this'e erişim için gerekli
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
        // Prisma `where` tekil herhangi bir alanla (id, @unique userId vb.) çağrılabilir —
        // sadece `id` varsaymak singleton config modellerinde (canvaConfig.update({where:{userId}}) gibi) kırılıyordu.
        const whereKey = Object.keys(args.where)[0];
        const idx = rows.findIndex((r) => r[whereKey] === args.where[whereKey]);
        if (idx === -1) throw new Error(`${model}#${args.where[whereKey]} bulunamadı`);
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
        const whereKey = Object.keys(args.where)[0];
        const idx = rows.findIndex((r) => r[whereKey] === args.where[whereKey]);
        if (idx === -1) throw new Error(`${model}#${args.where[whereKey]} bulunamadı`);
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
        const cond = v as any;
        if ('in' in cond) {
          if (!cond.in.includes(row[k])) return false;
        } else if ('not' in cond) {
          if (cond.not === null && (row[k] === null || row[k] === undefined)) return false;
          if (row[k] === cond.not) return false;
        } else if ('contains' in cond) {
          if (typeof row[k] !== 'string' || !row[k].includes(cond.contains)) return false;
        } else if ('gte' in cond) {
          if (!(new Date(row[k]) >= new Date(cond.gte))) return false;
        } else if ('lt' in cond) {
          if (!(new Date(row[k]) < new Date(cond.lt))) return false;
        } else if ('startsWith' in cond) {
          if (typeof row[k] !== 'string' || !row[k].startsWith(cond.startsWith)) return false;
        } else {
          if (row[k] !== cond) return false;
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

  // Prisma şemasındaki her include edilebilir ilişki için gerçek model adı + FK alanı.
  // Anahtar: "ParentModel.relationName". list=true ise `fk` çocuk modelde parent.id'yi
  // tutan alan; list=false ise `fk` parent satırında çocuğun id'sini tutan alan.
  private static readonly RELATIONS: Record<string, { model: string; fk: string; list: boolean }> = {
    'User.personas': { model: 'Persona', fk: 'userId', list: true },
    'User.sources': { model: 'NewsSource', fk: 'userId', list: true },
    'User.posts': { model: 'Post', fk: 'userId', list: true },
    'User.accounts': { model: 'SocialAccount', fk: 'userId', list: true },
    'User.niches': { model: 'Niche', fk: 'userId', list: true },
    'User.whatsappConfig': { model: 'WhatsAppConfig', fk: 'userId', list: false },
    'User.canvaConfig': { model: 'CanvaConfig', fk: 'userId', list: false },

    'Niche.user': { model: 'User', fk: 'userId', list: false },
    'Niche.sources': { model: 'NewsSource', fk: 'nicheId', list: true },
    'Niche.posts': { model: 'Post', fk: 'nicheId', list: true },

    'NewsSource.user': { model: 'User', fk: 'userId', list: false },
    'NewsSource.niche': { model: 'Niche', fk: 'nicheId', list: false },
    'NewsSource.items': { model: 'NewsItem', fk: 'sourceId', list: true },

    'NewsItem.source': { model: 'NewsSource', fk: 'sourceId', list: false },

    'Persona.user': { model: 'User', fk: 'userId', list: false },
    'Persona.posts': { model: 'Post', fk: 'personaId', list: true },
    'Persona.replies': { model: 'WhatsAppReply', fk: 'personaId', list: true },

    'Post.user': { model: 'User', fk: 'userId', list: false },
    'Post.persona': { model: 'Persona', fk: 'personaId', list: false },
    'Post.niche': { model: 'Niche', fk: 'nicheId', list: false },
    'Post.targets': { model: 'PostTarget', fk: 'postId', list: true },

    'PostTarget.post': { model: 'Post', fk: 'postId', list: false },
    'PostTarget.account': { model: 'SocialAccount', fk: 'accountId', list: false },

    'SocialAccount.user': { model: 'User', fk: 'userId', list: false },
    'SocialAccount.targets': { model: 'PostTarget', fk: 'accountId', list: true },

    'WhatsAppConfig.user': { model: 'User', fk: 'userId', list: false },
    'WhatsAppConfig.messages': { model: 'WhatsAppMessage', fk: 'configId', list: true },
    'WhatsAppConfig.replies': { model: 'WhatsAppReply', fk: 'configId', list: true },

    'WhatsAppMessage.config': { model: 'WhatsAppConfig', fk: 'configId', list: false },
    'WhatsAppMessage.reply': { model: 'WhatsAppReply', fk: 'replyId', list: false },

    'WhatsAppReply.config': { model: 'WhatsAppConfig', fk: 'configId', list: false },
    'WhatsAppReply.persona': { model: 'Persona', fk: 'personaId', list: false },
    'WhatsAppReply.messages': { model: 'WhatsAppMessage', fk: 'replyId', list: true },

    'CanvaConfig.user': { model: 'User', fk: 'userId', list: false },

    'User.brandStrategy': { model: 'BrandStrategy', fk: 'userId', list: false },
    'User.cadenceRules': { model: 'CadenceRule', fk: 'userId', list: true },
    'BrandStrategy.user': { model: 'User', fk: 'userId', list: false },
    'BrandStrategy.pillars': { model: 'ContentPillar', fk: 'strategyId', list: true },
    'ContentPillar.strategy': { model: 'BrandStrategy', fk: 'strategyId', list: false },
    'CadenceRule.user': { model: 'User', fk: 'userId', list: false },
    'User.calendarSlots': { model: 'CalendarSlot', fk: 'userId', list: true },
    'CalendarSlot.user': { model: 'User', fk: 'userId', list: false },
    'User.repurposeSources': { model: 'RepurposeSource', fk: 'userId', list: true },
    'RepurposeSource.user': { model: 'User', fk: 'userId', list: false },
    'RepurposeSource.insights': { model: 'RepurposeInsight', fk: 'sourceId', list: true },
    'RepurposeInsight.source': { model: 'RepurposeSource', fk: 'sourceId', list: false },
    'User.trendSignals': { model: 'TrendSignal', fk: 'userId', list: true },
    'TrendSignal.user': { model: 'User', fk: 'userId', list: false },
    'User.reports': { model: 'Report', fk: 'userId', list: true },
    'Report.user': { model: 'User', fk: 'userId', list: false },
    'User.engagementItems': { model: 'EngagementItem', fk: 'userId', list: true },
    'EngagementItem.user': { model: 'User', fk: 'userId', list: false },
    'EngagementItem.crisisEvent': { model: 'CrisisEvent', fk: 'crisisEventId', list: false },
    'User.crisisEvents': { model: 'CrisisEvent', fk: 'userId', list: true },
    'CrisisEvent.user': { model: 'User', fk: 'userId', list: false },
    'CrisisEvent.items': { model: 'EngagementItem', fk: 'crisisEventId', list: true },
    'User.impersonatorReports': { model: 'ImpersonatorReport', fk: 'userId', list: true },
    'ImpersonatorReport.user': { model: 'User', fk: 'userId', list: false },
  };

  private applyInclude(row: any, include: any, model: string): any {
    const out = { ...row };
    for (const [relName, relVal] of Object.entries(include)) {
      if (relName === '_count') {
        out._count = this.buildCount(row, relVal, model);
        continue;
      }

      const rel = MockStore.RELATIONS[`${model}.${relName}`];
      if (!rel) {
        out[relName] = null;
        continue;
      }

      if (rel.list) {
        let related = this.getModel(rel.model).filter((r: any) => r[rel.fk] === row.id);
        const nestedInclude = (relVal as any)?.include;
        if (nestedInclude) {
          related = related.map((r: any) => this.applyInclude(r, nestedInclude, rel.model));
        }
        out[relName] = related;
      } else {
        const fkId = row[rel.fk];
        out[relName] = fkId == null ? null : this.getModel(rel.model).find((r: any) => r.id === fkId) || null;
      }
    }
    return out;
  }

  private buildCount(row: any, countSpec: any, model: string): Record<string, number> {
    const select = countSpec && typeof countSpec === 'object' && countSpec.select ? countSpec.select : {};
    const result: Record<string, number> = {};
    for (const relName of Object.keys(select)) {
      const rel = MockStore.RELATIONS[`${model}.${relName}`];
      result[relName] = rel && rel.list
        ? this.getModel(rel.model).filter((r: any) => r[rel.fk] === row.id).length
        : 0;
    }
    return result;
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
