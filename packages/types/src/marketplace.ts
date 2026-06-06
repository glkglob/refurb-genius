// Trades Marketplace domain types (camelCase)
// Backed by tradespeople, trade_specialties, trade_favorites, quote_requests, trade_messages

export type InsuranceStatus = "unknown" | "insured" | "not_insured";

export type Tradeperson = {
  id: string;
  userId: string;
  businessName: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  postcode: string | null;
  bio: string | null;
  insuranceStatus: InsuranceStatus;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TradeSpecialty = {
  id: string;
  tradespersonId: string;
  specialty: string;
  createdAt: string;
  updatedAt: string;
};

export type TradeFavorite = {
  id: string;
  userId: string;
  tradespersonId: string;
  createdAt: string;
};

export type QuoteStatus = "pending" | "quoted" | "accepted" | "rejected" | "cancelled";

export type QuoteRequest = {
  id: string;
  projectId: string;
  tradespersonId: string;
  userId: string;
  status: QuoteStatus;
  message: string | null;
  proposedPrice: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TradeMessage = {
  id: string;
  quoteRequestId: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export type TradepersonWithSpecialties = Tradeperson & {
  specialties: string[];
};

export type QuoteRequestWithMessages = QuoteRequest & {
  messages: TradeMessage[];
};
