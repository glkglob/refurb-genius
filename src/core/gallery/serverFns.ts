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
  });
