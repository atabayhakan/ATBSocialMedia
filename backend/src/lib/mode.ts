export const isMockMode =
  process.env.USE_MOCK === 'true' ||
  process.env.NODE_ENV === 'mock' ||
  process.env.USE_MOCK === '1';
