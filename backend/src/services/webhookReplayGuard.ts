const seenKeys = new Map<string, number>();

const cleanupExpired = (nowMs: number) => {
  for (const [key, expiresAt] of seenKeys.entries()) {
    if (expiresAt <= nowMs) {
      seenKeys.delete(key);
    }
  }
};

export const checkAndStoreWebhookReplayKey = (key: string, ttlSeconds: number): boolean => {
  const now = Date.now();
  cleanupExpired(now);

  if (seenKeys.has(key)) {
    return false;
  }

  const safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 300;
  seenKeys.set(key, now + safeTtl * 1000);
  return true;
};

export const clearWebhookReplayGuardForTests = () => {
  seenKeys.clear();
};