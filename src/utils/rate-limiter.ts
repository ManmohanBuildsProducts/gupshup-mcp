interface LimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

const ENDPOINT_LIMITS: Array<{ match: RegExp; config: LimitConfig }> = [
  { match: /\/templates$/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/token$/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/health$/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/capping$/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/template\/analytics/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/subscription/, config: { maxRequests: 5, windowMs: 60_000 } },
  { match: /\/media\//, config: { maxRequests: 10, windowMs: 1_000 } },
  { match: /\/account\/login/, config: { maxRequests: 10, windowMs: 60_000 } },
];

const DEFAULT_LIMIT: LimitConfig = { maxRequests: 10, windowMs: 1_000 };

export class RateLimiter {
  private buckets = new Map<string, BucketState>();

  getLimitConfig(endpoint: string): LimitConfig {
    for (const { match, config } of ENDPOINT_LIMITS) {
      if (match.test(endpoint)) return config;
    }
    return DEFAULT_LIMIT;
  }

  async acquire(endpoint: string): Promise<boolean> {
    const config = this.getLimitConfig(endpoint);
    const key = endpoint;
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: config.maxRequests, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed >= config.windowMs) {
      bucket.tokens = config.maxRequests;
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    const waitMs = config.windowMs - elapsed;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    bucket.tokens = config.maxRequests - 1;
    bucket.lastRefill = Date.now();
    return true;
  }
}
