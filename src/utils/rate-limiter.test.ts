import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "./rate-limiter.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows requests under the limit", async () => {
    const allowed = await limiter.acquire("/templates");
    expect(allowed).toBe(true);
  });

  it("returns correct limit config for known endpoints", () => {
    const config = limiter.getLimitConfig("/templates");
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(60_000);
  });

  it("returns default config for unknown endpoints", () => {
    const config = limiter.getLimitConfig("/some/random/path");
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(1_000);
  });

  it("returns specific config for analytics endpoint", () => {
    const config = limiter.getLimitConfig("/template/analytics");
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(60_000);
  });

  it("returns specific config for subscription endpoint", () => {
    const config = limiter.getLimitConfig("/subscription");
    expect(config.maxRequests).toBe(5);
    expect(config.windowMs).toBe(60_000);
  });

  it("returns specific config for media endpoint", () => {
    const config = limiter.getLimitConfig("/media/");
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(1_000);
  });
});
