/**
 * Thin Resend wrapper for server-side transactional email.
 * Import only in server functions (createServerFn handlers) — never in client code.
 */

const FROM = "Refurb Genius <notifications@mail.refurbgenius.info>";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
