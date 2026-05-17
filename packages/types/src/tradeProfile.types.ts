export type InsuranceStatus = "unknown" | "insured" | "not_insured";

export type TradeProfile = {
  userId: string;
  businessName: string;
  contactName: string;
  phone: string | null;
  postcode: string | null;
  tradeCategories: string[];
  bio: string | null;
  insuranceStatus: InsuranceStatus;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTradeProfileInput = {
  businessName: string;
  contactName: string;
  phone?: string;
  postcode?: string;
  tradeCategories?: string[];
  bio?: string;
  insuranceStatus?: InsuranceStatus;
};
