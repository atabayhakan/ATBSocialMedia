import axios from 'axios';
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

export function getAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.CANVA_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: process.env.CANVA_REDIRECT_URI || '',
    scope: 'design:content:read design:content:write design:meta:read asset:read asset:write',
    state,
  });
  return `https://www.canva.com/api/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, userId: string) {
  const { data } = await axios.post('https://api.canva.com/rest/v1/oauth/token', {
    grant_type: 'authorization_code',
    code,
    client_id: process.env.CANVA_CLIENT_ID,
    client_secret: process.env.CANVA_CLIENT_SECRET,
    redirect_uri: process.env.CANVA_REDIRECT_URI,
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

async function getValidToken(userId: string) {
  const cfg = await prisma.canvaConfig.findUnique({ where: { userId } });
  if (!cfg) throw new Error('Canva bağlı değil');

  if (cfg.expiresAt.getTime() - Date.now() < 60_000) {
    const { data } = await axios.post('https://api.canva.com/rest/v1/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: decryptSecret(cfg.refreshToken),
      client_id: process.env.CANVA_CLIENT_ID,
      client_secret: process.env.CANVA_CLIENT_SECRET,
    });
    await prisma.canvaConfig.update({
      where: { userId },
      data: {
        accessToken: encryptSecret(data.access_token)!,
        refreshToken: encryptSecret(data.refresh_token)!,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });
    return data.access_token as string;
  }
  return decryptSecret(cfg.accessToken)!;
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
