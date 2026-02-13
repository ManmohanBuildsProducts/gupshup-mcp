import { GupshupEnterpriseClient } from "../api/client.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeSmsSendText(client: GupshupEnterpriseClient) {
  return async (params: {
    sendTo: string;
    message: string;
    principalEntityId?: string;
    dltTemplateId?: string;
    msgType?: string;
    format?: string;
  }): Promise<ToolResult> => {
    const data = await client.smsSendText(params);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  };
}
