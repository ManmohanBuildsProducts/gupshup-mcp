import { describe, it, expect, vi, beforeEach } from "vitest";
import { GupshupClient } from "./client.js";
import { TokenManager } from "../auth/token-manager.js";

describe("GupshupClient", () => {
  const mockFetch = vi.fn();
  let client: GupshupClient;

  beforeEach(() => {
    vi.resetAllMocks();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", token: { token: "sk_test" } }),
      text: async () => "ok",
    });

    const tokenManager = new TokenManager({
      partnerToken: "jwt-test",
      baseUrl: "https://partner.gupshup.io",
      fetchFn: mockFetch,
    });

    client = new GupshupClient({
      tokenManager,
      baseUrl: "https://partner.gupshup.io",
      defaultAppId: "default-app",
      fetchFn: mockFetch,
    });
  });

  it("resolves appId from default when not provided", () => {
    expect(client.resolveAppId(undefined)).toBe("default-app");
  });

  it("resolves appId from override when provided", () => {
    expect(client.resolveAppId("custom-app")).toBe("custom-app");
  });

  it("throws when no appId and no default", () => {
    const noDefaultClient = new GupshupClient({
      tokenManager: new TokenManager({
        partnerToken: "jwt",
        baseUrl: "https://partner.gupshup.io",
        fetchFn: mockFetch,
      }),
      baseUrl: "https://partner.gupshup.io",
      fetchFn: mockFetch,
    });
    expect(() => noDefaultClient.resolveAppId(undefined)).toThrow("appId");
  });

  it("serializes form data correctly", () => {
    const result = client.toFormBody({
      source: "919999",
      template: { id: "abc", params: ["x"] },
    });
    expect(result).toContain("source=919999");
    expect(result).toContain("template=");
    expect(result).toContain(encodeURIComponent('{"id":"abc","params":["x"]}'));
  });
});
