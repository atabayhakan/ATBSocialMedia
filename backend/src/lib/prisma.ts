import { isMockMode } from './mode';

type AnyClient = any;

declare global {
  // eslint-disable-next-line no-var -- TS global augmentation gerektiriyor, let/const kullanılamaz
  var __prisma: AnyClient | undefined;
}

function buildReal(): AnyClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock modda @prisma/client'ın yüklü olması gerekmesin diye tembel require
  const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client');
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

function buildMock(): AnyClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- gerçek modda mockStore'un yüklü olması gerekmesin diye tembel require
  return require('./mockStore').mockStore;
}

export const prisma: AnyClient = (() => {
  if (isMockMode) {
    if (!global.__prisma) global.__prisma = buildMock();
    return global.__prisma;
  }
  if (!global.__prisma) global.__prisma = buildReal();
  return global.__prisma;
})();

if (process.env.NODE_ENV !== 'production') {
  // keep reference
}
