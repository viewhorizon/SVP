/**
 * sp3-04: Rate limiting distribuido con Redis/Upstash
 * Proporciona alternativa distribuida al middleware votesRateLimit
 * para entornos multi-instancia
 */

export type RateLimitConfig = {
  key: string; // Identificador del límite (ej: userId, IP, sourceApp)
  limit: number; // Solicitudes permitidas
  window: number; // Ventana de tiempo en segundos
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // timestamp en ms
  retryAfter?: number; // segundos hasta poder reintentar
};

/**
 * sp3-04: Interfaz genérica para backends de rate limit
 * Permite usar Redis, Upstash, Valkey, etc.
 */
export interface RateLimitBackend {
  check(config: RateLimitConfig): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  getStats(pattern?: string): Promise<Record<string, number>>;
}

/**
 * sp3-04: Implementación con Redis generic
 */
export class RedisRateLimiter implements RateLimitBackend {
  constructor(private redisClient: any) {}

  async check(config: RateLimitConfig): Promise<RateLimitResult> {
    const key = `ratelimit:${config.key}`;
    const now = Date.now();
    const windowStart = now - config.window * 1000;
    const windowEnd = now + config.window * 1000;

    // Usar sorted set para tracking por timestamp
    // Remover entradas fuera de la ventana
    await this.redisClient.zremrangebyscore(key, '-inf', windowStart);

    // Contar solicitudes en la ventana actual
    const count = await this.redisClient.zcard(key);

    if (count >= config.limit) {
      // Obtener timestamp del evento más antiguo
      const oldest = await this.redisClient.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldest?.[1] ? Number(oldest[1]) : windowStart;
      const resetAt = Math.ceil(oldestTimestamp + config.window * 1000);
      const retryAfter = Math.ceil((resetAt - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // Agregar nueva solicitud
    await this.redisClient.zadd(key, now, `${now}-${Math.random()}`);

    // Establecer expiración
    await this.redisClient.expire(key, config.window + 1);

    return {
      allowed: true,
      remaining: config.limit - count - 1,
      resetAt: windowEnd,
    };
  }

  async reset(key: string): Promise<void> {
    await this.redisClient.del(`ratelimit:${key}`);
  }

  async getStats(pattern?: string): Promise<Record<string, number>> {
    const keys = await this.redisClient.keys(
      pattern ? `ratelimit:${pattern}*` : 'ratelimit:*'
    );

    const stats: Record<string, number> = {};

    for (const key of keys) {
      const count = await this.redisClient.zcard(key);
      const cleanKey = key.replace('ratelimit:', '');
      stats[cleanKey] = count;
    }

    return stats;
  }
}

/**
 * sp3-04: Implementación con Upstash Redis HTTP
 * Usa API HTTP de Upstash para rate limiting sin conexión persistente
 */
export class UpstashRateLimiter implements RateLimitBackend {
  constructor(
    private baseUrl: string,
    private token: string
  ) {}

  private async executeCommand(...args: string[]): Promise<unknown> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/exec`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      }
    );

    if (!response.ok) {
      throw new Error(`Upstash error: ${response.statusText}`);
    }

    const data = await response.json() as { result?: unknown };
    return data.result;
  }

  async check(config: RateLimitConfig): Promise<RateLimitResult> {
    const key = `ratelimit:${config.key}`;
    const now = Date.now();
    const windowStart = now - config.window * 1000;
    const windowEnd = now + config.window * 1000;

    try {
      // Remover entradas fuera de ventana
      await this.executeCommand(
        'ZREMRANGEBYSCORE',
        key,
        '-inf',
        String(windowStart)
      );

      // Contar solicitudes en ventana
      const countResult = await this.executeCommand('ZCARD', key);
      const count = Number(countResult || 0);

      if (count >= config.limit) {
        // Obtener timestamp más antiguo
        const rangeResult = await this.executeCommand(
          'ZRANGE',
          key,
          '0',
          '0',
          'WITHSCORES'
        ) as unknown[];

        const oldestTimestamp = rangeResult?.[1]
          ? Number(rangeResult[1])
          : windowStart;
        const resetAt = Math.ceil(oldestTimestamp + config.window * 1000);
        const retryAfter = Math.ceil((resetAt - now) / 1000);

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }

      // Agregar nueva solicitud
      const requestId = `${now}-${Math.random()}`;
      await this.executeCommand('ZADD', key, String(now), requestId);

      // Establecer expiración
      await this.executeCommand('EXPIRE', key, String(config.window + 1));

      return {
        allowed: true,
        remaining: config.limit - count - 1,
        resetAt: windowEnd,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Rate limit check failed: ${message}`);
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.executeCommand('DEL', `ratelimit:${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Rate limit reset failed: ${message}`);
    }
  }

  async getStats(pattern?: string): Promise<Record<string, number>> {
    try {
      const searchPattern = pattern ? `ratelimit:${pattern}*` : 'ratelimit:*';
      const keys = (await this.executeCommand('KEYS', searchPattern)) as string[];
      const stats: Record<string, number> = {};

      for (const key of keys || []) {
        const count = await this.executeCommand('ZCARD', key);
        const cleanKey = key.replace('ratelimit:', '');
        stats[cleanKey] = Number(count || 0);
      }

      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get stats: ${message}`);
    }
  }
}

/**
 * sp3-04: Factory para crear rate limiter según configuración
 */
export function createRateLimiter(
  config: { type: 'redis' | 'upstash'; [key: string]: unknown }
): RateLimitBackend {
  if (config.type === 'upstash') {
    const baseUrl = String(config.baseUrl || '');
    const token = String(config.token || '');

    if (!baseUrl || !token) {
      throw new Error(
        'Upstash rate limiter requires baseUrl and token'
      );
    }

    return new UpstashRateLimiter(baseUrl, token);
  }

  if (config.type === 'redis') {
    const client = config.client;
    if (!client) {
      throw new Error('Redis rate limiter requires client');
    }
    return new RedisRateLimiter(client);
  }

  throw new Error(`Unknown rate limiter type: ${config.type}`);
}
