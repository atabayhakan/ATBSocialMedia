// Sağlayıcı-bağımsız LLM servisi. OpenAI-uyumlu /chat/completions API'si kullanan
// her sağlayıcıyla çalışır (Groq, OpenRouter, Cerebras, Mistral, Ollama...).
// Sağlayıcı seçimi backend/.env üzerinden: AI_BASE_URL + AI_MODEL + AI_API_KEY.
// AI_API_KEY boşsa tüm fonksiyonlar mock yanıtlara düşer (geliştirme/mock mod).
import axios from 'axios';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { isMockMode } from '../lib/mode';

const aiEnabled = !!env.AI_API_KEY && !isMockMode;

if (!aiEnabled) {
  logger.info('AI_API_KEY yok veya MOCK mod — sahte yanıtlar kullanılacak');
}

export interface AiProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModels?: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function systemProvider(): AiProvider {
  return {
    baseUrl: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    fallbackModels: env.AI_FALLBACK_MODELS.split(',').map((m) => m.trim()).filter(Boolean),
  };
}

export async function chatWithProvider(
  provider: AiProvider,
  messages: ChatMessage[],
  opts: { temperature: number; json?: boolean }
): Promise<string | null> {
  if (!provider.apiKey) return null;
  const fallbacks = provider.fallbackModels || [];
  try {
    const { data } = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: provider.model,
        // OpenRouter: biri rate-limit'liyse sıradaki modele otomatik geçer (en fazla 3 model)
        ...(fallbacks.length ? { models: [provider.model, ...fallbacks].slice(0, 3) } : {}),
        messages,
        temperature: opts.temperature,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      },
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        // Ücretsiz modeller yoğunlukta yavaşlayabiliyor; 60sn sınırda kalıyor
        timeout: 120_000,
      }
    );
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (e: any) {
    logger.error({ e: e?.response?.data || e.message }, 'AI chatWithProvider hatası');
    return null;
  }
}

async function chatCompletion(
  prompt: string,
  opts: { temperature: number; json: boolean }
): Promise<string | null> {
  if (!aiEnabled) return null;
  return chatWithProvider(systemProvider(), [{ role: 'user', content: prompt }], opts);
}

async function chatJson(prompt: string, temperature: number): Promise<any | null> {
  const raw = await chatCompletion(prompt, { temperature, json: true });
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    logger.error({ raw: raw.slice(0, 200) }, 'AI JSON parse hatası');
    return null;
  }
}

export interface PersonaConfig {
  name: string;
  tone: string;
  language: string;
  voiceRules?: string | null;
  forbiddenTopics?: string | null;
}

export interface GeneratedPost {
  title: string;
  body: string;
  hashtags: string[];
  summary: string;
}

export async function generatePostFromNews(
  news: { title: string; summary?: string | null; content?: string | null; url: string; language: string },
  persona: PersonaConfig,
  targetLanguage?: string
): Promise<GeneratedPost> {
  const lang = targetLanguage || persona.language || 'tr';

  const prompt = `Sen bir sosyal medya içerik editörüsün. Görevin: kaynak haberi, belirtilen "persona" tonuyla hedef dile uygun, ilgi çekici, kısa ve öz bir sosyal medya gönderisine dönüştürmek.

Kurallar:
- Başlık: Maksimum 90 karakter, dikkat çekici.
- Metin: 600-1200 karakter, akıcı, kişisel ama profesyonel.
- Ton: ${persona.tone}
- Dil: ${lang}
${persona.voiceRules ? `- Ek kurallar: ${persona.voiceRules}` : ''}
${persona.forbiddenTopics ? `- Yasaklı konular: ${persona.forbiddenTopics}` : ''}
- Sonunda 4-6 adet ilgili hashtag ekle.
- Sadece verilen haber içeriğindeki bilgiyi kullan; dışarıdan bilgi, yorum veya tahmin ekleme.

Sadece şu şemada JSON döndür: {"title": "...", "body": "...", "hashtags": ["#..."], "summary": "..."}

Kaynak haber (${news.language}):
Başlık: ${news.title}
${news.summary ? `Özet: ${news.summary}` : ''}
${news.content ? `İçerik: ${news.content.slice(0, 4000)}` : ''}
URL: ${news.url}`;

  const parsed = await chatJson(prompt, 0.7);
  if (parsed?.title && parsed?.body) {
    return {
      title: parsed.title,
      body: parsed.body,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      summary: parsed.summary || parsed.title,
    };
  }
  return mockGeneratePost(news);
}

function mockGeneratePost(news: any): GeneratedPost {
  const cleanTitle = news.title.replace(/\s+/g, ' ').trim();
  return {
    title: cleanTitle.length > 90 ? cleanTitle.slice(0, 87) + '...' : cleanTitle,
    body: `${cleanTitle}\n\n${news.summary || ''}\n\nDetaylar için kaynağa göz atın.`.slice(0, 800),
    hashtags: ['#teknoloji', '#yapayZeka', '#inovasyon', '#haber'],
    summary: news.summary || cleanTitle,
  };
}

export async function translate(text: string, targetLanguage: string): Promise<string> {
  const result = await chatCompletion(
    `Aşağıdaki metni ${targetLanguage} diline profesyonelce çevir. Açıklama ekleme, sadece çeviriyi döndür:\n\n${text}`,
    { temperature: 0.3, json: false }
  );
  return result?.trim() || text;
}

export interface WhatsAppReplyInput {
  incoming: string;
  persona: PersonaConfig;
  isCritical?: boolean;
}

export interface WhatsAppReplyOutput {
  reply: string;
  isCritical: boolean;
}

export async function generateWhatsAppReply(input: WhatsAppReplyInput): Promise<WhatsAppReplyOutput> {
  const { incoming, persona } = input;

  const prompt = `Sen "${persona.name}" adlı bir müşteri temsilcisi / asistanısın.
Ton: ${persona.tone}
Dil: ${persona.language}
${persona.voiceRules ? `Ek kurallar: ${persona.voiceRules}` : ''}
${persona.forbiddenTopics ? `Yasaklı konular: ${persona.forbiddenTopics}` : ''}

Gelen mesajı analiz et, uygun, kısa, doğal bir yanıt üret.
- Ödeme, güvenlik, hukuk, öfke → isCritical: true
- Aksi → isCritical: false
Sadece JSON döndür: {"reply": "...", "isCritical": bool}

Gelen mesaj:
${incoming}`;

  const parsed = await chatJson(prompt, 0.6);
  if (parsed?.reply) {
    return {
      reply: parsed.reply,
      isCritical: typeof parsed.isCritical === 'boolean' ? parsed.isCritical : false,
    };
  }
  return mockWhatsAppReply(incoming);
}

function mockWhatsAppReply(incoming: string): WhatsAppReplyOutput {
  const lower = incoming.toLowerCase();
  const critical = /ödeme|fatura|şikayet|hukuk|dava|avukat|sinirli|sahte|para|iban/.test(lower);
  return {
    reply: critical
      ? 'Mesajınızı aldım, sizinle en kısa sürede ilgileneceğiz. Acil konularda destek ekibimiz devreye girecek.'
      : 'Merhaba! Mesajınız için teşekkürler. Size nasıl yardımcı olabilirim?',
    isCritical: critical,
  };
}

export async function extractImageTextForCanva(
  templatePlaceholders: string[],
  post: GeneratedPost
): Promise<Record<string, string>> {
  const prompt = `Aşağıdaki sosyal medya gönderisi için Canva şablonundaki yer tutuculara (placeholders) yerleştirilecek metinleri üret. Sadece JSON döndür.

Yer tutucular: ${JSON.stringify(templatePlaceholders)}

Gönderi:
Başlık: ${post.title}
Metin: ${post.body}
Hashtag'ler: ${post.hashtags.join(' ')}
Özet: ${post.summary}

Kurallar:
- Her placeholder için uygun uzunlukta metin üret.
- Karakter sınırlarına dikkat et (başlık: max 60, gövde: max 220).`;

  const parsed = await chatJson(prompt, 0.5);
  if (parsed && typeof parsed === 'object') return parsed;

  const out: Record<string, string> = {};
  templatePlaceholders.forEach((p) => {
    if (p === 'headline') out[p] = post.title.slice(0, 60);
    else if (p === 'body') out[p] = post.body.slice(0, 220);
    else if (p === 'hashtags') out[p] = post.hashtags.join(' ').slice(0, 100);
    else out[p] = post.title;
  });
  return out;
}
