import { describe, expect, it, vi } from "vitest";
import { GupshupEnterpriseClient } from "./client.js";

describe("GupshupEnterpriseClient", () => {
  it("sends WhatsApp template as form-urlencoded with credentials", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "success | 919999999999 | abc-123",
    });

    const client = new GupshupEnterpriseClient({
      smsEndpoint: "https://sms.example/rest",
      whatsappEndpoint: "https://wa.example/rest",
      whatsappUserId: "wa-user",
      whatsappPassword: "wa-pass",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await client.whatsappSendTemplate({
      sendTo: "919999999999",
      templateId: "7091229",
      variables: { var1: "Rupesh" },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://wa.example/rest");
    expect(options.method).toBe("POST");
    expect(String(options.body)).toContain("userid=wa-user");
    expect(String(options.body)).toContain("password=wa-pass");
    expect(String(options.body)).toContain("template_id=7091229");
    expect(String(options.body)).toContain("var1=Rupesh");
  });

  it("uses GET with query params for opt-in", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ response: "ok" }),
    });

    const client = new GupshupEnterpriseClient({
      smsEndpoint: "https://sms.example/rest",
      whatsappEndpoint: "https://wa.example/rest",
      whatsappUserId: "wa-user",
      whatsappPassword: "wa-pass",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await client.whatsappOptIn("919999999999");

    const [url, options] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("GET");
    expect(url).toContain("https://wa.example/rest?");
    expect(url).toContain("method=OPT_IN");
    expect(url).toContain("phone_number=919999999999");
    expect(url).toContain("userid=wa-user");
  });

  it("retries on retryable HTTP status and then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "service unavailable" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "success | 919999999999 | ok" });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const client = new GupshupEnterpriseClient({
      smsEndpoint: "https://sms.example/rest",
      whatsappEndpoint: "https://wa.example/rest",
      whatsappUserId: "wa-user",
      whatsappPassword: "wa-pass",
      fetchFn: fetchFn as unknown as typeof fetch,
      sleepFn,
      randomFn: () => 0,
      maxRetries: 2,
      retryBaseMs: 100,
      retryJitterMs: 0,
    });

    const result = await client.whatsappOptIn("919999999999");

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect((result as { status: string }).status).toBe("success");
  });

  it("does not retry on non-retryable HTTP status", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const client = new GupshupEnterpriseClient({
      smsEndpoint: "https://sms.example/rest",
      whatsappEndpoint: "https://wa.example/rest",
      whatsappUserId: "wa-user",
      whatsappPassword: "wa-pass",
      fetchFn: fetchFn as unknown as typeof fetch,
      sleepFn,
      maxRetries: 3,
    });

    await expect(client.whatsappOptIn("919999999999")).rejects.toThrow("HTTP 401");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("redacts sensitive data in logs", async () => {
    const logs: string[] = [];
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "success | 919999999999 | abc-123",
    });

    const client = new GupshupEnterpriseClient({
      smsEndpoint: "https://sms.example/rest",
      whatsappEndpoint: "https://wa.example/rest",
      whatsappUserId: "wa-user-1234",
      whatsappPassword: "wa-pass-secret",
      fetchFn: fetchFn as unknown as typeof fetch,
      logLevel: "info",
      redactLogs: true,
      logger: (line) => logs.push(line),
    });

    await client.whatsappSendText({
      sendTo: "919876543210",
      message: "private content",
    });

    const joined = logs.join("\n");
    expect(joined).toContain("***REDACTED***");
    expect(joined).not.toContain("wa-pass-secret");
    expect(joined).not.toContain("919876543210");
    expect(joined).toContain("[REDACTED_MESSAGE len=");
  });

  it("rejects overriding reserved params", async () => {
    const client = new GupshupEnterpriseClient({
      smsEndpoint: "https://sms.example/rest",
      whatsappEndpoint: "https://wa.example/rest",
      whatsappUserId: "wa-user",
      whatsappPassword: "wa-pass",
      fetchFn: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      client.gatewayRequest({
        endpoint: "whatsapp",
        httpMethod: "POST",
        params: { userid: "override", method: "SENDMESSAGE" },
      })
    ).rejects.toThrow('Param "userid" is reserved and cannot be overridden.');
  });

  it("throws clear error when endpoint credentials are missing", async () => {
    const client = new GupshupEnterpriseClient({
      smsEndpoint: "https://sms.example/rest",
      whatsappEndpoint: "https://wa.example/rest",
      fetchFn: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      client.gatewayRequest({
        endpoint: "sms",
        httpMethod: "POST",
        params: { method: "sendMessage" },
      })
    ).rejects.toThrow("Missing SMS credentials");
  });
});
