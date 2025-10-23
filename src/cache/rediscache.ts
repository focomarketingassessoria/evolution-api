import { ICache } from '@api/abstract/abstract.cache';
import { CacheConf, CacheConfRedis, ConfigService } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { BufferJSON } from 'baileys';
import { RedisClientType } from 'redis';

// Removido import direto — será opcional
let redisClient: RedisClientType | null = null;

export class RedisCache implements ICache {
  private readonly logger = new Logger('RedisCache');
  private client: RedisClientType | null = null;
  private conf: CacheConfRedis;

  constructor(
    private readonly configService: ConfigService,
    private readonly module: string,
  ) {
    this.conf = this.configService.get<CacheConf>('CACHE')?.REDIS;

    try {
      // Tenta importar o redisClient se estiver disponível
      const { redisClient: importedClient } = require('./rediscache.client');
      this.client = importedClient.getConnection();
    } catch (error) {
      this.logger.warn('Redis client not available. Continuing without Redis.');
    }
  }

  async get(key: string): Promise<any> {
    if (!this.client) return null;
    try {
      return JSON.parse(await this.client.get(this.buildKey(key)));
    } catch (error) {
      this.logger.error(error);
    }
  }

  async hGet(key: string, field: string) {
    if (!this.client) return null;
    try {
      const data = await this.client.hGet(this.buildKey(key), field);
      return data ? JSON.parse(data, BufferJSON.reviver) : null;
    } catch (error) {
      this.logger.error(error);
    }
  }

  async set(key: string, value: any, ttl?: number) {
    if (!this.client) return;
    try {
      await this.client.setEx(this.buildKey(key), ttl || this.conf?.TTL, JSON.stringify(value));
    } catch (error) {
      this.logger.error(error);
    }
  }

  async hSet(key: string, field: string, value: any) {
    if (!this.client) return;
    try {
      const json = JSON.stringify(value, BufferJSON.replacer);
      await this.client.hSet(this.buildKey(key), field, json);
    } catch (error) {
      this.logger.error(error);
    }
  }

  async has(key: string) {
    if (!this.client) return false;
    try {
      return (await this.client.exists(this.buildKey(key))) > 0;
    } catch (error) {
      this.logger.error(error);
    }
  }

  async delete(key: string) {
    if (!this.client) return 0;
    try {
      return await this.client.del(this.buildKey(key));
    } catch (error) {
      this.logger.error(error);
    }
  }

  async hDelete(key: string, field: string) {
    if (!this.client) return 0;
    try {
      return await this.client.hDel(this.buildKey(key), field);
    } catch (error) {
      this.logger.error(error);
    }
  }

  async deleteAll(appendCriteria?: string) {
    if (!this.client) return 0;
    try {
      const keys = await this.keys(appendCriteria);
      if (!keys?.length) return 0;
      return await this.client.del(keys);
    } catch (error) {
      this.logger.error(error);
    }
  }

  async keys(appendCriteria?: string) {
    if (!this.client) return [];
    try {
      const match = `${this.buildKey('')}${appendCriteria ? `${appendCriteria}:` : ''}*`;
      const keys = [];
      for await (const key of this.client.scanIterator({
        MATCH: match,
        COUNT: 100,
      })) {
        keys.push(key);
      }
      return [...new Set(keys)];
    } catch (error) {
      this.logger.error(error);
    }
  }

  buildKey(key: string) {
    return `${this.conf?.PREFIX_KEY || 'cache'}:${this.module}:${key}`;
  }
}
