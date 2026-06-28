// src/services/cache.service.ts
import redis from 'redis';
import { promisify } from 'util';

export class CacheService {
  private client: any;
  
  constructor() {
    if (process.env.REDIS_URL) {
      this.client = redis.createClient({ url: process.env.REDIS_URL });
      this.client.connect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.client) return;
    await this.client.set(key, JSON.stringify(value), {
      EX: ttlSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }
}