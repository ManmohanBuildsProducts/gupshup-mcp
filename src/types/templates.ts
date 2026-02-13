export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export type TemplateType =
  | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"
  | "LOCATION" | "CAROUSEL" | "PRODUCT" | "CATALOG" | "LTO";

export type TemplateStatus = "APPROVED" | "REJECTED" | "PENDING";

export interface TemplateButton {
  type: string;
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface Template {
  id: string;
  appId: string;
  elementName: string;
  category: TemplateCategory;
  status: TemplateStatus;
  templateType: TemplateType;
  languageCode: string;
  quality: string;
  reason: string | null;
  createdOn: number;
  modifiedOn: number;
  namespace: string;
  wabaId: string;
  data?: string;
  containerMeta?: string;
  meta?: string;
}

export interface CreateTemplateParams {
  appId?: string;
  elementName: string;
  languageCode: string;
  category: TemplateCategory;
  templateType: TemplateType;
  content: string;
  header?: string;
  footer?: string;
  buttons?: TemplateButton[];
  example?: string;
  exampleMedia?: string;
  vertical?: string;
  allowTemplateCategoryChange?: boolean;
  enableSample?: boolean;
}

export interface EditTemplateParams {
  appId?: string;
  templateId: string;
  content?: string;
  header?: string;
  footer?: string;
  buttons?: TemplateButton[];
  category?: TemplateCategory;
  templateType?: TemplateType;
  example?: string;
  exampleMedia?: string;
  enableSample?: boolean;
}

export interface DeleteTemplateParams {
  appId?: string;
  elementName: string;
  templateId?: string;
}

export interface UploadMediaParams {
  appId?: string;
  file: string;
  fileType: string;
}
