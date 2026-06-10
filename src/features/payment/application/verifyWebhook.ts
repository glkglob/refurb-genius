import type { WebhookVerificationInput } from "@/features/payment/domain";
import type { PaymentGateway } from "./ports";

export async function verifyWebhook(
  gateway: PaymentGateway,
  input: WebhookVerificationInput,
): Promise<boolean> {
  return gateway.verifyWebhook(input);
}
