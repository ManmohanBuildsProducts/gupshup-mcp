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
      content: [{ type: "text", text: JSON.stringify(analytics, null, 2) }],
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
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
      content: [{ type: "text", text: JSON.stringify(combined, null, 2) }],
    };
  };
}
