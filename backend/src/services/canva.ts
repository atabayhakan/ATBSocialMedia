import axios from 'axios';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import { extractImageTextForCanva } from './ai';

const CANVA_API = 'https://api.canva.com/rest/v1';

function canvaClient(accessToken: string) {
  return axios.create({
    baseURL: CANVA_API,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Canva Connect API, OAuth 2.0 Authorization Code akışında PKCE zorunlu kılıyor
// (code_verifier olmadan token exchange reddedilir).
export function generatePkce() {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function getAuthorizeUrl(state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    client_id: process.env.CANVA_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: process.env.CANVA_REDIRECT_URI || '',
    scope: 'design:content:read design:content:write design:meta:read asset:read asset:write',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 's256',
  });
  return `https://www.canva.com/api/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, userId: string, codeVerifier: string) {
  const { data } = await axios.post('https://api.canva.com/rest/v1/oauth/token', {
    grant_type: 'authorization_code',
    code,
    client_id: process.env.CANVA_CLIENT_ID,
    client_secret: process.env.CANVA_CLIENT_SECRET,
    redirect_uri: process.env.CANVA_REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  await prisma.canvaConfig.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: encryptSecret(data.access_token)!,
      refreshToken: encryptSecret(data.refresh_token)!,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    },
    update: {
      accessToken: encryptSecret(data.access_token)!,
      refreshToken: encryptSecret(data.refresh_token)!,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    },
  });
}

// Kullanıcı başına süren yenileme isteğini tut — aynı anda iki çağrı gelirse ikisi de
// aynı (rotate eden) refresh token'ı kullanıp biri invalid_grant almasın (single-flight).
const refreshInFlight = new Map<string, Promise<string>>();

async function refreshToken(userId: string, encryptedRefresh: string | null): Promise<string> {
  const { data } = await axios.post('https://api.canva.com/rest/v1/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: decryptSecret(encryptedRefresh),
    client_id: process.env.CANVA_CLIENT_ID,
    client_secret: process.env.CANVA_CLIENT_SECRET,
  });
  if (!data?.access_token) throw new Error('Canva token yenileme başarısız (access_token dönmedi)');
  // Sağlayıcı yenilemede yeni refresh_token vermezse eskisini KORU (null ile ezersek
  // bir sonraki yenileme kalıcı olarak kırılır). expires_in yoksa güvenli varsayılan
  // kullan (NaN → Invalid Date → yenileme hiç tetiklenmez tuzağını önler).
  const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  await prisma.canvaConfig.update({
    where: { userId },
    data: {
      accessToken: encryptSecret(data.access_token)!,
      refreshToken: data.refresh_token ? encryptSecret(data.refresh_token)! : encryptedRefresh,
      expiresAt: new Date(Date.now() + expiresInSec * 1000),
    },
  });
  return data.access_token as string;
}

async function getValidToken(userId: string): Promise<string> {
  const cfg = await prisma.canvaConfig.findUnique({ where: { userId } });
  if (!cfg) throw new Error('Canva bağlı değil');

  if (cfg.expiresAt.getTime() - Date.now() >= 60_000) {
    return decryptSecret(cfg.accessToken)!;
  }

  const existing = refreshInFlight.get(userId);
  if (existing) return existing;

  const p = refreshToken(userId, cfg.refreshToken).finally(() => refreshInFlight.delete(userId));
  refreshInFlight.set(userId, p);
  return p;
}

export async function listTemplates(userId: string) {
  const token = await getValidToken(userId);
  const { data } = await canvaClient(token).get('/designs', {
    params: { query: 'social', limit: 50 },
  });
  return data?.items || [];
}

export interface FilledDesign {
  id: string;
  exportUrl?: string;
}

export async function fillCanvaTemplate(
  userId: string,
  post: { title: string; body: string; hashtags: string[] },
  templateId?: string
): Promise<FilledDesign> {
  const token = await getValidToken(userId);

  let designId = templateId;
  if (!designId) {
    const templates = await listTemplates(userId);
    designId = templates[0]?.id;
  }
  if (!designId) throw new Error('Canva şablonu bulunamadı');

  const placeholders = ['headline', 'subheadline', 'body', 'hashtags'];
  const textMap = await extractImageTextForCanva(placeholders, {
    title: post.title,
    body: post.body,
    hashtags: post.hashtags,
    summary: post.title,
  });

  try {
    const autofill = await canvaClient(token).post(`/designs/${designId}/autofill`, {
      brand_template_id: designId,
      data: {
        headline: { type: 'text', text: textMap.headline || post.title },
        subheadline: { type: 'text', text: textMap.subheadline || '' },
        body: { type: 'text', text: textMap.body || post.body },
        hashtags: { type: 'text', text: (textMap.hashtags || post.hashtags.join(' ')).slice(0, 100) },
      },
    });
    const jobId = autofill.data?.job_id;
    if (jobId) {
      const result = await pollAutofillJob(token, jobId);
      return { id: result.design_id, exportUrl: result.export_url };
    }
  } catch (e: any) {
    logger.warn({ e: e?.response?.data }, 'Canva autofill başarısız, design meta okunacak');
  }

  return { id: designId };
}

async function pollAutofillJob(token: string, jobId: string, attempts = 20): Promise<any> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data } = await canvaClient(token).get(`/autofills/${jobId}`);
    if (data?.status === 'success') return data.result;
    if (data?.status === 'failed') throw new Error('Canva autofill başarısız');
  }
  throw new Error('Canva autofill zaman aşımı');
}
