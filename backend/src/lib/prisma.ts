import { isMockMode } from './mode';

type AnyClient = any;

declare global {
  var __prisma: AnyClient | undefined;
}

function buildReal(): AnyClient {
  const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client');
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

function buildMock(): AnyClient {
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
