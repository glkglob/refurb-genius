# Trades Marketplace — Manual QA Checklist

## 1. Purpose

Verify the end-to-end Trades Marketplace flow works correctly across two distinct user roles before shipping or after any significant change to routes, services, or Supabase migrations.

---

## 2. Test Users Needed

| Role                         | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| **Client / Job Owner**       | Signed-in user who posts and manages trades jobs       |
| **Tradesperson / Non-Owner** | Signed-in user who browses jobs and registers interest |

Create both accounts via `/auth?mode=signup` on your local instance before starting.

---

## 3. Local Setup Steps

```bash
# Install dependencies
npm install

# Start local Supabase
supabase start

# Apply all migrations
supabase db reset

# Start the dev server
npm run dev
```

Confirm the app is running at `http://localhost:3000` (or the port shown in terminal).

---

## 4. Supabase Migration Check

Verify both tables exist in your local Supabase instance:

```sql
-- In Supabase Studio or psql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('trades_jobs', 'trades_job_interests');
```

Expected: both rows returned.

Check RLS is enabled:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('trades_jobs', 'trades_job_interests');
```

Expected: `rowsecurity = true` for both.

---

## 5. Manual Test Flows

### 5.1 Post a Job

**User:** Client / Job Owner

1. Sign in as the client user.
2. Navigate to `/trades/new` via the sidebar **Trades** link or directly.
3. Fill in all fields: title, address, postcode, property type, category, description, budget min/max, desired start date.
4. Submit the form.

**Expected:** Redirected to `/dashboard`. The new job appears in the **My Trades Jobs** table with status `posted`.

---

### 5.2 Browse Marketplace

**User:** Either (test signed-out too)

1. Navigate to `/trades`.
2. Confirm the job posted in 5.1 appears as a card.
3. Use the category filter — select the category used above.

**Expected:** Job card shows title, postcode, category, description snippet, budget range, and start date. Filter narrows results correctly. Jobs with status `draft` or `closed` do not appear.

---

### 5.3 View Job Detail

**User:** Either

1. On `/trades`, click **View Job** on the card posted in 5.1.
2. Confirm URL becomes `/trades/<jobId>`.

**Expected:** Full job detail page renders — title, address, postcode, property type, category, description, budget, start date, created date, status. No errors.

---

### 5.4 Register Interest

**User:** Tradesperson / Non-Owner

1. Sign in as the tradesperson user.
2. Navigate to `/trades/<jobId>` (the job posted by the client).
3. The **Register Interest** section should be visible (not the owner interest panel).
4. Enter a short message and submit.

**Expected:** Success state shown — "Interest registered" confirmation. Submit button disabled or form hidden after submission (no duplicate allowed).

**Unauthenticated guard:** Sign out, then visit `/trades/<jobId>` and click Register Interest. Expected: redirect to `/auth?mode=signup`.

---

### 5.5 Owner Accept / Reject Interest

**User:** Client / Job Owner

1. Sign in as the client user.
2. Navigate to `/trades/<jobId>` for the job you own.
3. The **Trade Interest** section should be visible (not the Register Interest form).
4. The interest submitted in 5.4 should appear with status `pending`.
5. Click **Accept** on the interest.

**Expected:** Status badge updates to `accepted` in place. Accept/Reject buttons disappear for that row.

6. Register a second interest as the tradesperson (use a second account if available), then return as the owner and click **Reject**.

**Expected:** Status badge updates to `rejected`.

---

### 5.6 Dashboard — My Trades Jobs

**User:** Client / Job Owner

1. Sign in as the client user.
2. Navigate to `/dashboard`.
3. Locate the **My Trades Jobs** section.

**Expected:** The job posted in 5.1 appears with title, postcode, category, status, created date, and budget range. **View**, **Edit**, and **Close** actions are present.

---

### 5.7 Dashboard — My Interests

**User:** Tradesperson / Non-Owner

1. Sign in as the tradesperson user.
2. Navigate to `/dashboard`.
3. Locate the **My Interests** section.

**Expected:** The interest registered in 5.4 appears with job title, postcode, category, interest status, created date, and message preview. **View Job** link navigates to `/trades/<jobId>`.

---

### 5.8 Edit Job

**User:** Client / Job Owner

1. Sign in as the client user.
2. On `/dashboard`, click **Edit** on the job row.
3. Confirm redirect to `/trades/<jobId>/edit`.
4. Change the title and submit.

**Expected:** Redirected to `/trades/<jobId>`. Updated title is shown.

**Access control:** Sign in as the tradesperson and visit `/trades/<jobId>/edit` directly. Expected: **Access denied** state (not the edit form).

**Unauthenticated guard:** Sign out and visit `/trades/<jobId>/edit`. Expected: **Sign in required** state.

---

### 5.9 Close Job

**User:** Client / Job Owner

1. Sign in as the client user.
2. On `/dashboard`, click **Close** on the job row.
3. Confirm the status updates to `closed` in the table.

**Expected:** Job status shows `closed` in the dashboard. The job no longer appears on the public `/trades` marketplace (verify by navigating to `/trades`).

---

## 6. Expected Results Summary

| Flow                     | Pass Condition                                             |
| ------------------------ | ---------------------------------------------------------- |
| Post job                 | Job appears in dashboard with status `posted`              |
| Browse marketplace       | Only `posted` jobs visible; filter works                   |
| View job detail          | All fields rendered; no errors                             |
| Register interest        | Success state shown; duplicates blocked; unauth redirected |
| Accept interest          | Badge updates to `accepted` in place                       |
| Reject interest          | Badge updates to `rejected` in place                       |
| Dashboard My Trades Jobs | Jobs listed; View/Edit/Close work                          |
| Dashboard My Interests   | Interests listed with job details; View Job works          |
| Edit job                 | Changes saved; non-owners and unauth users blocked         |
| Close job                | Status `closed`; job hidden from public marketplace        |

---

## 7. Common Failure Points

### Auth Hydration

**Symptom:** Edit page (`/trades/$jobId/edit`) briefly shows "Sign in required" then flashes to the form, or always shows "Sign in required" even when signed in.  
**Cause:** Auth state read synchronously before Supabase restores the session from storage.  
**Fix:** `useAuth()` with `hydrated` guard — the effect must wait for `hydrated === true` before checking `user`.

---

### RLS Errors

**Symptom:** Supabase returns a `42501` permission denied error, or data silently returns empty when it shouldn't.  
**Common causes:**

- User is not authenticated when the query runs (session not restored yet)
- `trades_job_interests` insert policy requires `auth.uid() = user_id` — confirm the row is being inserted with the correct `user_id`
- Job owner select policy on interests checks `job_id` foreign key to `trades_jobs.user_id` — confirm the migration applied correctly

**Debug:** Check the Supabase Studio **Logs → API** tab for the actual SQL error. Run the query manually in the SQL editor with `SET LOCAL role = authenticated; SET LOCAL request.jwt.claims = '{"sub":"<user-id>"}'`.

---

### routeTree Issues

**Symptom:** New route returns 404, or TypeScript errors about unknown route paths.  
**Cause:** `src/routeTree.gen.ts` is not updated when the Vite dev server is not running.  
**Fix:** Start `npm run dev` to trigger auto-generation, or manually add the route to all 8+ sections in `routeTree.gen.ts` (interfaces, union types, children wiring).

---

### Closed Jobs Still Appearing Publicly

**Symptom:** A job with status `closed` still shows on `/trades`.  
**Cause:** `listPostedTradesJobs()` in `tradesJobStore.ts` should filter `.eq("status", "posted")`. Check the query has not been altered.  
**Fix:** Confirm the filter is `.eq("status", "posted")` and not `.neq("status", "closed")` (the latter would include `draft` jobs).

---

## 8. Final Validation Commands

Run before merging or deploying:

```bash
# TypeScript — zero errors expected
npx tsc --noEmit 2>&1 | grep -v "projects\\.\\$id"

# Production build — must complete with exit code 0
npm run build
```

Both commands should exit cleanly with no errors or warnings related to the Trades feature.
