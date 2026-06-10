import type { CheckoutRequest, CheckoutSessionResult } from "@/features/payment/domain";
import type { PaymentGateway } from "./ports";

export async function createCheckout(
  gateway: PaymentGateway,
  input: CheckoutRequest,
): Promise<CheckoutSessionResult> {
  return gateway.createCheckout(input);
}
