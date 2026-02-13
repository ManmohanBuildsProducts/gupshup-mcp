# gupshup-mcp

MCP server for Gupshup WhatsApp Business API -- template management, messaging, and analytics.

## Quick Start

Add to your Claude Code MCP config (`~/.claude.json` or project `.mcp.json`):

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

Minimal config (pass `appId` per tool call instead):

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

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GUPSHUP_PARTNER_TOKEN` | Yes | Partner JWT token from Gupshup dashboard |
| `GUPSHUP_DEFAULT_APP_ID` | No | Default app ID. If set, app-scope tools use this when `appId` is omitted |
| `GUPSHUP_BASE_URL` | No | API base URL. Defaults to `https://partner.gupshup.io` |

## Tools Reference

| Tool | Category | Description |
|------|----------|-------------|
| `list_templates` | Templates | List all templates with approval status |
| `create_template` | Templates | Create and submit a new template for approval |
| `edit_template` | Templates | Edit existing template (resubmits for approval) |
| `delete_template` | Templates | Permanently delete a template |
| `upload_media` | Templates | Upload media for template headers/samples |
| `send_template_message` | Messaging | Send approved template to a WhatsApp user |
| `enable_template_analytics` | Analytics | Enable/disable template analytics on Meta |
| `get_template_analytics` | Analytics | Get sent/delivered/read/clicked metrics per template |
| `compare_templates` | Analytics | Compare performance across templates |
| `get_app_health` | Analytics | Get health, quality rating, limits, wallet balance |
| `list_apps` | Utility | List all apps/WABAs on your partner account |
| `get_usage_summary` | Utility | Daily usage breakdown for a date range |
| `get_app_token` | Utility | Debug: fetch app-level access token |

## Example Usage

Just ask in natural language:

- "List all my WhatsApp templates"
- "Create a new marketing template called summer_sale with body 'Hi {{1}}, check out our {{2}} sale!'"
- "Show me delivery analytics for template abc-123 over the last 30 days"
- "Send the order_shipped template to +919886912227 with params Rahul, ORD-456"

## Authentication

Gupshup uses a two-token model:

1. **Partner Token (JWT)** -- you provide this via the `GUPSHUP_PARTNER_TOKEN` env var. Get it from the Gupshup dashboard.
2. **App Tokens (`sk_*`)** -- the server auto-fetches and caches these internally using your partner token. No manual setup needed.

You only configure the partner token. Everything else is handled automatically.

## Development

```bash
npm install
npm test
npm run build
```

## License

[MIT](LICENSE)
