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
