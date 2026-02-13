import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenManager } from "./token-manager.js";

describe("TokenManager", () => {
  let manager: TokenManager;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    manager = new TokenManager({
      partnerToken: "test-partner-jwt",
      baseUrl: "https://partner.gupshup.io",
      fetchFn: mockFetch,
    });
  });

  it("throws if partnerToken is missing", () => {
    expect(
      () => new TokenManager({ partnerToken: "", baseUrl: "https://partner.gupshup.io" })
    ).toThrow("GUPSHUP_PARTNER_TOKEN");
  });

  it("returns partner token for account-scope requests", () => {
    expect(manager.getPartnerToken()).toBe("test-partner-jwt");
  });

  it("fetches and caches app token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        token: { token: "sk_abc123", expiresOn: 0, active: true },
      }),
    });

    const token = await manager.getAppToken("app-1");
    expect(token).toBe("sk_abc123");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const token2 = await manager.getAppToken("app-1");
    expect(token2).toBe("sk_abc123");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetches separate tokens for different apps", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          token: { token: "sk_app1", expiresOn: 0, active: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "success",
          token: { token: "sk_app2", expiresOn: 0, active: true },
        }),
      });

    const t1 = await manager.getAppToken("app-1");
    const t2 = await manager.getAppToken("app-2");
    expect(t1).toBe("sk_app1");
    expect(t2).toBe("sk_app2");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws on failed token fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(manager.getAppToken("bad-app")).rejects.toThrow();
  });

  it("throws descriptive error on unexpected token response shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", unexpected: "shape" }),
    });

    await expect(manager.getAppToken("bad-shape")).rejects.toThrow(
      "Unexpected token response"
    );
  });
});
