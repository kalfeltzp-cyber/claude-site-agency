/**
 * Limitador de taxa em memória (janela deslizante por chave).
 * Em ambiente serverless cada instância tem o próprio contador, então o limite
 * é aproximado; para limite global use um armazenamento compartilhado
 * (ex.: Redis/Upstash) implementando a mesma interface. Ver README.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) {
    for (const [k, hits] of buckets) if (!hits.length || now - hits[hits.length - 1] > windowMs * 2) buckets.delete(k);
    lastSweep = now;
  }
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

/** Políticas por grupo de rotas (requisições por janela). */
export const RATE_LIMITS = {
  auth: { limit: 10, windowMs: 10 * 60_000 },
  startAttempt: { limit: 10, windowMs: 60 * 60_000 },
  answer: { limit: 240, windowMs: 60_000 },
  general: { limit: 120, windowMs: 60_000 },
  admin: { limit: 300, windowMs: 60_000 },
} as const;
