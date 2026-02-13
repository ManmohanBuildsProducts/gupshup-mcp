#!/usr/bin/env node

import { GupshupEnterpriseClient } from "../dist/api/client.js";

function usage() {
  console.log(`Usage:
  npm run build
  node scripts/smoke-enterprise.mjs check
  node scripts/smoke-enterprise.mjs opt-in <phone>
  node scripts/smoke-enterprise.mjs send-template <phone> <templateId> [var1=foo var2=bar]
  node scripts/smoke-enterprise.mjs send-sms <phoneOrCsv> <message>

Required env:
  GUPSHUP_API_ENDPOINT / GUPSHUP_WHATSAPP_API_ENDPOINT (optional; defaults exist)
  GUPSHUP_USER_ID + GUPSHUP_PASSWORD (for SMS)
  GUPSHUP_WHATSAPP_USER_ID + GUPSHUP_WHATSAPP_PASSWORD (for WhatsApp)
`);
}

function parseVars(parts) {
  const vars = {};
  for (const part of parts) {
    const [k, ...rest] = part.split("=");
    if (!k || rest.length === 0) continue;
    vars[k] = rest.join("=");
  }
  return vars;
}

async function main() {
  const cmd = process.argv[2];

  const client = new GupshupEnterpriseClient({
    smsEndpoint:
      process.env.GUPSHUP_API_ENDPOINT ??
      "https://enterprise.smsgupshup.com/GatewayAPI/rest",
    whatsappEndpoint:
      process.env.GUPSHUP_WHATSAPP_API_ENDPOINT ??
      "https://media.smsgupshup.com/GatewayAPI/rest",
    smsUserId: process.env.GUPSHUP_USER_ID,
    smsPassword: process.env.GUPSHUP_PASSWORD,
    whatsappUserId: process.env.GUPSHUP_WHATSAPP_USER_ID,
    whatsappPassword: process.env.GUPSHUP_WHATSAPP_PASSWORD,
  });

  if (!cmd || cmd === "help" || cmd === "--help") {
    usage();
    process.exit(0);
  }

  if (cmd === "check") {
    console.log(JSON.stringify(await client.checkCredentials(), null, 2));
    return;
  }

  if (cmd === "opt-in") {
    const phone = process.argv[3];
    if (!phone) {
      usage();
      process.exit(1);
    }
    console.log(JSON.stringify(await client.whatsappOptIn(phone), null, 2));
    return;
  }

  if (cmd === "send-template") {
    const phone = process.argv[3];
    const templateId = process.argv[4];
    if (!phone || !templateId) {
      usage();
      process.exit(1);
    }

    const vars = parseVars(process.argv.slice(5));
    console.log(
      JSON.stringify(
        await client.whatsappSendTemplate({
          sendTo: phone,
          templateId,
          variables: vars,
        }),
        null,
        2
      )
    );
    return;
  }

  if (cmd === "send-sms") {
    const phone = process.argv[3];
    const message = process.argv[4];
    if (!phone || !message) {
      usage();
      process.exit(1);
    }
    console.log(
      JSON.stringify(await client.smsSendText({ sendTo: phone, message }), null, 2)
    );
    return;
  }

  usage();
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
