import { TokenManager } from "../auth/token-manager.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import { translateError } from "../utils/errors.js";

interface ClientConfig {
  tokenManager: TokenManager;
  baseUrl: string;
  defaultAppId?: string;
  fetchFn?: typeof fetch;
}

export class GupshupClient {
  public tokenManager: TokenManager;
  private rateLimiter = new RateLimiter();
  private baseUrl: string;
  private defaultAppId?: string;
  private fetchFn: typeof fetch;

  constructor(config: ClientConfig) {
    this.tokenManager = config.tokenManager;
    this.baseUrl = config.baseUrl;
    this.defaultAppId = config.defaultAppId;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  resolveAppId(appId: string | undefined): string {
    const resolved = appId ?? this.defaultAppId;
    if (!resolved) {
      throw new Error(
        "appId is required. Either set GUPSHUP_DEFAULT_APP_ID or pass appId in the tool call."
      );
    }
    return resolved;
  }

  toFormBody(data: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;
      const strValue =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(strValue)}`);
    }
    return parts.join("&");
  }

  async appRequest(
    method: string,
    path: string,
    appId: string | undefined,
    body?: Record<string, unknown>,
    authStyle: "token" | "authorization" = "token"
  ): Promise<unknown> {
    const resolvedAppId = this.resolveAppId(appId);
    const token = await this.tokenManager.getAppToken(resolvedAppId);
    const url = `${this.baseUrl}${path.replace("{appId}", resolvedAppId)}`;

    await this.rateLimiter.acquire(path);

    const headers: Record<string, string> = {
      accept: "application/json",
      ...(authStyle === "authorization"
        ? { Authorization: token }
        : { token }),
    };

    const options: RequestInit = { method, headers };

    if (body && (method === "POST" || method === "PUT")) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      options.body = this.toFormBody(body);
    }

    const response = await this.fetchFn(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(translateError(response.status, errorBody));
    }

    return response.json();
  }

  async partnerRequest(
    method: string,
    path: string
  ): Promise<unknown> {
    const token = this.tokenManager.getPartnerToken();
    const url = `${this.baseUrl}${path}`;

    await this.rateLimiter.acquire(path);

    const response = await this.fetchFn(url, {
      method,
      headers: { Authorization: token, accept: "application/json" },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(translateError(response.status, errorBody));
    }

    return response.json();
  }
}
