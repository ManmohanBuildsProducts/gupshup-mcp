import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeEnableAnalytics,
  makeGetAnalytics,
  makeCompareTemplates,
  makeGetAppHealth,
} from "./analytics.js";

describe("enable_template_analytics", () => {
  const mockClient = { appRequest: vi.fn() };
  beforeEach(() => vi.resetAllMocks());

  it("sends POST with enable flag", async () => {
    mockClient.appRequest.mockResolvedValueOnce({ status: "success" });
    const handler = makeEnableAnalytics(mockClient as any);
    await handler({ enable: true });

    expect(mockClient.appRequest).toHaveBeenCalledWith(
      "POST",
      "/partner/app/{appId}/template/analytics",
      undefined,
      { enable: true }
    );
  });
});

describe("get_template_analytics", () => {
  const mockClient = {
    appRequest: vi.fn(),
    resolveAppId: vi.fn((id: string | undefined) => id ?? "default-app"),
  };
  beforeEach(() => vi.resetAllMocks());

  it("passes query params and returns analytics", async () => {
    mockClient.appRequest.mockResolvedValueOnce({
      status: "success",
      template_analytics: [{ template_id: "t1", sent: 100, delivered: 95, read: 80, start: 1711929610, end: 1712188810 }],
    });

    const handler = makeGetAnalytics(mockClient as any);
    const result = await handler({
      start: 1711929610,
      end: 1712188810,
      templateIds: ["t1", "t2"],
      granularity: "DAILY",
    });

    expect(result.content[0].text).toContain("t1");
    expect(result.content[0].text).toContain("100");
  });
});

describe("compare_templates", () => {
  const mockClient = { appRequest: vi.fn() };
  beforeEach(() => vi.resetAllMocks());

  it("calls compare endpoint", async () => {
    mockClient.appRequest.mockResolvedValueOnce({ status: "success", data: {} });
    const handler = makeCompareTemplates(mockClient as any);
    await handler({
      templateId: "t1",
      templateList: ["t2", "t3"],
      start: 1711929610,
      end: 1712534410,
    });

    expect(mockClient.appRequest).toHaveBeenCalledWith(
      "GET",
      expect.stringContaining("/template/analytics/t1/compare"),
      undefined
    );
  });
});

describe("get_app_health", () => {
  const mockClient = { appRequest: vi.fn() };
  beforeEach(() => vi.resetAllMocks());

  it("combines three API calls", async () => {
    mockClient.appRequest
      .mockResolvedValueOnce({ status: "ok" })
      .mockResolvedValueOnce({ qualityRating: "GREEN" })
      .mockResolvedValueOnce({ balance: 5000 });

    const handler = makeGetAppHealth(mockClient as any);
    const result = await handler({});

    expect(mockClient.appRequest).toHaveBeenCalledTimes(3);
    expect(result.content[0].text).toContain("GREEN");
    expect(result.content[0].text).toContain("5000");
  });
});
