import type {
  CheckoutRequest,
  CheckoutSessionResult,
  WebhookVerificationInput,
} from "@/features/payment/domain";

export interface PaymentGateway {
  createCheckout(input: CheckoutRequest): Promise<CheckoutSessionResult>;
  verifyWebhook(input: WebhookVerificationInput): Promise<boolean>;
}
