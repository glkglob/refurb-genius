/**
 * Server functions for the public gallery.
 *
 * Investor lead submission lives here so PII never passes through client-side
 * Supabase calls — all inserts run server-side with full validation.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@repo/supabase";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";

const OWNER_EMAIL = "kris.solo@rissololtd.co.uk";

const investorLeadSchema = z.object({
  gallery_project_id: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(50).nullable(),
  message: z.string().max(2000),
});

export const submitInvestorLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => investorLeadSchema.parse(input))
  .handler(async ({ data }) => {
    const { getCookies } = await import("@tanstack/react-start/server");
    const { createServerSupabase } = await import("@repo/supabase/server");

    // Use service-role-free server client (anon key + RLS).
    // The investor_leads table has an INSERT policy for anonymous users.
    const supabase = createServerSupabase<Database>(getCookies());

    const { error } = await supabase.from("investor_leads").insert({
      gallery_project_id: data.gallery_project_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: data.message,
    });

    if (error) {
      logger.error("[gallery] investor lead insert failed", { error: error.message });
      throw new Error("Failed to submit inquiry. Please try again later.");
    }

    logger.info("[gallery] investor lead submitted", {
      gallery_project_id: data.gallery_project_id,
    });

    // Fire-and-forget notification to owner — never block the user response
    sendEmail({
      to: OWNER_EMAIL,
      subject: `New investor enquiry${data.message ? `: ${data.message.slice(0, 60)}` : ""}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px;">
          <h2>New investor enquiry</h2>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 4px 8px; font-weight: bold;">Name</td><td style="padding: 4px 8px;">${data.name}</td></tr>
            <tr><td style="padding: 4px 8px; font-weight: bold;">Email</td><td style="padding: 4px 8px;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
            ${data.phone ? `<tr><td style="padding: 4px 8px; font-weight: bold;">Phone</td><td style="padding: 4px 8px;">${data.phone}</td></tr>` : ""}
            <tr><td style="padding: 4px 8px; font-weight: bold;">Message</td><td style="padding: 4px 8px;">${data.message}</td></tr>
          </table>
          <p style="margin-top: 16px; color: #666; font-size: 13px;">Gallery project ID: ${data.gallery_project_id}</p>
        </div>
      `,
      replyTo: data.email,
    }).catch((err) => {
      logger.warn("[gallery] investor lead email failed (non-blocking)", { error: String(err) });
    });
  });
