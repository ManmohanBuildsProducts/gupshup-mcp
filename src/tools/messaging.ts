import { GupshupClient } from "../api/client.js";
import type { SendTemplateParams } from "../types/index.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeSendTemplateMessage(client: GupshupClient) {
  return async (params: SendTemplateParams): Promise<ToolResult> => {
    const data = (await client.appRequest(
      "POST",
      "/partner/app/{appId}/template/msg",
      params.appId,
      {
        source: params.source,
        destination: params.destination,
        "src.name": params.srcName,
        template: params.template,
        message: params.message,
      }
    )) as any;

    return {
      content: [
        {
          type: "text",
          text: `Message sent to ${params.destination}.\nStatus: ${data.status}\nMessage ID: ${data.messageId}`,
        },
      ],
    };
  };
}
