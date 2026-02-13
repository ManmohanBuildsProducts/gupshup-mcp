import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeListApps, makeGetUsageSummary, makeGetAppToken } from "./utility.js";

describe("list_apps", () => {
  const mockClient = { partnerRequest: vi.fn() };
  beforeEach(() => vi.resetAllMocks());

  it("calls partner-scope GET endpoint", async () => {
    mockClient.partnerRequest.mockResolvedValueOnce({
      partnerApps: [{ appId: "a1", name: "MyApp" }],
    });

    const handler = makeListApps(mockClient as any);
    const result = await handler({});

    expect(mockClient.partnerRequest).toHaveBeenCalledWith(
      "GET",
      "/partner/account/api/partnerApps"
    );
    expect(result.content[0].text).toContain("MyApp");
  });
});

describe("get_usage_summary", () => {
  const mockClient = { appRequest: vi.fn() };
  beforeEach(() => vi.resetAllMocks());

  it("passes date range as query params", async () => {
    mockClient.appRequest.mockResolvedValueOnce({ usage: [] });

    const handler = makeGetUsageSummary(mockClient as any);
    await handler({ from: "2026-01-01", to: "2026-01-31" });

    expect(mockClient.appRequest).toHaveBeenCalledWith(
      "GET",
      expect.stringContaining("from=2026-01-01"),
      undefined
    );
  });
});

describe("get_app_token", () => {
  const mockTokenManager = {
    getAppToken: vi.fn().mockResolvedValue("sk_debug_token"),
  };
  const mockClient = { tokenManager: mockTokenManager };
  beforeEach(() => vi.resetAllMocks());

  it("returns the fetched app token", async () => {
    mockTokenManager.getAppToken.mockResolvedValue("sk_debug_token");
    const handler = makeGetAppToken(mockClient as any);
    const result = await handler({ appId: "test-app" });

    expect(result.content[0].text).toContain("sk_debug_token");
  });
});
