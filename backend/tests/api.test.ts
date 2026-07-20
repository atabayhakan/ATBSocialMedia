// Mock modda API yüzeyi testleri — gerçek DB/Redis/AI olmadan çalışır.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';

const CREDENTIALS = { email: 'demo@atbsocialmedia.local', password: 'test-sifre-12345' };
let AUTH: { Authorization: string };

// İlk kurulum bootstrap'ı: mock store'daki seed demo-user'a şifre atar
// (register, sistemde henüz kimse şifre belirlememişken çalışır).
beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send({ ...CREDENTIALS, name: 'Demo Kullanıcı' });
  expect(res.status).toBe(201);
  AUTH = { Authorization: `Bearer ${res.body.token}` };
});

describe('GET /health', () => {
  it('mock modda ok döner', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('/api/auth', () => {
  it('doğru bilgilerle giriş yapar', async () => {
    const res = await request(app).post('/api/auth/login').send(CREDENTIALS);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(CREDENTIALS.email);
  });

  it('yanlış şifreyi reddeder', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: 'yanlis-sifre' });
    expect(res.status).toBe(401);
  });

  it('kurulum tamamlandıktan sonra register kapanır', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'baska@atbsocialmedia.local', password: 'baska-sifre-12345' });
    expect(res.status).toBe(403);
  });

  it('/me geçerli token ile profil döner', async () => {
    const res = await request(app).get('/api/auth/me').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(CREDENTIALS.email);
  });

  it('/me token olmadan 401 döner', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('/api/personas', () => {
  it('seed personasını listeler', async () => {
    const res = await request(app).get('/api/personas').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.some((p: any) => p.isDefault)).toBe(true);
  });
});

describe('/api/settings', () => {
  it('varsayılanları döner', async () => {
    const res = await request(app).get('/api/settings').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.defaultMode).toBe('APPROVAL');
    expect(res.body.publishLanguage).toBe('tr');
  });

  it('yayın dilini günceller ve geçersiz değeri reddeder', async () => {
    const ok = await request(app).put('/api/settings').set(AUTH).send({ publishLanguage: 'en' });
    expect(ok.status).toBe(200);
    expect(ok.body.publishLanguage).toBe('en');

    const bad = await request(app).put('/api/settings').set(AUTH).send({ defaultMode: 'YANLIS' });
    expect(bad.status).toBe(400);
  });
});

describe('/api/sources', () => {
  it('oturum olmadan 401 döner', async () => {
    const res = await request(app).get('/api/sources');
    expect(res.status).toBe(401);
  });

  it('geçersiz Bearer token ile 401 döner', async () => {
    const res = await request(app).get('/api/sources').set({ Authorization: 'Bearer gecersiz-token' });
    expect(res.status).toBe(401);
  });

  it('geçersiz URL ile kaynak eklemeyi reddeder', async () => {
    const res = await request(app)
      .post('/api/sources')
      .set(AUTH)
      .send({ type: 'RSS', url: 'gecersiz', name: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('/api/mcp (JSON-RPC)', () => {
  it('initialize protokol el sıkışması yapar', async () => {
    const res = await request(app)
      .post('/api/mcp')
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    expect(res.status).toBe(200);
    expect(res.body.result.serverInfo.name).toBe('atbsocialmedia');
    expect(res.body.result.protocolVersion).toBe('2025-06-18');
  });

  it('tools/list 8 araç döner', async () => {
    const res = await request(app).post('/api/mcp').send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(res.body.result.tools).toHaveLength(8);
  });

  it('get_status aracı canlı bağlam döner', async () => {
    const res = await request(app)
      .post('/api/mcp')
      .send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_status', arguments: {} } });
    expect(res.body.result.content[0].text).toContain('CANLI SİSTEM DURUMU');
  });

  it('bilinmeyen metodu reddeder ve bildirimlere 202 döner', async () => {
    const unknown = await request(app).post('/api/mcp').send({ jsonrpc: '2.0', id: 4, method: 'yok/boyle' });
    expect(unknown.body.error.code).toBe(-32601);

    const notif = await request(app)
      .post('/api/mcp')
      .send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(notif.status).toBe(202);
  });
});

describe('/api/assistant', () => {
  it('config varsayılanları döner ve key asla sızmaz', async () => {
    const res = await request(app).get('/api/assistant/config').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hasKey');
    expect(res.body).not.toHaveProperty('apiKey');
  });

  it('tanı raporu üretir', async () => {
    const res = await request(app).get('/api/assistant/report').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Tanı Raporu');
  });
});
