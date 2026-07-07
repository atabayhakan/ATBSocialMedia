import { isMockMode } from './mode';

type RedisLike = {
  ping(): Promise<string>;
  quit(): Promise<any>;
  get(k: string): Promise<string | null>;
  set(k: string, v: string, ...args: any[]): Promise<any>;
  del(k: string): Promise<number>;
  on(event: string, listener: (...args: any[]) => void): any;
};

declare global {
  var __redis: RedisLike | undefined;
}

class InMemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  async ping() {
    return 'PONG';
  }
  async quit() {
    this.store.clear();
    return 'OK';
  }
  async get(k: string) {
    const item = this.store.get(k);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.store.delete(k);
      return null;
    }
    return item.value;
  }
  async set(k: string, v: string, ...args: any[]) {
    let expiresAt: number | undefined;
    for (let i = 0; i < args.length; i++) {
      const a = String(args[i]).toUpperCase();
      if (a === 'EX' && args[i + 1]) expiresAt = Date.now() + Number(args[i + 1]) * 1000;
      if (a === 'PX' && args[i + 1]) expiresAt = Date.now() + Number(args[i + 1]);
    }
    this.store.set(k, { value: v, expiresAt });
    return 'OK';
  }
  async del(k: string) {
    return this.store.delete(k) ? 1 : 0;
  }
  on(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
    return this;
  }
}

function buildReal(): RedisLike {
  const IORedis = require('ioredis');
  return new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
}

export const redis: RedisLike = (() => {
  if (isMockMode) {
    if (!global.__redis) global.__redis = new InMemoryRedis();
    return global.__redis;
  }
  if (!global.__redis) global.__redis = buildReal();
  return global.__redis;
})();
