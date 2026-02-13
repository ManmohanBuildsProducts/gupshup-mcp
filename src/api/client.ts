interface EnterpriseClientConfig {
  smsEndpoint: string;
  whatsappEndpoint: string;
  smsUserId?: string;
  smsPassword?: string;
  whatsappUserId?: string;
  whatsappPassword?: string;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  randomFn?: () => number;
  logger?: (line: string) => void;
  logLevel?: "off" | "info" | "debug";
  redactLogs?: boolean;
  maxRetries?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  retryJitterMs?: number;
}

export interface GatewayResponse {
  raw: string;
  status: "success" | "error" | "unknown";
  code?: string;
  message?: string;
}

export class GupshupEnterpriseClient {
  private smsEndpoint: string;
  private whatsappEndpoint: string;
  private smsUserId?: string;
  private smsPassword?: string;
  private whatsappUserId?: string;
  private whatsappPassword?: string;
  private fetchFn: typeof fetch;
  private sleepFn: (ms: number) => Promise<void>;
  private randomFn: () => number;
  private logger: (line: string) => void;
  private logLevel: "off" | "info" | "debug";
  private redactLogs: boolean;
  private maxRetries: number;
  private retryBaseMs: number;
  private retryMaxMs: number;
  private retryJitterMs: number;

  constructor(config: EnterpriseClientConfig) {
    this.smsEndpoint = config.smsEndpoint;
    this.whatsappEndpoint = config.whatsappEndpoint;
    this.smsUserId = config.smsUserId;
    this.smsPassword = config.smsPassword;
    this.whatsappUserId = config.whatsappUserId;
    this.whatsappPassword = config.whatsappPassword;
    this.fetchFn = config.fetchFn ?? fetch;
    this.sleepFn = config.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.randomFn = config.randomFn ?? Math.random;
    this.logger = config.logger ?? ((line) => console.error(line));
    this.logLevel = config.logLevel ?? "off";
    this.redactLogs = config.redactLogs ?? true;
    this.maxRetries = this.clamp(config.maxRetries ?? 3, 0, 10);
    this.retryBaseMs = this.clamp(config.retryBaseMs ?? 300, 50, 10_000);
    this.retryMaxMs = this.clamp(config.retryMaxMs ?? 5_000, 100, 60_000);
    this.retryJitterMs = this.clamp(config.retryJitterMs ?? 150, 0, 10_000);
  }

  hasSmsCredentials(): boolean {
    return Boolean(this.smsUserId && this.smsPassword);
  }

  hasWhatsappCredentials(): boolean {
    return Boolean(this.whatsappUserId && this.whatsappPassword);
  }

  async checkCredentials(): Promise<{ smsConfigured: boolean; whatsappConfigured: boolean }> {
    return {
      smsConfigured: this.hasSmsCredentials(),
      whatsappConfigured: this.hasWhatsappCredentials(),
    };
  }

  async whatsappOptIn(phoneNumber: string): Promise<GatewayResponse | Record<string, unknown>> {
    const params = {
      method: "OPT_IN",
      phone_number: phoneNumber,
      v: "1.1",
      format: "json",
      auth_scheme: "plain",
      channel: "WHATSAPP",
    };

    return this.gatewayRequest({ endpoint: "whatsapp", httpMethod: "GET", params });
  }

  async whatsappSendTemplate(input: {
    sendTo: string;
    templateId: string;
    variables?: Record<string, string>;
    msgType?: string;
    format?: string;
    dataEncoding?: string;
  }): Promise<GatewayResponse | Record<string, unknown>> {
    const params: Record<string, string | boolean> = {
      method: "SENDMESSAGE",
      send_to: input.sendTo,
      v: "1.1",
      format: input.format ?? "Text",
      msg_type: input.msgType ?? "TEXT",
      isTemplate: true,
      isHSM: true,
      auth_scheme: "plain",
      data_encoding: input.dataEncoding ?? "TEXT",
      template_id: input.templateId,
    };

    if (input.variables) {
      for (const [key, value] of Object.entries(input.variables)) {
        params[key] = value;
      }
    }

    return this.gatewayRequest({ endpoint: "whatsapp", httpMethod: "POST", params });
  }

  async whatsappSendText(input: {
    sendTo: string;
    message: string;
    msgType?: string;
    format?: string;
  }): Promise<GatewayResponse | Record<string, unknown>> {
    const params = {
      method: "SENDMESSAGE",
      send_to: input.sendTo,
      v: "1.1",
      format: input.format ?? "text",
      msg_type: input.msgType ?? "TEXT",
      auth_scheme: "plain",
      message: input.message,
    };

    return this.gatewayRequest({ endpoint: "whatsapp", httpMethod: "POST", params });
  }

  async smsSendText(input: {
    sendTo: string;
    message: string;
    principalEntityId?: string;
    dltTemplateId?: string;
    msgType?: string;
    format?: string;
  }): Promise<GatewayResponse | Record<string, unknown>> {
    const params: Record<string, string> = {
      method: "sendMessage",
      send_to: input.sendTo,
      msg: input.message,
      auth_scheme: "PLAIN",
      format: input.format ?? "JSON",
      msg_type: input.msgType ?? "TEXT",
      v: "1.1",
    };

    if (input.principalEntityId) params.principalEntityId = input.principalEntityId;
    if (input.dltTemplateId) params.dltTemplateId = input.dltTemplateId;

    return this.gatewayRequest({ endpoint: "sms", httpMethod: "POST", params });
  }

  async gatewayRequest(input: {
    endpoint: "sms" | "whatsapp";
    httpMethod: "GET" | "POST";
    params: Record<string, string | number | boolean>;
  }): Promise<GatewayResponse | Record<string, unknown>> {
    this.validateNoReservedKeys(input.params);

    const withAuth = {
      ...this.getCredentials(input.endpoint),
      ...input.params,
    };

    const endpointUrl = input.endpoint === "sms" ? this.smsEndpoint : this.whatsappEndpoint;
    const query = this.toQuery(withAuth);
    const url = input.httpMethod === "GET" ? `${endpointUrl}?${query}` : endpointUrl;

    this.log("info", "gateway.request.start", {
      endpoint: input.endpoint,
      httpMethod: input.httpMethod,
      url: endpointUrl,
      params: withAuth,
      maxRetries: this.maxRetries,
    });

    const bodyText = await this.fetchWithRetry(
      {
        url,
        options: {
          method: input.httpMethod,
          headers:
            input.httpMethod === "POST"
              ? { "content-type": "application/x-www-form-urlencoded" }
              : undefined,
          body: input.httpMethod === "POST" ? query : undefined,
        },
      },
      {
        endpoint: input.endpoint,
        httpMethod: input.httpMethod,
        endpointUrl,
        params: withAuth,
      }
    );

    const maybeJson = this.tryParseJson(bodyText);
    const output = maybeJson ?? this.parseGatewayText(bodyText);

    this.log("debug", "gateway.request.success", { endpoint: input.endpoint, output });
    return output;
  }

  private async fetchWithRetry(
    request: { url: string; options: RequestInit },
    context: {
      endpoint: "sms" | "whatsapp";
      httpMethod: "GET" | "POST";
      endpointUrl: string;
      params: Record<string, string | number | boolean>;
    }
  ): Promise<string> {
    let attempt = 0;

    while (true) {
      const tryNumber = attempt + 1;

      try {
        this.log("debug", "gateway.request.attempt", {
          tryNumber,
          endpoint: context.endpoint,
          httpMethod: context.httpMethod,
        });

        const response = await this.fetchFn(request.url, request.options);
        const bodyText = await response.text();

        if (!response.ok) {
          const canRetry = this.shouldRetryStatus(response.status) && attempt < this.maxRetries;
          this.log("info", "gateway.request.http_error", {
            tryNumber,
            status: response.status,
            willRetry: canRetry,
            body: bodyText,
          });

          if (canRetry) {
            const delayMs = this.getDelayMs(attempt);
            this.log("debug", "gateway.request.backoff", { tryNumber, delayMs });
            await this.sleepFn(delayMs);
            attempt += 1;
            continue;
          }

          throw new Error(`Enterprise gateway HTTP ${response.status}: ${bodyText}`);
        }

        return bodyText;
      } catch (error) {
        const canRetry = this.isRetryableNetworkError(error) && attempt < this.maxRetries;

        this.log("info", "gateway.request.network_error", {
          tryNumber,
          willRetry: canRetry,
          error: error instanceof Error ? error.message : String(error),
        });

        if (canRetry) {
          const delayMs = this.getDelayMs(attempt);
          this.log("debug", "gateway.request.backoff", { tryNumber, delayMs });
          await this.sleepFn(delayMs);
          attempt += 1;
          continue;
        }

        throw error;
      }
    }
  }

  private getCredentials(endpoint: "sms" | "whatsapp"): { userid: string; password: string } {
    if (endpoint === "sms") {
      if (!this.smsUserId || !this.smsPassword) {
        throw new Error("Missing SMS credentials. Set GUPSHUP_USER_ID and GUPSHUP_PASSWORD.");
      }
      return { userid: this.smsUserId, password: this.smsPassword };
    }

    if (!this.whatsappUserId || !this.whatsappPassword) {
      throw new Error("Missing WhatsApp credentials. Set GUPSHUP_WHATSAPP_USER_ID and GUPSHUP_WHATSAPP_PASSWORD.");
    }
    return { userid: this.whatsappUserId, password: this.whatsappPassword };
  }

  private toQuery(params: Record<string, string | number | boolean>): string {
    const encoded = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      encoded.append(key, String(value));
    }
    return encoded.toString();
  }

  private tryParseJson(body: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseGatewayText(body: string): GatewayResponse {
    const parts = body.split("|").map((p) => p.trim());
    const head = (parts[0] ?? "").toLowerCase();

    return {
      raw: body,
      status: head.includes("success") ? "success" : head.includes("error") ? "error" : "unknown",
      code: parts.length > 1 ? parts[1] : undefined,
      message: parts.length > 2 ? parts.slice(2).join(" | ") : body,
    };
  }

  private validateNoReservedKeys(params: Record<string, string | number | boolean>): void {
    const reserved = new Set(["userid", "password"]);
    for (const key of Object.keys(params)) {
      if (reserved.has(key)) {
        throw new Error(`Param "${key}" is reserved and cannot be overridden.`);
      }
    }
  }

  private shouldRetryStatus(status: number): boolean {
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }

  private isRetryableNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return msg.includes("timeout") || msg.includes("network") || msg.includes("fetch") || msg.includes("econnreset");
  }

  private getDelayMs(attempt: number): number {
    const exp = this.retryBaseMs * Math.pow(2, attempt);
    const jitter = Math.floor(this.randomFn() * (this.retryJitterMs + 1));
    return Math.min(this.retryMaxMs, exp + jitter);
  }

  private log(level: "info" | "debug", event: string, meta: Record<string, unknown>): void {
    if (this.logLevel === "off") return;
    if (this.logLevel === "info" && level === "debug") return;

    const out = this.redactLogs ? this.redactMeta(meta) : meta;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      ...out,
    });
    this.logger(line);
  }

  private redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(meta)) {
      out[key] = this.redactValue(key, value);
    }

    return out;
  }

  private redactValue(key: string, value: unknown): unknown {
    const keyLc = key.toLowerCase();

    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
      if (keyLc.includes("password") || keyLc.includes("token") || keyLc.includes("secret")) {
        return "***REDACTED***";
      }
      if (keyLc.includes("phone") || keyLc === "send_to") {
        return this.maskPhone(value);
      }
      if (keyLc === "msg" || keyLc === "message") {
        return `[REDACTED_MESSAGE len=${value.length}]`;
      }
      if (keyLc === "userid") {
        return this.maskUserId(value);
      }
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") return value;

    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(key, item));
    }

    if (typeof value === "object") {
      const nested: Record<string, unknown> = {};
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        nested[nestedKey] = this.redactValue(nestedKey, nestedValue);
      }
      return nested;
    }

    return value;
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return "***";
    return `${digits.slice(0, 5)}****${digits.slice(-3)}`;
  }

  private maskUserId(userId: string): string {
    if (userId.length <= 4) return "***";
    return `${userId.slice(0, 2)}****${userId.slice(-2)}`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.floor(value)));
  }
}
