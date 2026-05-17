Add email notifications for Trades Marketplace events: new interest registered, interest accepted, interest rejected.

## Context

The Trades Marketplace stores data in three Supabase tables:

- `trades_jobs` — jobs posted by clients
- `trades_job_interests` — interests submitted by tradespeople
- `trade_profiles` — tradesperson profiles

Key service files:

- `src/services/trades/tradesJobInterestStore.ts` — `registerInterest()`, `updateInterestStatus()`
- `src/services/trades/tradesJobStore.ts` — `listPostedTradesJobs()`, `createTradesJob()`

The Supabase project is already connected (env vars in `.env`).

Email sending should use **Supabase Edge Functions** calling **Resend** (https://resend.com) — the recommended pattern for Supabase-hosted apps.

## What to build

### Step 1 — Supabase Edge Function

Create `supabase/functions/send-notification-email/index.ts`.

The function must:

1. Accept a POST request with JSON body:
   ```ts
   {
     type: "interest_registered" | "interest_accepted" | "interest_rejected"
     jobTitle: string
     jobOwnerEmail: string
     tradePersonEmail: string
     tradePersonName?: string
     message?: string        // interest message (for interest_registered)
   }
   ```
2. Use the Resend API to send the correct email:
   - `interest_registered` → email to job owner: "Someone has registered interest in your job: {jobTitle}"
   - `interest_accepted` → email to tradesperson: "Your interest in {jobTitle} has been accepted"
   - `interest_rejected` → email to tradesperson: "Your interest in {jobTitle} was not taken forward"
3. Use `RESEND_API_KEY` from `Deno.env.get("RESEND_API_KEY")` — never hardcode it
4. Send from `notifications@mg.refurbgenius.co.uk` (update if a different domain is configured)
5. Return `{ success: true }` or `{ error: message }` with appropriate HTTP status

Add `RESEND_API_KEY=` to `.env.example`.

### Step 2 — Call the function from the client

In `src/services/trades/tradesJobInterestStore.ts`:

After a successful `registerInterest()` call, invoke the edge function:

```ts
supabase.functions.invoke("send-notification-email", {
  body: {
    type: "interest_registered",
    jobTitle,
    jobOwnerEmail,
    tradePersonEmail,
    message,
  },
});
```

You will need to fetch the job owner's email. Query `trades_jobs` for the job, then query `auth.users` — but client code cannot query `auth.users` directly. Instead: add a `profiles` table query or use the job owner's `user_id` to look up a `profiles` table if one exists. If no profiles table exists, skip the owner email lookup for now and log a TODO comment.

After a successful `updateInterestStatus()` call (accept or reject), invoke similarly with the correct type and the tradesperson's email.

### Step 3 — Error handling

Edge function invocations must NOT block the UI. Fire-and-forget is acceptable — wrap in `try/catch` and log errors with `console.warn` but do not surface email failures to the user as blocking errors. The core interest action (register/accept/reject) should always complete regardless of email success.

### Step 4 — Local testing note

Add a comment at the top of the edge function explaining how to test locally:

```
# supabase functions serve send-notification-email --env-file .env
# Then POST to http://localhost:54321/functions/v1/send-notification-email
```

## Rules

- Only touch `src/services/trades/tradesJobInterestStore.ts` and the new edge function
- Do NOT change route or component files
- Do NOT add Resend as an npm package — call the REST API directly in the edge function via `fetch`
- Email failures must be non-blocking (fire-and-forget)
- Run `npx tsc --noEmit` on client files — must pass with zero errors
- Run `npm run format` before committing
- Commit: `feat: add email notifications for trades interest events via Supabase edge function`
