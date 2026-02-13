import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSendTemplateMessage } from "./messaging.js";

describe("send_template_message handler", () => {
  const mockClient = {
    appRequest: vi.fn(),
    resolveAppId: vi.fn((id: string | undefined) => id ?? "default-app"),
  };

  beforeEach(() => vi.resetAllMocks());

  it("sends with correct V2 payload shape", async () => {
    mockClient.appRequest.mockResolvedValueOnce({
      status: "submitted",
      messageId: "msg-abc-123",
    });

    const handler = makeSendTemplateMessage(mockClient as any);
    const result = await handler({
      source: "919643874844",
      destination: "918886912227",
      srcName: "MyBrand",
      template: { id: "tmpl-uuid", params: ["Rahul", "ORD-123"] },
      message: { type: "text" as const, text: "Hi Rahul, order ORD-123 shipped!" },
    });

    expect(mockClient.appRequest).toHaveBeenCalledWith(
      "POST",
      "/partner/app/{appId}/template/msg",
      undefined,
      {
        source: "919643874844",
        destination: "918886912227",
        "src.name": "MyBrand",
        template: { id: "tmpl-uuid", params: ["Rahul", "ORD-123"] },
        message: { type: "text", text: "Hi Rahul, order ORD-123 shipped!" },
      }
    );

    expect(result.content[0].text).toContain("msg-abc-123");
  });
});
