#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { GupshupEnterpriseClient } from "./api/client.js";
import {
  makeWhatsappOptIn,
  makeWhatsappSendTemplate,
  makeWhatsappSendText,
} from "./tools/whatsapp.js";
import { makeSmsSendText } from "./tools/sms.js";
import { makeCheckCredentials, makeGatewayRawRequest } from "./tools/gateway.js";

const SMS_ENDPOINT =
  process.env.GUPSHUP_API_ENDPOINT ??
  "https://enterprise.smsgupshup.com/GatewayAPI/rest";
const WHATSAPP_ENDPOINT =
  process.env.GUPSHUP_WHATSAPP_API_ENDPOINT ??
  "https://media.smsgupshup.com/GatewayAPI/rest";

const LOG_LEVEL = (process.env.GUPSHUP_LOG_LEVEL ?? "off") as "off" | "info" | "debug";
const REDACT_LOGS = (process.env.GUPSHUP_REDACT_LOGS ?? "true").toLowerCase() !== "false";
const MAX_RETRIES = Number(process.env.GUPSHUP_MAX_RETRIES ?? 3);
const RETRY_BASE_MS = Number(process.env.GUPSHUP_RETRY_BASE_MS ?? 300);
const RETRY_MAX_MS = Number(process.env.GUPSHUP_RETRY_MAX_MS ?? 5000);
const RETRY_JITTER_MS = Number(process.env.GUPSHUP_RETRY_JITTER_MS ?? 150);

const client = new GupshupEnterpriseClient({
  smsEndpoint: SMS_ENDPOINT,
  whatsappEndpoint: WHATSAPP_ENDPOINT,
  smsUserId: process.env.GUPSHUP_USER_ID,
  smsPassword: process.env.GUPSHUP_PASSWORD,
  whatsappUserId: process.env.GUPSHUP_WHATSAPP_USER_ID,
  whatsappPassword: process.env.GUPSHUP_WHATSAPP_PASSWORD,
  logLevel: LOG_LEVEL,
  redactLogs: REDACT_LOGS,
  maxRetries: MAX_RETRIES,
  retryBaseMs: RETRY_BASE_MS,
  retryMaxMs: RETRY_MAX_MS,
  retryJitterMs: RETRY_JITTER_MS,
});

if (!client.hasSmsCredentials() && !client.hasWhatsappCredentials()) {
  console.error(
    "Error: set at least one credential pair: " +
      "(GUPSHUP_USER_ID + GUPSHUP_PASSWORD) or " +
      "(GUPSHUP_WHATSAPP_USER_ID + GUPSHUP_WHATSAPP_PASSWORD)."
  );
  process.exit(1);
}

const server = new McpServer({
  name: "gupshup-mcp",
  version: "0.2.0-enterprise",
});

server.registerTool(
  "check_gateway_credentials",
  {
    title: "Check Gateway Credentials",
    description:
      "Checks whether SMS and WhatsApp Enterprise credentials are configured in environment variables.",
    inputSchema: {},
  },
  makeCheckCredentials(client)
);

server.registerTool(
  "whatsapp_opt_in",
  {
    title: "WhatsApp Opt In",
    description: "Opt in a phone number for WhatsApp via Enterprise Gateway API.",
    inputSchema: {
      phoneNumber: z
        .string()
        .describe("Phone number with country code, digits only, e.g. 919999999999"),
    },
  },
  makeWhatsappOptIn(client)
);

server.registerTool(
  "whatsapp_send_template",
  {
    title: "Send WhatsApp Template",
    description:
      "Send a WhatsApp template message (HSM) using Enterprise Gateway API.",
    inputSchema: {
      sendTo: z
        .string()
        .describe("Recipient phone with country code, digits only, e.g. 919999999999"),
      templateId: z.string().describe("Approved Gupshup template ID"),
      variables: z.record(z.string(), z.string()).optional(),
      msgType: z.string().optional().describe("Default TEXT"),
      format: z.string().optional().describe("Default Text"),
      dataEncoding: z.string().optional().describe("Default TEXT"),
    },
  },
  makeWhatsappSendTemplate(client)
);

server.registerTool(
  "whatsapp_send_text",
  {
    title: "Send WhatsApp Text",
    description: "Send a plain WhatsApp message via Enterprise Gateway API.",
    inputSchema: {
      sendTo: z
        .string()
        .describe("Recipient phone with country code, digits only, e.g. 919999999999"),
      message: z.string().describe("Message text"),
      msgType: z.string().optional().describe("Default TEXT"),
      format: z.string().optional().describe("Default text"),
    },
  },
  makeWhatsappSendText(client)
);

server.registerTool(
  "sms_send_text",
  {
    title: "Send SMS Text",
    description: "Send SMS via Enterprise Gateway API.",
    inputSchema: {
      sendTo: z
        .string()
        .describe("Comma-separated phone numbers with country code if needed"),
      message: z.string().describe("SMS message body"),
      principalEntityId: z.string().optional(),
      dltTemplateId: z.string().optional(),
      msgType: z.string().optional().describe("Default TEXT"),
      format: z.string().optional().describe("Default JSON"),
    },
  },
  makeSmsSendText(client)
);

server.registerTool(
  "gateway_raw_request",
  {
    title: "Gateway Raw Request",
    description:
      "Advanced: call Enterprise Gateway directly by method/params. Credentials are automatically injected.",
    inputSchema: {
      endpoint: z.enum(["sms", "whatsapp"]),
      httpMethod: z.enum(["GET", "POST"]).optional(),
      requestParams: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    },
  },
  makeGatewayRawRequest(client)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
