export type TradesJobStatus = "draft" | "posted" | "closed";

export type TradesJobCategory =
  | "general_building"
  | "electrical"
  | "plumbing"
  | "heating"
  | "kitchen"
  | "bathroom"
  | "roofing"
  | "decorating"
  | "flooring"
  | "landscaping"
  | "other";

export type TradesJob = {
  id: string;
  userId: string;
  title: string;
  propertyAddress: string | null;
  postcode: string | null;
  propertyType: string | null;
  jobCategory: TradesJobCategory;
  description: string;
  budgetMin: number | null;
  budgetMax: number | null;
  desiredStartDate: string | null;
  status: TradesJobStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateTradesJobInput = {
  title: string;
  propertyAddress?: string;
  postcode?: string;
  propertyType?: string;
  jobCategory: TradesJobCategory;
  description: string;
  budgetMin?: number;
  budgetMax?: number;
  desiredStartDate?: string;
  status?: TradesJobStatus;
};

export type UpdateTradesJobInput = Partial<
  Omit<CreateTradesJobInput, "status"> & { status: TradesJobStatus }
>;

/**
 * TRADES-PRIVACY-R1B — public-safe posted job projection.
 * Must not include propertyAddress, full postcode, or userId.
 */
export type PublicTradesJob = {
  id: string;
  title: string;
  description: string;
  jobCategory: TradesJobCategory;
  budgetMin: number | null;
  budgetMax: number | null;
  desiredStartDate: string | null;
  propertyType: string | null;
  createdAt: string;
  /** Coarse UK outward postcode only (e.g. W14). Never full unit postcode. */
  outwardPostcode: string | null;
};
