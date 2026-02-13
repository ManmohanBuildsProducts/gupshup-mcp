# gupshup-mcp (Enterprise Gateway)

MCP server for Gupshup Enterprise Gateway API (`enterprise.smsgupshup.com` and `media.smsgupshup.com`).

## Breaking Change: Partner API vs Enterprise Gateway

This repo has two incompatible lines:

- **Enterprise Gateway (current)**: use `v0.2.0+` (this branch). Uses `GUPSHUP_USER_ID` / `GUPSHUP_PASSWORD` and `GUPSHUP_WHATSAPP_USER_ID` / `GUPSHUP_WHATSAPP_PASSWORD`.
- **Partner API (legacy)**: use `v0.1.0` tag. It used `partner.gupshup.io` and a `GUPSHUP_PARTNER_TOKEN` JWT and had a different set of tools.

If you’re using `enterprise.smsgupshup.com` / `media.smsgupshup.com`, you want **Enterprise Gateway** (`v0.2.0+`).

## What Changed

This server now targets Enterprise credentials (`userid/password`) and Gateway methods like `SENDMESSAGE` and `OPT_IN`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GUPSHUP_USER_ID` | SMS only | SMS gateway user id |
| `GUPSHUP_PASSWORD` | SMS only | SMS gateway password |
| `GUPSHUP_WHATSAPP_USER_ID` | WhatsApp only | WhatsApp gateway user id |
| `GUPSHUP_WHATSAPP_PASSWORD` | WhatsApp only | WhatsApp gateway password |
| `GUPSHUP_API_ENDPOINT` | No | Default `https://enterprise.smsgupshup.com/GatewayAPI/rest` |
| `GUPSHUP_WHATSAPP_API_ENDPOINT` | No | Default `https://media.smsgupshup.com/GatewayAPI/rest` |
| `GUPSHUP_LOG_LEVEL` | No | `off` (default), `info`, `debug` |
| `GUPSHUP_REDACT_LOGS` | No | `true` by default; masks secrets/phone/message in logs |
| `GUPSHUP_MAX_RETRIES` | No | Retry count for transient errors (default `3`) |
| `GUPSHUP_RETRY_BASE_MS` | No | Exponential backoff base delay (default `300`) |
| `GUPSHUP_RETRY_MAX_MS` | No | Max per-retry delay cap (default `5000`) |
| `GUPSHUP_RETRY_JITTER_MS` | No | Random jitter to spread retries (default `150`) |

You must set at least one credential pair:
- SMS: `GUPSHUP_USER_ID` + `GUPSHUP_PASSWORD`
- WhatsApp: `GUPSHUP_WHATSAPP_USER_ID` + `GUPSHUP_WHATSAPP_PASSWORD`

## Secure Local Setup

1. Create local untracked env file:

```bash
cp .env.example .env.enterprise
```

2. Fill secrets in `.env.enterprise`.

3. Load env into shell:

```bash
set -a
source .env.enterprise
set +a
```

`.env` files are ignored by git; do not commit credentials.

## Claude Code MCP Config

Use local build path:

```json
{
  "mcpServers": {
    "gupshup": {
      "command": "node",
      "args": ["/Users/mac/gupshup-mcp/dist/index.js"],
      "env": {
        "GUPSHUP_USER_ID": "your-sms-user-id",
        "GUPSHUP_PASSWORD": "your-sms-password",
        "GUPSHUP_WHATSAPP_USER_ID": "your-wa-user-id",
        "GUPSHUP_WHATSAPP_PASSWORD": "your-wa-password"
      }
    }
  }
}
```

## Tools

- `check_gateway_credentials`: checks if SMS/WhatsApp creds are configured.
- `whatsapp_opt_in`: runs `OPT_IN` for a phone number.
- `whatsapp_send_template`: sends template/HSM message.
- `whatsapp_send_text`: sends a plain WhatsApp message.
- `sms_send_text`: sends SMS text.
- `gateway_raw_request`: advanced direct method call with auto-injected credentials.

## Tool Examples

`check_gateway_credentials`

```json
{}
```

`whatsapp_opt_in`

```json
{
  "phoneNumber": "919999999999"
}
```

`whatsapp_send_template`

```json
{
  "sendTo": "919999999999",
  "templateId": "7091229",
  "variables": {
    "var1": "Alice",
    "var2": "ORD-123"
  }
}
```

`whatsapp_send_text`

```json
{
  "sendTo": "919999999999",
  "message": "Hello from gupshup-mcp"
}
```

`sms_send_text`

```json
{
  "sendTo": "919999999999",
  "message": "Your OTP is 123456"
}
```

`gateway_raw_request`

```json
{
  "endpoint": "whatsapp",
  "httpMethod": "POST",
  "requestParams": {
    "method": "SENDMESSAGE",
    "send_to": "919999999999",
    "format": "Text",
    "msg_type": "TEXT",
    "isTemplate": true,
    "isHSM": true,
    "template_id": "7091229",
    "v": "1.1",
    "auth_scheme": "plain",
    "data_encoding": "TEXT",
    "var1": "Alice",
    "var2": "ORD-123"
  }
}
```

## Testing

```bash
npm install
npm test
npm run build
npm run smoke -- check
```

Then run incremental live checks:

```bash
npm run smoke -- opt-in 91XXXXXXXXXX
npm run smoke -- send-template 91XXXXXXXXXX YOUR_TEMPLATE_ID var1=Alice var2=Order123
npm run smoke -- send-sms 91XXXXXXXXXX "Test message"
```

## Logging And Retry Behavior

- Redacted logging: when `GUPSHUP_LOG_LEVEL` is `info` or `debug`, logs are emitted as JSON lines.
- With `GUPSHUP_REDACT_LOGS=true`, credentials, phone numbers, and message bodies are masked.
- Retry/backoff applies to transient failures:
  - HTTP: `429`, `500`, `502`, `503`, `504`
  - Network/fetch/timeout errors
- No retry for auth/validation failures such as `400`/`401`/`403`.

Live gateway smoke test (after env loaded):

```bash
curl -sS -G "$GUPSHUP_WHATSAPP_API_ENDPOINT" \
  --data-urlencode "userid=$GUPSHUP_WHATSAPP_USER_ID" \
  --data-urlencode "password=$GUPSHUP_WHATSAPP_PASSWORD" \
  --data-urlencode "method=OPT_IN" \
  --data-urlencode "phone_number=91XXXXXXXXXX" \
  --data-urlencode "v=1.1" \
  --data-urlencode "format=json" \
  --data-urlencode "auth_scheme=plain" \
  --data-urlencode "channel=WHATSAPP"
```

## License

[MIT](LICENSE)

## Security And Releases

- Security policy: [SECURITY.md](SECURITY.md)
- Release notes: [CHANGELOG.md](CHANGELOG.md)
