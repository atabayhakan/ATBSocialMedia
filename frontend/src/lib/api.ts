// Boş bırakılırsa göreli URL kullanılır: istekler aynı origin'e gider ve
// next.config.js rewrites (veya prod'da reverse proxy) backend'e yönlendirir.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || 'demo-user' : 'demo-user';
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    // Backend hataları { error: "..." } (bazen zod .flatten() nesnesi) döner —
    // ham JSON'ı toast'ta göstermek yerine mesajı çıkar.
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.error === 'string') message = parsed.error;
      else if (parsed?.error) message = JSON.stringify(parsed.error);
    } catch {
      // JSON değil (örn. HTML hata sayfası) — ham metni kullan
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: any) => request<T>(p, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(p: string, body?: any) => request<T>(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};
