export type CheckoutSession = {
  id: string;
  url?: string;
};

export type PaymentIntentStatus = "pending" | "requires_action" | "succeeded" | "failed";

export type PaymentIntent = {
  id: string;
  amount: number;
  status: PaymentIntentStatus;
};

export type PaymentWebhookVerification = {
  payload: string;
  signature: string;
};
