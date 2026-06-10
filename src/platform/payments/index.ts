export interface CheckoutSession {
  id: string;
  url?: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  status: "pending" | "requires_action" | "succeeded" | "failed";
}

export interface CreateCheckoutParams {
  amount: number;
  currency: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentProvider {
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutSession>;
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;
  verifyWebhook(payload: string, signature: string): Promise<boolean>;
}

export const createPaymentProvider = (): PaymentProvider => {
  return {
    createCheckout: async (_params) => ({ id: "mock-checkout" }),
    createPaymentIntent: async (params) => ({
      id: "mock-intent",
      amount: params.amount,
      status: "pending",
    }),
    verifyWebhook: async (_payload, _signature) => true,
  };
};
