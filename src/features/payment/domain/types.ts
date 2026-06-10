export interface CheckoutRequest {
  amount: number;
  currency: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  id: string;
  url?: string;
}

export interface WebhookVerificationInput {
  payload: string;
  signature: string;
}
