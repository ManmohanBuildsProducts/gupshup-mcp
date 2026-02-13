import { GupshupClient } from "../api/client.js";
import type { CreateTemplateParams, EditTemplateParams, DeleteTemplateParams } from "../types/index.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };

export function makeListTemplates(client: GupshupClient) {
  return async (params: { appId?: string }): Promise<ToolResult> => {
    const data = (await client.appRequest(
      "GET",
      "/partner/app/{appId}/templates",
      params.appId
    )) as any;

    const templates = data.templates ?? [];
    const summary = templates.map((t: any) => ({
      id: t.id,
      name: t.elementName,
      type: t.templateType,
      category: t.category,
      status: t.status,
      language: t.languageCode,
      quality: t.quality,
      reason: t.reason,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  };
}

export function makeCreateTemplate(client: GupshupClient) {
  return async (params: CreateTemplateParams): Promise<ToolResult> => {
    const body: Record<string, unknown> = {
      elementName: params.elementName,
      languageCode: params.languageCode,
      category: params.category,
      templateType: params.templateType,
      content: params.content,
      enableSample: true,
    };

    if (params.header) body.header = params.header;
    if (params.footer) body.footer = params.footer;
    if (params.buttons) body.buttons = params.buttons;
    if (params.example) body.example = params.example;
    if (params.exampleMedia) body.exampleMedia = params.exampleMedia;
    if (params.vertical) body.vertical = params.vertical;
    if (params.allowTemplateCategoryChange !== undefined) {
      body.allowTemplateCategoryChange = params.allowTemplateCategoryChange;
    }

    const data = await client.appRequest(
      "POST",
      "/partner/app/{appId}/templates",
      params.appId,
      body
    );

    return {
      content: [
        {
          type: "text",
          text: `Template "${params.elementName}" submitted for approval.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    };
  };
}

export function makeEditTemplate(client: GupshupClient) {
  return async (params: EditTemplateParams): Promise<ToolResult> => {
    const body: Record<string, unknown> = { enableSample: true };
    if (params.content) body.content = params.content;
    if (params.header) body.header = params.header;
    if (params.footer) body.footer = params.footer;
    if (params.buttons) body.buttons = params.buttons;
    if (params.category) body.category = params.category;
    if (params.templateType) body.templateType = params.templateType;
    if (params.example) body.example = params.example;
    if (params.exampleMedia) body.exampleMedia = params.exampleMedia;

    const data = await client.appRequest(
      "PUT",
      `/partner/app/{appId}/templates/${params.templateId}`,
      params.appId,
      body
    );

    return {
      content: [
        {
          type: "text",
          text: `Template "${params.templateId}" updated and resubmitted for approval.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    };
  };
}

export function makeDeleteTemplate(client: GupshupClient) {
  return async (params: DeleteTemplateParams): Promise<ToolResult> => {
    const path = params.templateId
      ? `/partner/app/{appId}/template/${params.elementName}/${params.templateId}`
      : `/partner/app/{appId}/template/${params.elementName}`;

    const data = await client.appRequest("DELETE", path, params.appId);

    return {
      content: [
        {
          type: "text",
          text: `Template "${params.elementName}" permanently deleted.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    };
  };
}

export function makeUploadMedia(client: GupshupClient) {
  return async (params: { appId?: string; file: string; fileType: string }): Promise<ToolResult> => {
    const data = await client.appRequest(
      "POST",
      "/partner/app/{appId}/upload/media",
      params.appId,
      { file: params.file, fileType: params.fileType }
    );

    return {
      content: [
        {
          type: "text",
          text: `Media uploaded.\n${JSON.stringify(data, null, 2)}\nUse the handleId in create_template's exampleMedia parameter.`,
        },
      ],
    };
  };
}
