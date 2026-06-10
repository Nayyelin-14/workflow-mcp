import { redis } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

const ratelimitInstances = new Map<string, Ratelimit>();

function getRatelimit(maxRequests: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;

  const key = `${maxRequests}:${windowMs}`;
  let instance = ratelimitInstances.get(key);
  if (!instance) {
    instance = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs}ms`),
    });
    ratelimitInstances.set(key, instance);
  }
  return instance;
}

const fallbackStore = new Map<string, { count: number; resetAt: number }>();

export type RateLimitResult =
  | { success: true; remaining: number }
  | { success: false; remaining: 0; retryAfterMs: number };

export async function rateLimit(
  key: string,
  config: { maxRequests: number; windowMs: number },
): Promise<RateLimitResult> {
  const { maxRequests, windowMs } = config;
  const ratelimit = getRatelimit(maxRequests, windowMs);

  if (ratelimit) {
    const { success, remaining, reset } = await ratelimit.limit(key);
    if (success) {
      return { success: true, remaining };
    }
    return {
      success: false,
      remaining: 0,
      retryAfterMs: Math.max(reset - Date.now(), 0),
    };
  }

  const now = Date.now();
  const record = fallbackStore.get(key);

  if (!record || now >= record.resetAt) {
    fallbackStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      retryAfterMs: record.resetAt - now,
    };
  }

  record.count += 1;
  return { success: true, remaining: maxRequests - record.count };
}

export function getRateLimitKey(userId?: string, ip?: string): string {
  return userId ?? ip ?? "anonymous";
}
