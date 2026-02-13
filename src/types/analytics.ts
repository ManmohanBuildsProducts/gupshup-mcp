export type Granularity = "DAILY" | "AGGREGATE";
export type MetricType = "SENT" | "DELIVERED" | "READ" | "CLICKED";

export interface EnableAnalyticsParams {
  appId?: string;
  enable: boolean;
}

export interface GetAnalyticsParams {
  appId?: string;
  start: number;
  end: number;
  templateIds: string[];
  granularity?: Granularity;
  metricTypes?: MetricType[];
}

export interface TemplateAnalytics {
  template_id: string;
  sent: number;
  delivered: number;
  read: number;
  start: number;
  end: number;
}

export interface CompareTemplatesParams {
  appId?: string;
  templateId: string;
  templateList: string[];
  start: number;
  end: number;
}

export interface UsageSummaryParams {
  appId?: string;
  from: string;
  to: string;
}
