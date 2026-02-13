# Gupshup WhatsApp MCP Server — Spec v2

## Overview

An open-source MCP (Model Context Protocol) server that connects AI assistants to Gupshup's WhatsApp Business API. Enables template lifecycle management, message sending, and delivery analytics — all through natural language via Claude Code or any MCP-compatible client.

**Language:** TypeScript
**Transport:** stdio (standard MCP transport)
**License:** MIT (open source)
**Docs reference:** https://partner-docs.gupshup.io (pinned — old `docs.gupshup.io` deprecated Jan 2025)

---

## Authentication

### Two-Token Model

Gupshup distinguishes between **partner-level** and **app-level** tokens:

1. **Partner Token (JWT)** — obtained from Gupshup dashboard or `POST /partner/account/login`. Used for account-scope operations (`list_apps`, fetching app tokens).
2. **App Token (`sk_*`)** — obtained via `GET /partner/app/{appId}/token` using the partner token. Used for all app-scope operations (templates, messaging, analytics).

The MCP server auto-fetches and caches app tokens internally. Users only configure the partner token.

### Env Vars

| Env Var | Required | Description |
|---------|----------|-------------|
| `GUPSHUP_PARTNER_TOKEN` | Yes | Partner JWT token from Gupshup dashboard |
| `GUPSHUP_DEFAULT_APP_ID` | No | Default app ID. If set, app-scope tools use this when `appId` is omitted. If not set, `appId` is required per tool call. |
| `GUPSHUP_BASE_URL` | No | API base URL. Defaults to `https://partner.gupshup.io`. Override for staging/testing. |

### Token Flow (internal)

```
Partner Token (env var)
  └─► GET /partner/app/{appId}/token
        └─► App Token (sk_*) — cached, idempotent
              └─► Used in `token` header for all app-scope API calls
```

---

## MCP Tools (13 tools)

### 1. Template Management (5 tools)

#### `create_template`
Create a new WhatsApp message template and submit for Meta approval.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `elementName` | string | Yes | Template name (lowercase, alphanumeric, underscores only) |
| `languageCode` | string | Yes | e.g., `en_US`, `hi` |
| `category` | enum | Yes | `MARKETING`, `UTILITY`, `AUTHENTICATION` |
| `templateType` | enum | Yes | `TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT`, `LOCATION`, `CAROUSEL`, `PRODUCT`, `CATALOG`, `LTO` |
| `content` | string | Yes | Body text (max 1024 chars). Variables: `{{1}}`, `{{2}}`, etc. |
| `header` | string | No | Header text (max 60 chars). Not for AUTHENTICATION. |
| `footer` | string | No | Footer text (max 60 chars) |
| `buttons` | object[] | No | Button config array (max 10). Each: `{ type, text, url?, phoneNumber? }` |
| `example` | string | No | Sample text with variables filled in (mandatory for approval) |
| `exampleMedia` | string | No | Media handle ID for sample (from `upload_media`) |
| `vertical` | string | No | Business use-case label (max 180 chars) |
| `allowTemplateCategoryChange` | boolean | No | Let Meta re-categorize if needed |

**Constraints:**
- `PRODUCT`, `CATALOG`, `LTO`, `CAROUSEL` only available for MARKETING & UTILITY categories
- `PRODUCT`, `CATALOG`, `LTO`, `CAROUSEL` not available on On-premises API
- AUTHENTICATION templates must start with `{{1}} is your verification code.`

**API:** `POST /partner/app/{appId}/templates`
**Auth:** App token (`token` header)
**Content-Type:** `application/x-www-form-urlencoded`

---

#### `edit_template`
Edit an existing template (resubmits for Meta approval).

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `templateId` | string | Yes | Template UUID |
| `content` | string | No | Updated body text |
| `header` | string | No | Updated header |
| `footer` | string | No | Updated footer |
| `buttons` | object[] | No | Updated button config array |
| `category` | enum | No | Updated category |
| `templateType` | enum | No | Updated type |
| `example` | string | No | Updated example text |
| `exampleMedia` | string | No | Updated sample media handle |
| `enableSample` | boolean | No | Required `true` for all template types |

**API:** `PUT /partner/app/{appId}/templates/{templateId}`
**Auth:** App token (`token` header)

---

#### `list_templates`
Get all templates for an app with their status.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |

**Returns:** Array of templates with:
```typescript
{
  id: string;              // UUID
  elementName: string;     // template name
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  status: "APPROVED" | "REJECTED" | "PENDING";
  templateType: string;
  languageCode: string;
  quality: string;
  reason: string | null;   // rejection reason
  createdOn: number;       // timestamp
  modifiedOn: number;
  namespace: string;
  wabaId: string;
}
```

**API:** `GET /partner/app/{appId}/templates`
**Auth:** App token (`token` header)

---

#### `delete_template`
Permanently delete a template. **Irreversible.**

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `elementName` | string | Yes | Template name |
| `templateId` | string | No | Template UUID (for targeted deletion when multiple languages exist) |

**API:**
- Without templateId: `DELETE /partner/app/{appId}/template/{elementName}`
- With templateId: `DELETE /partner/app/{appId}/template/{elementName}/{templateId}`

**Auth:** App token (Authorization header)

---

#### `upload_media`
Upload media for template headers/samples. Returns a handle ID for use in `create_template`.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `file` | string | Yes | File path or URL of media to upload |
| `fileType` | enum | Yes | `image/jpeg`, `image/png`, `video/mp4`, `application/pdf` |

**Returns:** `{ handleId: string }` — use this as `exampleMedia` in create/edit template.

**API:** `POST /partner/app/{appId}/upload/media`
**Auth:** App token

---

### 2. Messaging (1 tool)

#### `send_template_message`
Send an approved template message to a WhatsApp user.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `source` | string | Yes | Source phone number (your registered WABA number, with country code) |
| `destination` | string | Yes | Recipient phone number (with country code) |
| `srcName` | string | Yes | App name registered with Gupshup |
| `template` | object | Yes | `{ id: string, params: string[] }` — template UUID and variable values in order |
| `message` | object | Yes | `{ type: "text", text: string }` for text templates. For media: `{ type: "image", image: { link: string } }` etc. |

**Example tool call:**
```json
{
  "source": "919643874844",
  "destination": "918886912227",
  "srcName": "MyBrand",
  "template": {
    "id": "9ff51097-48c9-47c7-a4e4-a9bb5801d8ea",
    "params": ["Rahul", "ORD-12345"]
  },
  "message": {
    "type": "text",
    "text": "Hi Rahul, your order ORD-12345 has shipped!"
  }
}
```

**Returns:** `{ status: "submitted", messageId: string }`

**API:** `POST /partner/app/{appId}/template/msg`
**Auth:** App token (`token` header)
**Content-Type:** `application/x-www-form-urlencoded`

**Implementation note:** MCP accepts typed objects; the HTTP layer serializes `template` and `message` to JSON strings and sends as form-urlencoded fields alongside `source`, `destination`, `src.name`.

---

### 3. Analytics & Reporting (4 tools)

#### `enable_template_analytics`
Enable or disable template analytics tracking on Meta. **Must be called before `get_template_analytics` will return data.**

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `enable` | boolean | Yes | `true` to enable, `false` to disable |

**API:** `POST /partner/app/{appId}/template/analytics`
**Auth:** App token (`token` header)

---

#### `get_template_analytics`
Get delivery analytics (sent, delivered, read, clicked) per template over a time range.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `start` | number | Yes | Start time as Unix timestamp (seconds) |
| `end` | number | Yes | End time as Unix timestamp (seconds) |
| `templateIds` | string[] | Yes | Array of template UUIDs (max 30) |
| `granularity` | enum | No | `DAILY` or `AGGREGATE` (default: `AGGREGATE`) |
| `metricTypes` | string[] | No | Subset of `["SENT", "DELIVERED", "READ", "CLICKED"]` (default: all) |

**Returns:**
```typescript
{
  status: "success",
  template_analytics: Array<{
    template_id: string;
    sent: number;
    delivered: number;
    read: number;
    start: number;
    end: number;
  }>
}
```

**Constraints:**
- Max 90 days of historical data
- Requires `enable_template_analytics` to have been called with `enable: true` first
- Rate limit: 10 requests per 60 seconds per appId

**API:** `GET /partner/app/{appId}/template/analytics`
**Auth:** App token (`token` header)

---

#### `compare_templates`
Compare performance metrics across multiple templates side by side. Returns block rates, send counts, and template rankings.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `templateId` | string | Yes | Primary template UUID to compare against |
| `templateList` | string[] | Yes | Template UUIDs to compare with the primary |
| `start` | number | Yes | Start time as Unix timestamp |
| `end` | number | Yes | End time as Unix timestamp |

**Constraints:**
- Time range must be exactly 7, 30, 60, or 90 days
- Start must be before end

**API:** `GET /partner/app/{appId}/template/analytics/{templateId}/compare`
**Auth:** App token (`token` header)

---

#### `get_app_health`
Get app health status, quality rating, messaging limits, and wallet balance in a single call.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |

**Returns:** Combined data from three internal API calls:
```typescript
{
  health: { /* from /health */ },
  ratings: {
    qualityRating: string;
    messagingLimit: string;
    phoneQuality: string;
  },
  wallet: {
    balance: number;
    currency: string;
  }
}
```

**API (internal, parallelized):**
- `GET /partner/app/{appId}/health`
- `GET /partner/app/{appId}/ratings`
- `GET /partner/app/{appId}/wallet/balance`

**Auth:** App token (`token` header)

---

### 4. Utility (3 tools)

#### `list_apps`
List all Gupshup apps/WABAs linked to the partner account.

**Parameters:** None (uses partner token directly — no appId needed)

**Returns:** Array of apps with appId, name, phone number, status.

**API:** `GET /partner/account/api/partnerApps`
**Auth:** Partner token (Authorization header) — this is an account-scope endpoint

---

#### `get_usage_summary`
Get daily usage breakdown for an app over a date range.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | No | Override default app ID |
| `from` | string | Yes | Start date `YYYY-MM-DD` |
| `to` | string | Yes | End date `YYYY-MM-DD` |

**API:** `GET /partner/app/{appId}/usage?from={from}&to={to}`
**Auth:** App token (Authorization header)

---

#### `get_app_token`
Manually fetch or refresh the app-level access token. Normally handled automatically, but exposed for debugging.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | Yes | App ID to get token for |

**Returns:** `{ token: string, expiresOn: number, active: boolean }`

**API:** `GET /partner/app/{appId}/token`
**Auth:** Partner token (Authorization header)

---

## Rate Limiting

Gupshup enforces per-endpoint rate limits (effective Sept 2023). The MCP server implements per-endpoint throttling with automatic backoff.

| Endpoint Group | Limit | Cooldown |
|----------------|-------|----------|
| `/templates` (list) | 10/min per appId | 1 minute |
| `/token` | 10/min per appId | 1 minute |
| `/health` | 10/min per appId | 1 minute |
| `/capping` | 10/min per appId | 1 minute |
| `/template/analytics` | 10/60s per appId | 1 minute |
| `/subscription` | 5/60s per appId | 1 minute |
| `/media/` | 10/sec per appId | 1 second |
| `/account/login` | 10/min (global) | 1 minute |
| All other APIs | 10/sec | 1 second |

**Implementation:**
- Per-endpoint request queue with token bucket algorithm
- Automatic retry with exponential backoff on 429 responses
- Template list cache (TTL: 60s) to reduce redundant calls
- App token cache (idempotent — Gupshup returns existing token if valid)
- Graceful error messages with retry timing on rate limit hits

---

## Error Handling

Gupshup error responses can be cryptic. The MCP server translates common errors into human-friendly messages:

| Gupshup Error | MCP Translation |
|---------------|-----------------|
| `Invalid app id provided` | "App ID not found. Run `list_apps` to see valid app IDs." |
| `401 Unauthorized` | "Token expired or invalid. Check GUPSHUP_PARTNER_TOKEN env var." |
| `429 Too Many Requests` | "Rate limited on {endpoint}. Retrying in {cooldown}s..." |
| `Template not found` | "Template '{name}' not found. Run `list_templates` to see available templates." |
| `enableSample is required` | "Sample text is mandatory for template approval. Provide the `example` parameter." |
| `Template analytics not enabled` | "Run `enable_template_analytics` first before querying analytics." |

---

## Project Structure

```
gupshup-mcp/
├── src/
│   ├── index.ts              # MCP server entry point, tool registration
│   ├── tools/
│   │   ├── templates.ts      # create, edit, list, delete, upload
│   │   ├── messaging.ts      # send_template_message
│   │   ├── analytics.ts      # enable_analytics, get_analytics, compare, get_health
│   │   └── utility.ts        # list_apps, get_usage_summary, get_app_token
│   ├── api/
│   │   └── client.ts         # HTTP client — form-urlencoded serialization, error mapping
│   ├── auth/
│   │   └── token-manager.ts  # Two-token flow: partner JWT → app tokens (sk_*), caching
│   ├── types/
│   │   └── index.ts          # Exported TypeScript types for all API requests/responses
│   └── utils/
│       ├── rate-limiter.ts   # Per-endpoint token bucket, backoff, retry
│       └── errors.ts         # Human-friendly error translation map
├── package.json
├── tsconfig.json
├── README.md                 # Setup guide, env vars, Claude Code config, examples
├── LICENSE                   # MIT
└── .env.example              # Template for env vars
```

---

## Claude Code Integration

Users add to their Claude Code MCP config:

```json
{
  "mcpServers": {
    "gupshup": {
      "command": "npx",
      "args": ["-y", "gupshup-mcp"],
      "env": {
        "GUPSHUP_PARTNER_TOKEN": "your-partner-jwt-token",
        "GUPSHUP_DEFAULT_APP_ID": "your-app-id"
      }
    }
  }
}
```

Minimal config (no default app — must pass `appId` per call):
```json
{
  "mcpServers": {
    "gupshup": {
      "command": "npx",
      "args": ["-y", "gupshup-mcp"],
      "env": {
        "GUPSHUP_PARTNER_TOKEN": "your-partner-jwt-token"
      }
    }
  }
}
```

---

## Open Source Considerations

- **No secrets in code** — all auth via env vars, tokens auto-fetched
- **Comprehensive README** — setup steps, env var docs, example natural-language usage
- **`.env.example`** — lists all vars with descriptions and placeholder values
- **Typed exports** — `import { Template, AnalyticsResult } from 'gupshup-mcp'` for consumers
- **Human-friendly errors** — translated from Gupshup's cryptic responses
- **npm publishable** — users install via `npx gupshup-mcp`
- **Pinned to current docs** — built against `partner-docs.gupshup.io` (not deprecated `docs.gupshup.io`)

---

## Changes from Spec v1

| # | What Changed | Why |
|---|-------------|-----|
| 1 | `send_template_message` redesigned with `source`, `destination`, `srcName`, `template` object, `message` object | V1 params didn't match Gupshup V2 API contract |
| 2 | Two-token auth model (partner JWT → app tokens) | Gupshup uses separate partner and app tokens; single-token was incorrect |
| 3 | `get_template_analytics` now uses dedicated `/template/analytics` endpoint | Direct endpoint exists — log aggregation was slow and unreliable |
| 4 | Added `enable_template_analytics` tool | Prerequisite — Meta analytics must be enabled before querying |
| 5 | Added `compare_templates` tool | Dedicated comparison endpoint discovered in partner docs |
| 6 | Template types expanded: added `PRODUCT`, `CATALOG`, `LTO` | Confirmed in partner docs (MARKETING/UTILITY only) |
| 7 | `buttons` and `template`/`message` params use typed objects | JSON-as-string hurts MCP usability; stringify at HTTP boundary only |
| 8 | `GUPSHUP_DEFAULT_APP_ID` now optional | Account-scope tools (`list_apps`) don't need it |
| 9 | Full per-endpoint rate limit table | Gupshup has different limits per endpoint, not just templates |
| 10 | Added `GUPSHUP_BASE_URL` env var | Enables staging/testing without code changes |
| 11 | Added error translation map | Gupshup errors are cryptic; open-source DX matters |
| 12 | Added `get_app_token` debug tool | Useful for troubleshooting auth issues |
| 13 | Pinned to `partner-docs.gupshup.io` | Old docs deprecated Jan 2025 |
