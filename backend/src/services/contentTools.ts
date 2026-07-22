// Küçük, bağımsız AI-destekli yazım araçları — mevcut bir taslağı (title/body) girdi
// alıp öneri üretirler. Hepsi ai.ts'in chatJson çekirdeğini kullanır, kendi state'leri yok.
import { chatJson } from './ai';

export interface HookSuggestion {
  hook: string;
  score: number;
}

export async function suggestHooks(title: string, body: string): Promise<HookSuggestion[]> {
  const prompt = `Sen bir sosyal medya metin yazarısın. Aşağıdaki gönderi için 5 farklı "hook" (dikkat çekici açılış cümlesi) varyasyonu üret. Her biri farklı bir yaklaşım kullansın (soru, çarpıcı rakam/istatistik, karşıt görüş, kısa hikaye, doğrudan fayda vurgusu).

Her hook'u 1-10 arası bir "güç skoru" ile değerlendir (merak uyandırma + özgüllük).

Sadece şu şemada JSON döndür: {"hooks": [{"hook": "...", "score": 8}, ...]}

Gönderi başlığı: ${title}
Gönderi metni: ${body.slice(0, 500)}`;

  const parsed = await chatJson(prompt, 0.8);
  if (Array.isArray(parsed?.hooks) && parsed.hooks.length) {
    return parsed.hooks
      .filter((h: any) => h?.hook)
      .map((h: any) => ({ hook: String(h.hook), score: Number(h.score) || 5 }))
      .slice(0, 5);
  }
  return [{ hook: title, score: 5 }];
}

export interface CtaSuggestion {
  cta: string;
  rationale: string;
}

export async function suggestCTA(title: string, body: string): Promise<CtaSuggestion> {
  const prompt = `Sen bir sosyal medya metin yazarısın. Aşağıdaki gönderi için tek bir CTA (harekete geçirici çağrı) cümlesi öner — gönderinin sunduğu değere orantılı olsun (yüksek değerli içerikte agresif satış CTA'sı kullanma).

Sadece şu şemada JSON döndür: {"cta": "...", "rationale": "neden bu CTA uygun, tek cümle"}

Gönderi başlığı: ${title}
Gönderi metni: ${body.slice(0, 500)}`;

  const parsed = await chatJson(prompt, 0.6);
  if (parsed?.cta) {
    return { cta: String(parsed.cta), rationale: String(parsed.rationale || '') };
  }
  return { cta: 'Ne düşünüyorsun? Yorumlarda paylaş.', rationale: 'AI şu an kullanılamıyor — genel CTA döndürüldü.' };
}
