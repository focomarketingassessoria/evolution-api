import { CacheConf, CacheConfRedis, configService } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { createClient, RedisClientType } from 'redis';

class Redis {
  private logger = new Logger('Redis');
  private client: RedisClientType | null = null;
  private conf: CacheConfRedis;
  private connected = false;

  constructor() {
    this.conf = configService.get<CacheConf>('CACHE')?.REDIS;

    // Se não tem URI configurada, não tenta conectar
    if (!this.conf?.URI) {
      this.logger.warn('Redis URI not found. Skipping Redis connection.');
    }
  }

  getConnection(): RedisClientType | null {
    if (!this.conf?.URI) {
      return null; // Garantia extra
    }

    if (this.connected && this.client) {
      return this.client;
    }

    try {
      this.client = createClient({
        url: this.conf.URI,
      });

      this.client.on('connect', () => {
        this.logger.verbose('redis connecting');
      });

      this.client.on('ready', () => {
        this.logger.verbose('redis ready');
        this.connected = true;
      });

      this.client.on('error', (err) => {
        this.logger.error('redis error: ' + err?.message);
        this.connected = false;
      });

      this.client.on('end', () => {
        this.logger.verbose('redis connection ended');
        this.connected = false;
      });

      this.client.connect().catch((err) => {
        this.logger.error('redis connect exception: ' + err?.message);
        this.connected = false;
      });

      return this.client;
    } catch (e) {
      this.logger.error('Unexpected Redis error: ' + e);
      return null;
    }
  }
}

export const redisClient = new Redis();
