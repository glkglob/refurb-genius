// Supabase Edge Function: send-notification-email
//
// Sends transactional emails for Trades Marketplace events using Resend.
// Deploy with: supabase functions deploy send-notification-email
//
// Local testing:
//   1. supabase functions serve send-notification-email --env-file .env
//   2. Then POST to http://localhost:54321/functions/v1/send-notification-email
//
// Important: Make sure RESEND_API_KEY, SUPABASE_URL, and SUPABASE_ANON_KEY
// are present in your .env file when testing locally.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const FROM_EMAIL = "notifications@mg.refurbgenius.info"; // Update when domain is verified in Resend

type NotificationType = "interest_registered" | "interest_accepted" | "interest_rejected";

interface NotificationPayload {
  type: NotificationType;
  jobId: string;
  jobTitle?: string;
  interestUserId?: string; // tradesperson who registered interest
  message?: string; // only for interest_registered
}

interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

// ============================================
// Basic Rate Limiting (In-memory - for demo / low traffic)
// For production, replace with Supabase table + Edge Config or Upstash.
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxRequests = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// ============================================

Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing required environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: NotificationPayload = await req.json();

    // Basic validation
    if (!payload.type || !payload.jobId) {
      return new Response(JSON.stringify({ error: "Missing required fields: type, jobId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create Supabase client authenticated as the caller
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader ?? "" },
      },
    });

    // Get the current user (for audit / rate limiting in future)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Basic rate limiting per user
    if (!checkRateLimit(user.id)) {
      console.warn("[send-notification-email] Rate limit exceeded for user:", user.id);
      return new Response(JSON.stringify({ success: true, warning: "Rate limited" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from("trades_jobs")
      .select("id, title, user_id")
      .eq("id", payload.jobId)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", payload.jobId);
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const jobTitle = payload.jobTitle ?? job.title;

    // Resolve recipient and build email based on type
    let email: EmailPayload | null = null;

    if (payload.type === "interest_registered") {
      // Notify the job owner
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", job.user_id)
        .single();

      if (!ownerProfile?.email) {
        console.warn("No email found for job owner:", job.user_id);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      const tradespersonName = payload.message ? "A tradesperson" : "Someone";

      email = {
        from: FROM_EMAIL,
        to: ownerProfile.email,
        subject: `New interest in your job: ${jobTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px;">
            <h2>New interest registered</h2>
            <p><strong>${tradespersonName}</strong> has registered interest in your job:</p>
            <p><strong>${jobTitle}</strong></p>
            ${payload.message ? `<p><strong>Message:</strong> ${payload.message}</p>` : ""}
            <p>Log in to your account to review and respond.</p>
          </div>
        `,
      };
    } else if (payload.type === "interest_accepted" || payload.type === "interest_rejected") {
      // Notify the tradesperson who expressed interest
      if (!payload.interestUserId) {
        return new Response(
          JSON.stringify({ error: "interestUserId is required for this notification type" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const { data: tradespersonProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", payload.interestUserId)
        .single();

      if (!tradespersonProfile?.email) {
        console.warn("No email found for tradesperson:", payload.interestUserId);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      const isAccepted = payload.type === "interest_accepted";
      const statusText = isAccepted ? "accepted" : "not taken forward";
      const subject = isAccepted
        ? `Your interest in "${jobTitle}" has been accepted`
        : `Update on your interest in "${jobTitle}"`;

      email = {
        from: FROM_EMAIL,
        to: tradespersonProfile.email,
        subject,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px;">
            <h2>Interest ${statusText}</h2>
            <p>Your interest in the job <strong>${jobTitle}</strong> has been <strong>${statusText}</strong>.</p>
            ${isAccepted ? `<p>The job owner will be in touch with next steps.</p>` : ""}
          </div>
        `,
      };
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "Unsupported notification type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send via Resend REST API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(email),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("[send-notification-email] Resend failed:", {
        status: resendResponse.status,
        error: errorText,
        type: payload.type,
        jobId: payload.jobId,
      });
      // Still return success to caller — we don't want to break the UX
      return new Response(JSON.stringify({ success: true, warning: "Email delivery failed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error in send-notification-email:", err);
    // Return 200 so we never break the client action
    return new Response(JSON.stringify({ success: true, warning: "Email failed silently" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
