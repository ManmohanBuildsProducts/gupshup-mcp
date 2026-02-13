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
    message: z.discriminatedUnion("type", [
      z.object({ type: z.literal("text"), text: z.string() }),
      z.object({ type: z.literal("image"), image: z.object({ link: z.string() }) }),
      z.object({ type: z.literal("video"), video: z.object({ link: z.string() }) }),
      z.object({ type: z.literal("document"), document: z.object({ link: z.string(), filename: z.string().optional() }) }),
    ]),
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
}, makeGetAppToken(client));

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
