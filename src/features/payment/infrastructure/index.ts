import { createPaymentProvider } from "@/platform/payments";
import type { PaymentGateway } from "@/features/payment/application";

export function createPaymentGateway(): PaymentGateway {
  const provider = createPaymentProvider();
  return {
    createCheckout: provider.createCheckout,
    verifyWebhook: async ({ payload, signature }) => provider.verifyWebhook(payload, signature),
  };
}
