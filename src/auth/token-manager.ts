interface TokenManagerConfig {
  partnerToken: string;
  baseUrl: string;
  fetchFn?: typeof fetch;
}

export class TokenManager {
  private partnerToken: string;
  private baseUrl: string;
  private appTokenCache = new Map<string, string>();
  private fetchFn: typeof fetch;

  constructor(config: TokenManagerConfig) {
    if (!config.partnerToken) {
      throw new Error(
        "GUPSHUP_PARTNER_TOKEN is required. Set it as an environment variable."
      );
    }
    this.partnerToken = config.partnerToken;
    this.baseUrl = config.baseUrl;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  getPartnerToken(): string {
    return this.partnerToken;
  }

  async getAppToken(appId: string): Promise<string> {
    const cached = this.appTokenCache.get(appId);
    if (cached) return cached;

    const url = `${this.baseUrl}/partner/app/${appId}/token`;
    const response = await this.fetchFn(url, {
      method: "GET",
      headers: { Authorization: this.partnerToken },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to get app token for ${appId}: ${response.status} ${body}`
      );
    }

    const data = await response.json();
    const token = (data as any).token.token as string;
    this.appTokenCache.set(appId, token);
    return token;
  }

  clearCache(appId?: string): void {
    if (appId) {
      this.appTokenCache.delete(appId);
    } else {
      this.appTokenCache.clear();
    }
  }
}
