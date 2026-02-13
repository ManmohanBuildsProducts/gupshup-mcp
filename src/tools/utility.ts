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
      content: [{ type: "text", text: JSON.stringify(apps, null, 2) }],
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
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  };
}

export function makeGetAppToken(client: GupshupClient) {
  return async (params: { appId: string }): Promise<ToolResult> => {
    const token = await client.tokenManager.getAppToken(params.appId);

    const masked =
      token.length > 8
        ? `${token.slice(0, 3)}${"*".repeat(token.length - 7)}${token.slice(-4)}`
        : "****";

    return {
      content: [
        {
          type: "text",
          text: `App token for ${params.appId}: ${masked}\n\nToken is valid and cached. It is used internally for all app-scope API calls.`,
        },
      ],
    };
  };
}
