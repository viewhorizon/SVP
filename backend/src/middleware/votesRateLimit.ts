import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './requireAuth';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = Number(process.env.VOTES_RATE_LIMIT_WINDOW_MS ?? 60_000);
const MAX_REQUESTS = Number(process.env.VOTES_RATE_LIMIT_MAX ?? 30);

const pruneInterval = Math.max(WINDOW_MS, 60_000);
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, pruneInterval).unref();

function getKey(req: AuthenticatedRequest) {
  const uid = req.user?.uid?.trim();
  if (uid) return `uid:${uid}`;
  const ip = req.ip || req.socket.remoteAddress || 'anonymous';
  return `ip:${ip}`;
}

export function votesRateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = getKey(req);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(MAX_REQUESTS - 1, 0)));
    return next();
  }

  current.count += 1;
  const remaining = Math.max(MAX_REQUESTS - current.count, 0);
  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

  if (current.count > MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(Math.ceil((current.resetAt - now) / 1000), 1);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Demasiadas solicitudes de votos en una ventana corta',
      retryAfterSeconds,
    });
  }

  return next();
}
