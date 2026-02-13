export interface GupshupResponse<T = unknown> {
  status: "success" | "error";
  message?: string;
  data?: T;
}

export interface AppToken {
  token: string;
  authoriserId: string;
  requestorId: string;
  createdOn: number;
  modifiedOn: number;
  expiresOn: number;
  active: boolean;
}

export interface AppInfo {
  appId: string;
  name: string;
  phone: string;
  status: string;
}

export interface HealthResult {
  health: Record<string, unknown>;
  ratings: {
    qualityRating: string;
    messagingLimit: string;
    phoneQuality: string;
  };
  wallet: {
    balance: number;
    currency: string;
  };
}
