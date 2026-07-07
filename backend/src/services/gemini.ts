import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { isMockMode } from '../lib/mode';

let textModel: GenerativeModel | null = null;
export let visionModel: GenerativeModel | null = null;

if (env.GEMINI_API_KEY && !isMockMode) {
  const genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  textModel = genai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-pro' });
  visionModel = genai.getGenerativeModel({ model: process.env.GEMINI_VISION_MODEL || 'gemini-1.5-flash' });
} else {
  logger.info('Gemini API key yok veya MOCK mod — sahte yanıtlar kullanılacak');
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

  if (!textModel) {
    return mockGeneratePost(news, lang);
  }

  const systemPrompt = `Sen bir sosyal medya içerik editörüsün. Görevin: kaynak haberi, belirtilen "persona" tonuyla hedef dile uygun, ilgi çekici, kısa ve öz bir sosyal medya gönderisine dönüştürmek.

Kurallar:
- Başlık: Maksimum 90 karakter, dikkat çekici.
- Metin: 600-1200 karakter, akıcı, kişisel ama profesyonel.
- Ton: ${persona.tone}
- Dil: ${lang}
${persona.voiceRules ? `- Ek kurallar: ${persona.voiceRules}` : ''}
${persona.forbiddenTopics ? `- Yasaklı konular: ${persona.forbiddenTopics}` : ''}
- Sonunda 4-6 adet ilgili hashtag ekle.

Sadece JSON döndür.`;

  const userPrompt = `Kaynak haber (${news.language}):
Başlık: ${news.title}
${news.summary ? `Özet: ${news.summary}` : ''}
${news.content ? `İçerik: ${news.content.slice(0, 4000)}` : ''}
URL: ${news.url}`;

  try {
    const result = await textModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    });
    const parsed = JSON.parse(result.response.text());
    return {
      title: parsed.title,
      body: parsed.body,
      hashtags: parsed.hashtags || [],
      summary: parsed.summary,
    };
  } catch (e: any) {
    logger.error({ e }, 'Gemini generatePostFromNews hatası');
    return mockGeneratePost(news, lang);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- imza generatePostFromNews ile simetrik tutuluyor
function mockGeneratePost(news: any, lang: string): GeneratedPost {
  const cleanTitle = news.title.replace(/\s+/g, ' ').trim();
  return {
    title: cleanTitle.length > 90 ? cleanTitle.slice(0, 87) + '...' : cleanTitle,
    body: `${cleanTitle}\n\n${news.summary || ''}\n\nDetaylar için kaynağa göz atın.`.slice(0, 800),
    hashtags: ['#teknoloji', '#yapayZeka', '#inovasyon', '#haber'],
    summary: news.summary || cleanTitle,
  };
}

export async function translate(text: string, targetLanguage: string): Promise<string> {
  if (!textModel) return text;
  try {
    const result = await textModel.generateContent(
      `Aşağıdaki metni ${targetLanguage} diline profesyonelce çevir:\n\n${text}`
    );
    return result.response.text().trim();
  } catch (e: any) {
    logger.error({ e }, 'Gemini translate hatası');
    return text;
  }
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

  if (!textModel) {
    return mockWhatsAppReply(incoming);
  }

  const systemPrompt = `Sen "${persona.name}" adlı bir müşteri temsilcisi / asistanısın.
Ton: ${persona.tone}
Dil: ${persona.language}
${persona.voiceRules ? `Ek kurallar: ${persona.voiceRules}` : ''}
${persona.forbiddenTopics ? `Yasaklı konular: ${persona.forbiddenTopics}` : ''}

Gelen mesajı analiz et, uygun, kısa, doğal bir yanıt üret.
- Ödeme, güvenlik, hukuk, öfke → isCritical: true
- Aksi → isCritical: false
Sadece JSON: {"reply": "...", "isCritical": bool}`;

  try {
    const result = await textModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\nGelen mesaj:\n' + incoming }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
    });
    const parsed = JSON.parse(result.response.text());
    return {
      reply: parsed.reply,
      isCritical: typeof parsed.isCritical === 'boolean' ? parsed.isCritical : false,
    };
  } catch (e: any) {
    logger.error({ e }, 'Gemini generateWhatsAppReply hatası');
    return mockWhatsAppReply(incoming);
  }
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
  if (!textModel) {
    const out: Record<string, string> = {};
    templatePlaceholders.forEach((p) => {
      if (p === 'headline') out[p] = post.title.slice(0, 60);
      else if (p === 'body') out[p] = post.body.slice(0, 220);
      else if (p === 'hashtags') out[p] = post.hashtags.join(' ').slice(0, 100);
      else out[p] = post.title;
    });
    return out;
  }

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

  try {
    const result = await textModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
    });
    return JSON.parse(result.response.text());
  } catch (e: any) {
    logger.error({ e }, 'Gemini extractImageTextForCanva hatası');
    throw e;
  }
}
