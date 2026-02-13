import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeListTemplates, makeCreateTemplate } from "./templates.js";

describe("list_templates handler", () => {
  const mockClient = {
    appRequest: vi.fn(),
    resolveAppId: vi.fn((id: string | undefined) => id ?? "default-app"),
  };

  beforeEach(() => vi.resetAllMocks());

  it("calls GET /partner/app/{appId}/templates", async () => {
    mockClient.appRequest.mockResolvedValueOnce({
      status: "success",
      templates: [
        { id: "t1", elementName: "order_update", status: "APPROVED", templateType: "TEXT", category: "UTILITY", languageCode: "en_US", quality: "GREEN", reason: null },
      ],
    });

    const handler = makeListTemplates(mockClient as any);
    const result = await handler({ appId: "app-1" });

    expect(mockClient.appRequest).toHaveBeenCalledWith(
      "GET",
      "/partner/app/{appId}/templates",
      "app-1"
    );
    expect(result.content[0].text).toContain("order_update");
  });
});

describe("create_template handler", () => {
  const mockClient = {
    appRequest: vi.fn(),
    resolveAppId: vi.fn((id: string | undefined) => id ?? "default-app"),
  };

  beforeEach(() => vi.resetAllMocks());

  it("calls POST with correct form params", async () => {
    mockClient.appRequest.mockResolvedValueOnce({ status: "success" });

    const handler = makeCreateTemplate(mockClient as any);
    await handler({
      elementName: "order_shipped",
      languageCode: "en_US",
      category: "UTILITY",
      templateType: "TEXT",
      content: "Hi {{1}}, your order {{2}} shipped.",
      example: "Hi Rahul, your order ORD-123 shipped.",
    });

    expect(mockClient.appRequest).toHaveBeenCalledWith(
      "POST",
      "/partner/app/{appId}/templates",
      undefined,
      expect.objectContaining({
        elementName: "order_shipped",
        languageCode: "en_US",
        category: "UTILITY",
        templateType: "TEXT",
        content: "Hi {{1}}, your order {{2}} shipped.",
        enableSample: true,
      })
    );
  });
});
