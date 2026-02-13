# SPEC: gupshup-mcp Enterprise Gateway

## Scope

This MCP server integrates with Gupshup Enterprise Gateway API (not Partner API).

## Endpoints

- SMS: `https://enterprise.smsgupshup.com/GatewayAPI/rest`
- WhatsApp: `https://media.smsgupshup.com/GatewayAPI/rest`

Both are overrideable via env vars.

## Authentication

Per-request `userid` and `password` are injected from environment variables.

- SMS: `GUPSHUP_USER_ID`, `GUPSHUP_PASSWORD`
- WhatsApp: `GUPSHUP_WHATSAPP_USER_ID`, `GUPSHUP_WHATSAPP_PASSWORD`

## Reliability And Logging

- Retries with exponential backoff + jitter are enabled for transient failures:
  - HTTP statuses: `429`, `500`, `502`, `503`, `504`
  - Network/fetch/timeout errors
- Non-transient HTTP errors (e.g. `400`, `401`, `403`) fail fast.
- Configuration:
  - `GUPSHUP_MAX_RETRIES` (default `3`)
  - `GUPSHUP_RETRY_BASE_MS` (default `300`)
  - `GUPSHUP_RETRY_MAX_MS` (default `5000`)
  - `GUPSHUP_RETRY_JITTER_MS` (default `150`)
- Logging:
  - `GUPSHUP_LOG_LEVEL`: `off` | `info` | `debug`
  - `GUPSHUP_REDACT_LOGS`: `true` by default
  - When redaction is enabled, credentials, phone values, and message bodies are masked.

## Tool Contract

1. `check_gateway_credentials`
- Input: `{}`
- Output: `{ smsConfigured: boolean, whatsappConfigured: boolean }`

2. `whatsapp_opt_in`
- Input: `{ phoneNumber: string }`
- Gateway call: `method=OPT_IN`, `channel=WHATSAPP`

3. `whatsapp_send_template`
- Input: `{ sendTo, templateId, variables?, msgType?, format?, dataEncoding? }`
- Gateway call: `method=SENDMESSAGE`, `isTemplate=true`, `isHSM=true`

4. `whatsapp_send_text`
- Input: `{ sendTo, message, msgType?, format? }`

5. `sms_send_text`
- Input: `{ sendTo, message, principalEntityId?, dltTemplateId?, msgType?, format? }`
- Gateway call: `method=sendMessage`

6. `gateway_raw_request`
- Input: `{ endpoint: "sms"|"whatsapp", httpMethod?: "GET"|"POST", requestParams: Record<string,string|number|boolean> }`
- Reserved params `userid` and `password` are blocked from override.

## Response Handling

- If body parses as JSON, return JSON object.
- Otherwise parse pipe-delimited gateway string (e.g. `success | 919... | id`) into:
  - `raw`
  - `status` (`success`/`error`/`unknown`)
  - `code`
  - `message`
