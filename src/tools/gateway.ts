import { GupshupEnterpriseClient } from "../api/client.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeCheckCredentials(client: GupshupEnterpriseClient) {
  return async (_params: Record<string, never>): Promise<ToolResult> => {
    const data = await client.checkCredentials();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  };
}

export function makeGatewayRawRequest(client: GupshupEnterpriseClient) {
  return async (params: {
    endpoint: "sms" | "whatsapp";
    httpMethod?: "GET" | "POST";
    requestParams: Record<string, string | number | boolean>;
  }): Promise<ToolResult> => {
    const data = await client.gatewayRequest({
      endpoint: params.endpoint,
      httpMethod: params.httpMethod ?? "POST",
      params: params.requestParams,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  };
}
