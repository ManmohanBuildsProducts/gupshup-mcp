export interface TemplateRef {
  id: string;
  params: string[];
}

export interface TextMessage {
  type: "text";
  text: string;
}

export interface ImageMessage {
  type: "image";
  image: { link: string };
}

export interface VideoMessage {
  type: "video";
  video: { link: string };
}

export interface DocumentMessage {
  type: "document";
  document: { link: string; filename?: string };
}

export type TemplateMessage = TextMessage | ImageMessage | VideoMessage | DocumentMessage;

export interface SendTemplateParams {
  appId?: string;
  source: string;
  destination: string;
  srcName: string;
  template: TemplateRef;
  message: TemplateMessage;
}

export interface SendMessageResult {
  status: string;
  messageId: string;
}
