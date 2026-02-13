# Gupshup WhatsApp MCP Server — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an open-source MCP server that connects AI assistants to Gupshup's WhatsApp Partner API — template CRUD, messaging, and analytics.

**Architecture:** TypeScript MCP server using `@modelcontextprotocol/sdk` with stdio transport. Two-token auth (partner JWT → cached app tokens). 13 tools across 4 categories. Per-endpoint rate limiting. Human-friendly error translation.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, Zod (input schemas), vitest (testing), node built-in `fetch` (HTTP).

**Spec:** `SPEC.md` in project root — the source of truth for all API contracts.

---

## Dependency Graph

```
Task 1 (scaffold)
  └─► Task 2 (types)
        ├─► Task 3 (errors)     ─┐
        ├─► Task 4 (rate limiter)─┤─► Task 6 (API client)
        └─► Task 5 (token mgr)  ─┘        │
                                           ├─► Task 7  (create + list templates)  ─┐
                                           ├─► Task 8  (edit + delete + upload)    │
                                           ├─► Task 9  (send_template_message)     │
                                           ├─► Task 10 (analytics tools)           ├─► Task 12 (MCP server entry)
                                           └─► Task 11 (utility tools)             │        │
                                                                                   ┘        ▼
                                                                              Task 13 (README + packaging)
```

**Parallel groups:**
- Tasks 3, 4, 5 can run in parallel (all depend only on Task 2)
- Tasks 7, 8, 9, 10, 11 can run in parallel (all depend only on Task 6)

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/index.ts` (placeholder)

**Step 1: Initialize git repo**

```bash
cd /Users/mac/gupshup-mcp
git init
```

**Step 2: Create package.json**

```json
{
  "name": "gupshup-mcp",
  "version": "0.1.0",
  "description": "MCP server for Gupshup WhatsApp Business API — template management, messaging, and analytics",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "gupshup-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["mcp", "gupshup", "whatsapp", "template", "ai"],
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 3: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk zod
npm install -D typescript vitest @types/node
```

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.tgz
```

**Step 6: Create .env.example**

```bash
# Required: Partner JWT token from Gupshup dashboard
GUPSHUP_PARTNER_TOKEN=your-partner-jwt-token

# Optional: Default app ID (if not set, appId is required per tool call)
GUPSHUP_DEFAULT_APP_ID=your-app-id

# Optional: API base URL (default: https://partner.gupshup.io)
GUPSHUP_BASE_URL=https://partner.gupshup.io
```

**Step 7: Create placeholder entry point**

```typescript
// src/index.ts
#!/usr/bin/env node
console.log("gupshup-mcp server starting...");
```

**Step 8: Verify build works**

```bash
npx tsc
node dist/index.js
```

Expected: prints "gupshup-mcp server starting..."

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with deps and config"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/templates.ts`
- Create: `src/types/messaging.ts`
- Create: `src/types/analytics.ts`
- Create: `src/types/common.ts`

**Step 1: Create common types**

```typescript
// src/types/common.ts
export interface GupshupResponse<T = unknown> {
  status: "success" | "error";
  message?: string;
  data?: T;
}

export interface AppToken {
  token: string;
  authoriserId: string;
  requestorId: string;
  createdOn: number;
  modifiedOn: number;
  expiresOn: number;
  active: boolean;
}

export interface AppInfo {
  appId: string;
  name: string;
  phone: string;
  status: string;
}

export interface HealthResult {
  health: Record<string, unknown>;
  ratings: {
    qualityRating: string;
    messagingLimit: string;
    phoneQuality: string;
  };
  wallet: {
    balance: number;
    currency: string;
  };
}
```

**Step 2: Create template types**

```typescript
// src/types/templates.ts
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export type TemplateType =
  | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"
  | "LOCATION" | "CAROUSEL" | "PRODUCT" | "CATALOG" | "LTO";

export type TemplateStatus = "APPROVED" | "REJECTED" | "PENDING";

export interface TemplateButton {
  type: string;
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface Template {
  id: string;
  appId: string;
  elementName: string;
  category: TemplateCategory;
  status: TemplateStatus;
  templateType: TemplateType;
  languageCode: string;
  quality: string;
  reason: string | null;
  createdOn: number;
  modifiedOn: number;
  namespace: string;
  wabaId: string;
  data?: string;
  containerMeta?: string;
  meta?: string;
}

export interface CreateTemplateParams {
  appId?: string;
  elementName: string;
  languageCode: string;
  category: TemplateCategory;
  templateType: TemplateType;
  content: string;
  header?: string;
  footer?: string;
  buttons?: TemplateButton[];
  example?: string;
  exampleMedia?: string;
  vertical?: string;
  allowTemplateCategoryChange?: boolean;
  enableSample?: boolean;
}

export interface EditTemplateParams {
  appId?: string;
  templateId: string;
  content?: string;
  header?: string;
  footer?: string;
  buttons?: TemplateButton[];
  category?: TemplateCategory;
  templateType?: TemplateType;
  example?: string;
  exampleMedia?: string;
  enableSample?: boolean;
}

export interface DeleteTemplateParams {
  appId?: string;
  elementName: string;
  templateId?: string;
}

export interface UploadMediaParams {
  appId?: string;
  file: string;
  fileType: string;
}
```

**Step 3: Create messaging types**

```typescript
// src/types/messaging.ts
export interface TemplateRef {
  id: string;
  params: string[];
}

export interface TextMessage {
  type: "text";
  text: string;
}

export interface ImageMessage {
  type: "image";
  image: { link: string };
}

export interface VideoMessage {
  type: "video";
  video: { link: string };
}

export interface DocumentMessage {
  type: "document";
  document: { link: string; filename?: string };
}

export type TemplateMessage = TextMessage | ImageMessage | VideoMessage | DocumentMessage;

export interface SendTemplateParams {
  appId?: string;
  source: string;
  destination: string;
  srcName: string;
  template: TemplateRef;
  message: TemplateMessage;
}

export interface SendMessageResult {
  status: string;
  messageId: string;
}
```

**Step 4: Create analytics types**

```typescript
// src/types/analytics.ts
export type Granularity = "DAILY" | "AGGREGATE";
export type MetricType = "SENT" | "DELIVERED" | "READ" | "CLICKED";

export interface EnableAnalyticsParams {
  appId?: string;
  enable: boolean;
}

export interface GetAnalyticsParams {
  appId?: string;
  start: number;
  end: number;
  templateIds: string[];
  granularity?: Granularity;
  metricTypes?: MetricType[];
}

export interface TemplateAnalytics {
  template_id: string;
  sent: number;
  delivered: number;
  read: number;
  start: number;
  end: number;
}

export interface CompareTemplatesParams {
  appId?: string;
  templateId: string;
  templateList: string[];
  start: number;
  end: number;
}

export interface UsageSummaryParams {
  appId?: string;
  from: string;
  to: string;
}
```

**Step 5: Create barrel export**

```typescript
// src/types/index.ts
export * from "./common.js";
export * from "./templates.js";
export * from "./messaging.js";
export * from "./analytics.js";
```

**Step 6: Verify build**

```bash
npx tsc
```

Expected: compiles with no errors.

**Step 7: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript types for all API contracts"
```

---

## Task 3: Error Translation Map

> **Parallel:** Can run alongside Tasks 4 and 5.

**Files:**
- Create: `src/utils/errors.ts`
- Create: `src/utils/errors.test.ts`

**Step 1: Write failing test**

```typescript
// src/utils/errors.test.ts
import { describe, it, expect } from "vitest";
import { translateError } from "./errors.js";

describe("translateError", () => {
  it("translates 401 Unauthorized", () => {
    const result = translateError(401, "Unauthorized");
    expect(result).toContain("GUPSHUP_PARTNER_TOKEN");
  });

  it("translates 429 rate limit", () => {
    const result = translateError(429, "Too Many Requests");
    expect(result).toContain("Rate limited");
  });

  it("translates invalid app id", () => {
    const result = translateError(400, "Invalid app id provided");
    expect(result).toContain("list_apps");
  });

  it("translates enableSample required", () => {
    const result = translateError(400, "enableSample is required");
    expect(result).toContain("example");
  });

  it("translates analytics not enabled", () => {
    const result = translateError(400, "Template analytics not enabled");
    expect(result).toContain("enable_template_analytics");
  });

  it("returns original message for unknown errors", () => {
    const result = translateError(500, "Something weird happened");
    expect(result).toContain("Something weird happened");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/utils/errors.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement error translation**

```typescript
// src/utils/errors.ts
const ERROR_MAP: Array<{ match: RegExp | number; message: string }> = [
  {
    match: 401,
    message: "Token expired or invalid. Check your GUPSHUP_PARTNER_TOKEN env var.",
  },
  {
    match: 429,
    message: "Rate limited on this endpoint. Will retry automatically.",
  },
  {
    match: /Invalid app id/i,
    message: "App ID not found. Run `list_apps` to see valid app IDs.",
  },
  {
    match: /Template not found/i,
    message: "Template not found. Run `list_templates` to see available templates.",
  },
  {
    match: /enableSample is required/i,
    message:
      "Sample text is mandatory for template approval. Provide the `example` parameter with variables filled in.",
  },
  {
    match: /Template analytics not enabled/i,
    message:
      "Template analytics not enabled. Run `enable_template_analytics` first before querying analytics.",
  },
];

export function translateError(statusCode: number, body: string): string {
  for (const entry of ERROR_MAP) {
    if (typeof entry.match === "number" && entry.match === statusCode) {
      return entry.message;
    }
    if (entry.match instanceof RegExp && entry.match.test(body)) {
      return entry.message;
    }
  }
  return `Gupshup API error (${statusCode}): ${body}`;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/utils/errors.test.ts
```

Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add src/utils/errors.ts src/utils/errors.test.ts
git commit -m "feat: add human-friendly error translation for Gupshup API errors"
```

---

## Task 4: Rate Limiter

> **Parallel:** Can run alongside Tasks 3 and 5.

**Files:**
- Create: `src/utils/rate-limiter.ts`
- Create: `src/utils/rate-limiter.test.ts`

**Step 1: Write failing test**

```typescript
// src/utils/rate-limiter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimiter } from "./rate-limiter.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows requests under the limit", async () => {
    const allowed = await limiter.acquire("/templates");
    expect(allowed).toBe(true);
  });

  it("returns correct limit config for known endpoints", () => {
    const config = limiter.getLimitConfig("/templates");
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(60_000);
  });

  it("returns default config for unknown endpoints", () => {
    const config = limiter.getLimitConfig("/some/random/path");
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(1_000);
  });

  it("returns specific config for analytics endpoint", () => {
    const config = limiter.getLimitConfig("/template/analytics");
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(60_000);
  });

  it("returns specific config for subscription endpoint", () => {
    const config = limiter.getLimitConfig("/subscription");
    expect(config.maxRequests).toBe(5);
    expect(config.windowMs).toBe(60_000);
  });

  it("returns specific config for media endpoint", () => {
    const config = limiter.getLimitConfig("/media/");
    expect(config.maxRequests).toBe(10);
    expect(config.windowMs).toBe(1_000);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/utils/rate-limiter.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement rate limiter**

```typescript
// src/utils/rate-limiter.ts
interface LimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

const ENDPOINT_LIMITS: Array<{ match: RegExp; config: LimitConfig }> = [
  { match: /\/templates$/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/token$/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/health$/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/capping$/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/template\/analytics/, config: { maxRequests: 10, windowMs: 60_000 } },
  { match: /\/subscription/, config: { maxRequests: 5, windowMs: 60_000 } },
  { match: /\/media\//, config: { maxRequests: 10, windowMs: 1_000 } },
  { match: /\/account\/login/, config: { maxRequests: 10, windowMs: 60_000 } },
];

const DEFAULT_LIMIT: LimitConfig = { maxRequests: 10, windowMs: 1_000 };

export class RateLimiter {
  private buckets = new Map<string, BucketState>();

  getLimitConfig(endpoint: string): LimitConfig {
    for (const { match, config } of ENDPOINT_LIMITS) {
      if (match.test(endpoint)) return config;
    }
    return DEFAULT_LIMIT;
  }

  async acquire(endpoint: string): Promise<boolean> {
    const config = this.getLimitConfig(endpoint);
    const key = endpoint;
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: config.maxRequests, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed >= config.windowMs) {
      bucket.tokens = config.maxRequests;
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    const waitMs = config.windowMs - elapsed;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    bucket.tokens = config.maxRequests - 1;
    bucket.lastRefill = Date.now();
    return true;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/utils/rate-limiter.test.ts
```

Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add src/utils/rate-limiter.ts src/utils/rate-limiter.test.ts
git commit -m "feat: add per-endpoint rate limiter with token bucket"
```

---

## Task 5: Token Manager

> **Parallel:** Can run alongside Tasks 3 and 4.

**Files:**
- Create: `src/auth/token-manager.ts`
- Create: `src/auth/token-manager.test.ts`

**Step 1: Write failing test**

```typescript
// src/auth/token-manager.test.ts
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
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/auth/token-manager.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement token manager**

```typescript
// src/auth/token-manager.ts
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
    const token = data.token.token as string;
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
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/auth/token-manager.test.ts
```

Expected: all 5 tests PASS.

**Step 5: Commit**

```bash
git add src/auth/token-manager.ts src/auth/token-manager.test.ts
git commit -m "feat: add two-token auth with partner JWT → app token caching"
```

---

## Task 6: API Client

> **Depends on:** Tasks 3, 4, 5.

**Files:**
- Create: `src/api/client.ts`
- Create: `src/api/client.test.ts`

**Step 1: Write failing test**

```typescript
// src/api/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GupshupClient } from "./client.js";
import { TokenManager } from "../auth/token-manager.js";

describe("GupshupClient", () => {
  const mockFetch = vi.fn();
  let client: GupshupClient;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock token manager that returns a known token
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
    // JSON objects get stringified
    expect(result).toContain(encodeURIComponent('{"id":"abc","params":["x"]}'));
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/api/client.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement API client**

```typescript
// src/api/client.ts
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
  private tokenManager: TokenManager;
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
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const resolvedAppId = this.resolveAppId(appId);
    const token = await this.tokenManager.getAppToken(resolvedAppId);
    const url = `${this.baseUrl}${path.replace("{appId}", resolvedAppId)}`;

    await this.rateLimiter.acquire(path);

    const headers: Record<string, string> = {
      token,
      accept: "application/json",
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
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/api/client.test.ts
```

Expected: all 4 tests PASS.

**Step 5: Commit**

```bash
git add src/api/client.ts src/api/client.test.ts
git commit -m "feat: add API client with form-urlencoded, auth, rate limiting, error translation"
```

---

## Task 7: Template Tools — create + list

> **Parallel:** Can run alongside Tasks 8, 9, 10, 11.

**Files:**
- Create: `src/tools/templates.ts`
- Create: `src/tools/templates.test.ts`

**Step 1: Write failing test for list_templates**

```typescript
// src/tools/templates.test.ts
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
        { id: "t1", elementName: "order_update", status: "APPROVED" },
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
    const result = await handler({
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
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/tools/templates.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement create + list handlers**

```typescript
// src/tools/templates.ts
import { GupshupClient } from "../api/client.js";
import type { CreateTemplateParams, EditTemplateParams, DeleteTemplateParams } from "../types/index.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeListTemplates(client: GupshupClient) {
  return async (params: { appId?: string }): Promise<ToolResult> => {
    const data = (await client.appRequest(
      "GET",
      "/partner/app/{appId}/templates",
      params.appId
    )) as any;

    const templates = data.templates ?? [];
    const summary = templates.map((t: any) => ({
      id: t.id,
      name: t.elementName,
      type: t.templateType,
      category: t.category,
      status: t.status,
      language: t.languageCode,
      quality: t.quality,
      reason: t.reason,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  };
}

export function makeCreateTemplate(client: GupshupClient) {
  return async (params: CreateTemplateParams): Promise<ToolResult> => {
    const body: Record<string, unknown> = {
      elementName: params.elementName,
      languageCode: params.languageCode,
      category: params.category,
      templateType: params.templateType,
      content: params.content,
      enableSample: true,
    };

    if (params.header) body.header = params.header;
    if (params.footer) body.footer = params.footer;
    if (params.buttons) body.buttons = params.buttons;
    if (params.example) body.example = params.example;
    if (params.exampleMedia) body.exampleMedia = params.exampleMedia;
    if (params.vertical) body.vertical = params.vertical;
    if (params.allowTemplateCategoryChange !== undefined) {
      body.allowTemplateCategoryChange = params.allowTemplateCategoryChange;
    }

    const data = await client.appRequest(
      "POST",
      "/partner/app/{appId}/templates",
      params.appId,
      body
    );

    return {
      content: [
        {
          type: "text",
          text: `Template "${params.elementName}" submitted for approval.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    };
  };
}

export function makeEditTemplate(client: GupshupClient) {
  return async (params: EditTemplateParams): Promise<ToolResult> => {
    const body: Record<string, unknown> = { enableSample: true };
    if (params.content) body.content = params.content;
    if (params.header) body.header = params.header;
    if (params.footer) body.footer = params.footer;
    if (params.buttons) body.buttons = params.buttons;
    if (params.category) body.category = params.category;
    if (params.templateType) body.templateType = params.templateType;
    if (params.example) body.example = params.example;
    if (params.exampleMedia) body.exampleMedia = params.exampleMedia;

    const data = await client.appRequest(
      "PUT",
      `/partner/app/{appId}/templates/${params.templateId}`,
      params.appId,
      body
    );

    return {
      content: [
        {
          type: "text",
          text: `Template "${params.templateId}" updated and resubmitted for approval.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    };
  };
}

export function makeDeleteTemplate(client: GupshupClient) {
  return async (params: DeleteTemplateParams): Promise<ToolResult> => {
    const path = params.templateId
      ? `/partner/app/{appId}/template/${params.elementName}/${params.templateId}`
      : `/partner/app/{appId}/template/${params.elementName}`;

    const data = await client.appRequest("DELETE", path, params.appId);

    return {
      content: [
        {
          type: "text",
          text: `Template "${params.elementName}" permanently deleted.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    };
  };
}

export function makeUploadMedia(client: GupshupClient) {
  return async (params: { appId?: string; file: string; fileType: string }): Promise<ToolResult> => {
    const data = await client.appRequest(
      "POST",
      "/partner/app/{appId}/upload/media",
      params.appId,
      { file: params.file, fileType: params.fileType }
    );

    return {
      content: [
        {
          type: "text",
          text: `Media uploaded.\n${JSON.stringify(data, null, 2)}\nUse the handleId in create_template's exampleMedia parameter.`,
        },
      ],
    };
  };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/tools/templates.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/tools/templates.ts src/tools/templates.test.ts
git commit -m "feat: add template CRUD tool handlers (create, list, edit, delete, upload)"
```

---

## Task 8: Messaging Tool — send_template_message

> **Parallel:** Can run alongside Tasks 7, 9, 10, 11.

**Files:**
- Create: `src/tools/messaging.ts`
- Create: `src/tools/messaging.test.ts`

**Step 1: Write failing test**

```typescript
// src/tools/messaging.test.ts
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
      message: { type: "text", text: "Hi Rahul, order ORD-123 shipped!" },
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
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/tools/messaging.test.ts
```

**Step 3: Implement messaging handler**

```typescript
// src/tools/messaging.ts
import { GupshupClient } from "../api/client.js";
import type { SendTemplateParams } from "../types/index.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeSendTemplateMessage(client: GupshupClient) {
  return async (params: SendTemplateParams): Promise<ToolResult> => {
    const data = (await client.appRequest(
      "POST",
      "/partner/app/{appId}/template/msg",
      params.appId,
      {
        source: params.source,
        destination: params.destination,
        "src.name": params.srcName,
        template: params.template,
        message: params.message,
      }
    )) as any;

    return {
      content: [
        {
          type: "text",
          text: `Message sent to ${params.destination}.\nStatus: ${data.status}\nMessage ID: ${data.messageId}`,
        },
      ],
    };
  };
}
```

**Step 4: Run test**

```bash
npx vitest run src/tools/messaging.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/tools/messaging.ts src/tools/messaging.test.ts
git commit -m "feat: add send_template_message with V2 payload (source, destination, src.name)"
```

---

## Task 9: Analytics Tools

> **Parallel:** Can run alongside Tasks 7, 8, 10, 11.

**Files:**
- Create: `src/tools/analytics.ts`
- Create: `src/tools/analytics.test.ts`

**Step 1: Write failing tests**

```typescript
// src/tools/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  makeEnableAnalytics,
  makeGetAnalytics,
  makeCompareTemplates,
  makeGetAppHealth,
} from "./analytics.js";

describe("enable_template_analytics", () => {
  const mockClient = { appRequest: vi.fn() };

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
  const mockClient = { appRequest: vi.fn() };

  it("passes all query params correctly", async () => {
    mockClient.appRequest.mockResolvedValueOnce({
      status: "success",
      template_analytics: [{ template_id: "t1", sent: 100, delivered: 95, read: 80 }],
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

  it("calls compare endpoint with templateList", async () => {
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

  it("combines three API calls into one result", async () => {
    mockClient.appRequest
      .mockResolvedValueOnce({ status: "ok" })         // health
      .mockResolvedValueOnce({ qualityRating: "GREEN" }) // ratings
      .mockResolvedValueOnce({ balance: 5000 });         // wallet

    const handler = makeGetAppHealth(mockClient as any);
    const result = await handler({});

    expect(mockClient.appRequest).toHaveBeenCalledTimes(3);
    expect(result.content[0].text).toContain("GREEN");
    expect(result.content[0].text).toContain("5000");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tools/analytics.test.ts
```

**Step 3: Implement analytics handlers**

```typescript
// src/tools/analytics.ts
import { GupshupClient } from "../api/client.js";
import type {
  EnableAnalyticsParams,
  GetAnalyticsParams,
  CompareTemplatesParams,
} from "../types/index.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeEnableAnalytics(client: GupshupClient) {
  return async (params: EnableAnalyticsParams): Promise<ToolResult> => {
    const data = await client.appRequest(
      "POST",
      "/partner/app/{appId}/template/analytics",
      params.appId,
      { enable: params.enable }
    );

    return {
      content: [
        {
          type: "text",
          text: `Template analytics ${params.enable ? "enabled" : "disabled"}.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    };
  };
}

export function makeGetAnalytics(client: GupshupClient) {
  return async (params: GetAnalyticsParams): Promise<ToolResult> => {
    const appId = client.resolveAppId(params.appId);
    const query = new URLSearchParams({
      start: String(params.start),
      end: String(params.end),
      template_ids: params.templateIds.join(","),
      limit: "30",
    });

    if (params.granularity) query.set("granularity", params.granularity);
    if (params.metricTypes) query.set("metric_types", params.metricTypes.join(","));

    const data = (await client.appRequest(
      "GET",
      `/partner/app/{appId}/template/analytics?${query.toString()}`,
      params.appId
    )) as any;

    const analytics = data.template_analytics ?? [];
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(analytics, null, 2),
        },
      ],
    };
  };
}

export function makeCompareTemplates(client: GupshupClient) {
  return async (params: CompareTemplatesParams): Promise<ToolResult> => {
    const query = new URLSearchParams({
      templateList: params.templateList.join(","),
      start: String(params.start),
      end: String(params.end),
    });

    const data = await client.appRequest(
      "GET",
      `/partner/app/{appId}/template/analytics/${params.templateId}/compare?${query.toString()}`,
      params.appId
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  };
}

export function makeGetAppHealth(client: GupshupClient) {
  return async (params: { appId?: string }): Promise<ToolResult> => {
    const [health, ratings, wallet] = await Promise.all([
      client.appRequest("GET", "/partner/app/{appId}/health", params.appId),
      client.appRequest("GET", "/partner/app/{appId}/ratings", params.appId),
      client.appRequest("GET", "/partner/app/{appId}/wallet/balance", params.appId),
    ]);

    const combined = { health, ratings, wallet };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(combined, null, 2),
        },
      ],
    };
  };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/tools/analytics.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/tools/analytics.ts src/tools/analytics.test.ts
git commit -m "feat: add analytics tools (enable, get, compare, health)"
```

---

## Task 10: Utility Tools

> **Parallel:** Can run alongside Tasks 7, 8, 9, 11.

**Files:**
- Create: `src/tools/utility.ts`
- Create: `src/tools/utility.test.ts`

**Step 1: Write failing test**

```typescript
// src/tools/utility.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeListApps, makeGetUsageSummary, makeGetAppToken } from "./utility.js";

describe("list_apps", () => {
  const mockClient = { partnerRequest: vi.fn() };

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
    clearCache: vi.fn(),
  };
  const mockClient = { tokenManager: mockTokenManager };

  it("returns the fetched app token", async () => {
    const handler = makeGetAppToken(mockClient as any);
    const result = await handler({ appId: "test-app" });

    expect(result.content[0].text).toContain("sk_debug_token");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/tools/utility.test.ts
```

**Step 3: Implement utility handlers**

```typescript
// src/tools/utility.ts
import { GupshupClient } from "../api/client.js";
import type { UsageSummaryParams } from "../types/index.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeListApps(client: GupshupClient) {
  return async (_params: Record<string, never>): Promise<ToolResult> => {
    const data = (await client.partnerRequest(
      "GET",
      "/partner/account/api/partnerApps"
    )) as any;

    const apps = data.partnerApps ?? [];
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(apps, null, 2),
        },
      ],
    };
  };
}

export function makeGetUsageSummary(client: GupshupClient) {
  return async (params: UsageSummaryParams): Promise<ToolResult> => {
    const data = await client.appRequest(
      "GET",
      `/partner/app/{appId}/usage?from=${params.from}&to=${params.to}`,
      params.appId
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  };
}

export function makeGetAppToken(client: { tokenManager: { getAppToken: (id: string) => Promise<string> } }) {
  return async (params: { appId: string }): Promise<ToolResult> => {
    const token = await client.tokenManager.getAppToken(params.appId);

    return {
      content: [
        {
          type: "text",
          text: `App token for ${params.appId}: ${token}\n\nThis token is used internally for all app-scope API calls. It is cached and idempotent.`,
        },
      ],
    };
  };
}
```

**Step 4: Run tests**

```bash
npx vitest run src/tools/utility.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/tools/utility.ts src/tools/utility.test.ts
git commit -m "feat: add utility tools (list_apps, usage_summary, get_app_token)"
```

---

## Task 11: MCP Server Entry Point

> **Depends on:** All tool tasks (7-10).

**Files:**
- Modify: `src/index.ts` (replace placeholder)

**Step 1: Implement MCP server with all 13 tool registrations**

```typescript
// src/index.ts
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { TokenManager } from "./auth/token-manager.js";
import { GupshupClient } from "./api/client.js";
import {
  makeListTemplates,
  makeCreateTemplate,
  makeEditTemplate,
  makeDeleteTemplate,
  makeUploadMedia,
} from "./tools/templates.js";
import { makeSendTemplateMessage } from "./tools/messaging.js";
import {
  makeEnableAnalytics,
  makeGetAnalytics,
  makeCompareTemplates,
  makeGetAppHealth,
} from "./tools/analytics.js";
import {
  makeListApps,
  makeGetUsageSummary,
  makeGetAppToken,
} from "./tools/utility.js";

const PARTNER_TOKEN = process.env.GUPSHUP_PARTNER_TOKEN;
const DEFAULT_APP_ID = process.env.GUPSHUP_DEFAULT_APP_ID;
const BASE_URL = process.env.GUPSHUP_BASE_URL ?? "https://partner.gupshup.io";

if (!PARTNER_TOKEN) {
  console.error("Error: GUPSHUP_PARTNER_TOKEN environment variable is required.");
  process.exit(1);
}

const tokenManager = new TokenManager({ partnerToken: PARTNER_TOKEN, baseUrl: BASE_URL });
const client = new GupshupClient({ tokenManager, baseUrl: BASE_URL, defaultAppId: DEFAULT_APP_ID });

const server = new McpServer({
  name: "gupshup-mcp",
  version: "0.1.0",
});

// --- Template Management ---

server.registerTool("list_templates", {
  title: "List Templates",
  description: "Get all WhatsApp templates for an app with their approval status.",
  inputSchema: { appId: z.string().optional() },
}, makeListTemplates(client));

server.registerTool("create_template", {
  title: "Create Template",
  description: "Create a new WhatsApp message template and submit for Meta approval.",
  inputSchema: {
    appId: z.string().optional(),
    elementName: z.string().describe("Template name (lowercase, alphanumeric, underscores)"),
    languageCode: z.string().describe("e.g. en_US, hi"),
    category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
    templateType: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION", "CAROUSEL", "PRODUCT", "CATALOG", "LTO"]),
    content: z.string().describe("Body text (max 1024 chars). Variables: {{1}}, {{2}}"),
    header: z.string().optional(),
    footer: z.string().optional(),
    buttons: z.array(z.object({
      type: z.string(),
      text: z.string(),
      url: z.string().optional(),
      phoneNumber: z.string().optional(),
    })).optional(),
    example: z.string().optional().describe("Sample text with variables filled in"),
    exampleMedia: z.string().optional(),
    vertical: z.string().optional(),
    allowTemplateCategoryChange: z.boolean().optional(),
  },
}, makeCreateTemplate(client));

server.registerTool("edit_template", {
  title: "Edit Template",
  description: "Edit an existing template (resubmits for Meta approval).",
  inputSchema: {
    appId: z.string().optional(),
    templateId: z.string().describe("Template UUID"),
    content: z.string().optional(),
    header: z.string().optional(),
    footer: z.string().optional(),
    buttons: z.array(z.object({
      type: z.string(),
      text: z.string(),
      url: z.string().optional(),
      phoneNumber: z.string().optional(),
    })).optional(),
    category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
    templateType: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION", "CAROUSEL", "PRODUCT", "CATALOG", "LTO"]).optional(),
    example: z.string().optional(),
    exampleMedia: z.string().optional(),
    enableSample: z.boolean().optional(),
  },
}, makeEditTemplate(client));

server.registerTool("delete_template", {
  title: "Delete Template",
  description: "Permanently delete a template. Irreversible.",
  inputSchema: {
    appId: z.string().optional(),
    elementName: z.string().describe("Template name"),
    templateId: z.string().optional().describe("Template UUID for targeted deletion"),
  },
}, makeDeleteTemplate(client));

server.registerTool("upload_media", {
  title: "Upload Media",
  description: "Upload media for template headers/samples. Returns a handle ID.",
  inputSchema: {
    appId: z.string().optional(),
    file: z.string().describe("File path or URL"),
    fileType: z.string().describe("MIME type: image/jpeg, image/png, video/mp4, application/pdf"),
  },
}, makeUploadMedia(client));

// --- Messaging ---

server.registerTool("send_template_message", {
  title: "Send Template Message",
  description: "Send an approved template message to a WhatsApp user.",
  inputSchema: {
    appId: z.string().optional(),
    source: z.string().describe("Your WABA phone number with country code"),
    destination: z.string().describe("Recipient phone number with country code"),
    srcName: z.string().describe("App name registered with Gupshup"),
    template: z.object({
      id: z.string().describe("Approved template UUID"),
      params: z.array(z.string()).describe("Variable values in order"),
    }),
    message: z.object({
      type: z.enum(["text", "image", "video", "document"]),
      text: z.string().optional(),
      image: z.object({ link: z.string() }).optional(),
      video: z.object({ link: z.string() }).optional(),
      document: z.object({ link: z.string(), filename: z.string().optional() }).optional(),
    }),
  },
}, makeSendTemplateMessage(client));

// --- Analytics ---

server.registerTool("enable_template_analytics", {
  title: "Enable Template Analytics",
  description: "Enable or disable template analytics on Meta. Must be enabled before get_template_analytics works.",
  inputSchema: {
    appId: z.string().optional(),
    enable: z.boolean().describe("true to enable, false to disable"),
  },
}, makeEnableAnalytics(client));

server.registerTool("get_template_analytics", {
  title: "Get Template Analytics",
  description: "Get sent/delivered/read/clicked metrics per template. Max 90 days history.",
  inputSchema: {
    appId: z.string().optional(),
    start: z.number().describe("Start time as Unix timestamp (seconds)"),
    end: z.number().describe("End time as Unix timestamp (seconds)"),
    templateIds: z.array(z.string()).describe("Template UUIDs (max 30)"),
    granularity: z.enum(["DAILY", "AGGREGATE"]).optional(),
    metricTypes: z.array(z.enum(["SENT", "DELIVERED", "READ", "CLICKED"])).optional(),
  },
}, makeGetAnalytics(client));

server.registerTool("compare_templates", {
  title: "Compare Templates",
  description: "Compare performance across templates. Time range must be 7, 30, 60, or 90 days.",
  inputSchema: {
    appId: z.string().optional(),
    templateId: z.string().describe("Primary template UUID"),
    templateList: z.array(z.string()).describe("Template UUIDs to compare with"),
    start: z.number().describe("Start Unix timestamp"),
    end: z.number().describe("End Unix timestamp"),
  },
}, makeCompareTemplates(client));

server.registerTool("get_app_health", {
  title: "Get App Health",
  description: "Get app health, quality rating, messaging limits, and wallet balance.",
  inputSchema: { appId: z.string().optional() },
}, makeGetAppHealth(client));

// --- Utility ---

server.registerTool("list_apps", {
  title: "List Apps",
  description: "List all Gupshup apps/WABAs linked to your partner account.",
  inputSchema: {},
}, makeListApps(client));

server.registerTool("get_usage_summary", {
  title: "Get Usage Summary",
  description: "Get daily usage breakdown for an app over a date range.",
  inputSchema: {
    appId: z.string().optional(),
    from: z.string().describe("Start date YYYY-MM-DD"),
    to: z.string().describe("End date YYYY-MM-DD"),
  },
}, makeGetUsageSummary(client));

server.registerTool("get_app_token", {
  title: "Get App Token",
  description: "Debug tool: fetch the app-level access token. Normally handled automatically.",
  inputSchema: {
    appId: z.string().describe("App ID to get token for"),
  },
}, makeGetAppToken(client as any));

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
```

**Step 2: Verify build**

```bash
npx tsc
```

Expected: compiles with no errors.

**Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up MCP server with all 13 tools via stdio transport"
```

---

## Task 12: README + Packaging

> **Depends on:** Task 11.

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Modify: `package.json` (add repository, homepage, files fields)

**Step 1: Create README.md**

Include: overview, installation (`npx gupshup-mcp`), env var table, Claude Code config JSON, tool reference table (13 tools with one-liner descriptions), example natural-language usage, contributing section.

**Step 2: Create MIT LICENSE file**

**Step 3: Update package.json**

Add `"files": ["dist", "README.md", "LICENSE", ".env.example"]`, `"repository"`, `"homepage"` fields.

**Step 4: Verify npm pack works**

```bash
npm run build
npm pack --dry-run
```

Expected: lists only dist/, README.md, LICENSE, .env.example, package.json.

**Step 5: Commit**

```bash
git add README.md LICENSE package.json
git commit -m "docs: add README, LICENSE, npm packaging config"
```

---

## Task 13: Integration Smoke Test

> **Depends on:** Task 12.

**Files:**
- No new files — manual verification

**Step 1: Build and run locally**

```bash
npm run build
```

**Step 2: Test with Claude Code config**

Add to `~/.claude/settings.json` or project-level config:

```json
{
  "mcpServers": {
    "gupshup": {
      "command": "node",
      "args": ["/Users/mac/gupshup-mcp/dist/index.js"],
      "env": {
        "GUPSHUP_PARTNER_TOKEN": "<your-token>",
        "GUPSHUP_DEFAULT_APP_ID": "<your-app-id>"
      }
    }
  }
}
```

**Step 3: Verify tools appear in Claude Code**

Open new Claude Code session and check that all 13 Gupshup tools are listed.

**Step 4: Test `list_apps` (lightest call)**

Ask Claude: "List my Gupshup apps" — should call `list_apps` and return data.

**Step 5: Test `list_templates`**

Ask Claude: "Show me all WhatsApp templates" — should return template list.

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: integration smoke test complete"
```

---

## Summary

| Task | Description | Depends On | Parallel Group |
|------|-------------|------------|----------------|
| 1 | Project scaffold | — | — |
| 2 | TypeScript types | 1 | — |
| 3 | Error translation | 2 | A (with 4, 5) |
| 4 | Rate limiter | 2 | A (with 3, 5) |
| 5 | Token manager | 2 | A (with 3, 4) |
| 6 | API client | 3, 4, 5 | — |
| 7 | Template tools (create + list + edit + delete + upload) | 6 | B (with 8, 9, 10) |
| 8 | Messaging tool | 6 | B (with 7, 9, 10) |
| 9 | Analytics tools | 6 | B (with 7, 8, 10) |
| 10 | Utility tools | 6 | B (with 7, 8, 9) |
| 11 | MCP server entry point | 7, 8, 9, 10 | — |
| 12 | README + packaging | 11 | — |
| 13 | Integration smoke test | 12 | — |

**Estimated tasks:** 13
**Parallel groups:** 2 (group A: 3 tasks, group B: 4 tasks)
**Sequential bottlenecks:** scaffold → types → [parallel A] → client → [parallel B] → server → README → smoke test
