import { GupshupEnterpriseClient } from "../api/client.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeWhatsappOptIn(client: GupshupEnterpriseClient) {
  return async (params: { phoneNumber: string }): Promise<ToolResult> => {
    const data = await client.whatsappOptIn(params.phoneNumber);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  };
}

export function makeWhatsappSendTemplate(client: GupshupEnterpriseClient) {
  return async (params: {
    sendTo: string;
    templateId: string;
    variables?: Record<string, string>;
    msgType?: string;
    format?: string;
    dataEncoding?: string;
  }): Promise<ToolResult> => {
    const data = await client.whatsappSendTemplate(params);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  };
}

export function makeWhatsappSendText(client: GupshupEnterpriseClient) {
  return async (params: {
    sendTo: string;
    message: string;
    msgType?: string;
    format?: string;
  }): Promise<ToolResult> => {
    const data = await client.whatsappSendText(params);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  };
}
