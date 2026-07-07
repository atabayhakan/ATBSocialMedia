// Testler her zaman mock modda çalışır: gerçek Postgres/Redis/AI gerekmez.
process.env.USE_MOCK = 'true';
process.env.NODE_ENV = 'test';
process.env.AI_API_KEY = '';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // test anahtarı (32 bayt hex)
