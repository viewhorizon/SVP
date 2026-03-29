type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_SECONDS = Number(process.env.VOTES_CACHE_TTL_SECONDS ?? 20);

const now = () => Date.now();

export const buildVotesCountCacheKey = (userId: string, activityId?: string | null) =>
  `votes:count:${userId}:${activityId ?? 'all'}`;

export const buildVotesLimitsCacheKey = (userId: string) => `votes:limits:${userId}`;

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS;
  store.set(key, {
    value,
    expiresAt: now() + safeTtl * 1000,
  });
}

export function invalidateVotesCacheForUser(userId: string) {
  const prefixCount = `votes:count:${userId}:`;
  const prefixLimits = `votes:limits:${userId}`;
  for (const key of store.keys()) {
    if (key.startsWith(prefixCount) || key === prefixLimits) {
      store.delete(key);
    }
  }
}
