# Data inventory

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**BASE SHA:** `b5999318375d087c1469dd7f1f0b6e1bfcdc0588`
**Verified:** 2026-08-19
**Scope:** Personal and user-generated data classes evidenced in repository source and migrations.
**Not:** a live Production dump, a DPIA, or a legal determination of lawful basis.

Third-party **transmission** is recorded only where source shows an outbound call or an explicit product statement. Adapter presence is not proof of live Production routing.

---

## 1. Controller-facing product copy (not independently verified)

The in-app privacy policy is a **product statement**, not engineering proof.

**VERIFIED FACT.** Route `/privacy` exists (`src/routes/privacy.tsx`). “Last updated: June 2026”. Operator named as Rissolol Ltd. Contact `support@refurbgenius.co.uk`.
Evidence: git blob `src/routes/privacy.tsx` @ BASE SHA · verified 2026-08-19.

**LEGAL CONFIRMATION REQUIRED.** The same page still contains placeholders: company number “[to be completed]”, registered office “[registered office address — to be completed]”, ICO registration “[to be completed]”.
Evidence: same file · verified 2026-08-19.

**LEGAL CONFIRMATION REQUIRED.** Lawful bases, international-transfer safeguards, PECR cookie consent, children’s age 18, and 30-day deletion SLA as written on `/privacy` require counsel review against current processing (including PostHog, Sentry Replay, Hugging Face adapter, Resend).

**WATCH ITEM.** Policy lists OpenAI and Supabase as named processors and groups hosting/error monitoring/product analytics as “Other Services” without naming PostHog, Sentry, Vercel, Resend, or Hugging Face.

---

## 2. User / account data

| Data | Storage evidenced | Label |
| ---- | ----------------- | ----- |
| Email, auth user id | Supabase Auth (`auth.users`); mapped in app auth types | VERIFIED FACT that auth user is used; live Auth schema is Supabase-hosted **PENDING VERIFICATION** of Production contents |
| Profile / role | `public.profiles` (`id` references `auth.users`) | VERIFIED FACT |
| Full name in UI | Settings form state; persistence of name to `profiles` **not verified in this pass** | PENDING VERIFICATION |
| Default region preference | `localStorage` key `refurbgenius:default-region` | VERIFIED FACT |

Evidence: `supabase/migrations/20260508155054_53140776-1cf3-48c6-b05a-c2238aa4068d.sql` `profiles` · `src/routes/_authed/settings.tsx` `DEFAULT_REGION_KEY` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Programme inventory lists `profiles` as own-row RLS.
Evidence: `tests/invariants/config/data/database-inventory.ts` @ BASE SHA · verified 2026-08-19.

---

## 3. Authentication / session identifiers

| Item | Web | Native |
| ---- | --- | ------ |
| Session cookie | `pip-auth` (documented cookie name) | Not the native session store |
| Native session / PKCE | — | Keychain via `@aparajita/capacitor-secure-storage`, storage key `rg-native-auth` |
| OAuth callback | `/auth/callback`; custom scheme `com.refurbgenius.app://auth/callback` | ASWebAuthenticationSession returns callback URL string to JS |

**VERIFIED FACT.** Native client: `persistSession: true`, Keychain adapter, storage key `rg-native-auth`.
Evidence: `src/platform/supabase/native.ts` · `src/platform/auth/native/pkce-storage.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Web serverFns document cookie name `pip-auth`.
Evidence: `AGENTS.md` Critical Rules · `packages/supabase/src/browser.ts` comment @ BASE SHA · verified 2026-08-19.

**WATCH ITEM.** `pkce-storage.ts` header comment still says “code-verifier persistence only in 2B-2 (no session exchange)” while `getNativeSupabase()` sets `persistSession: true`. Treat the comment as stale relative to the client options.

**VERIFIED FACT.** Sentry Replay bootstrap strips auth-callback query secrets before init (`prepareAuthCallbackLocationForReplay`).
Evidence: `src/lib/sentry.ts` · `src/platform/sentry/replay-privacy.ts` @ BASE SHA · verified 2026-08-19.

---

## 4. Project / property data

**VERIFIED FACT.** `public.projects` includes `user_id` → `auth.users(id) ON DELETE CASCADE`, plus workflow flags (`analysis_done`, etc.) in the original migration. Later IA migrations add provenance/stage columns (not re-listed here). RLS: own rows (`auth.uid() = user_id`).
Evidence: migration `20260508155054_53140776-1cf3-48c6-b05a-c2238aa4068d.sql` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Privacy policy copy lists address, condition, budgets, deal metrics, notes as collected project data. Those fields exist across projects / estimates / deal-copilot tables in the database inventory; mapping each UI field to a column is **not** fully enumerated in this pack.
Evidence: `src/routes/privacy.tsx` · `tests/invariants/config/data/database-inventory.ts` @ BASE SHA · verified 2026-08-19.

Related inventoried tables (names only, from invariant config): `estimates`, `estimate_items`, `estimate_rooms`, `redesign_concepts`, `scope_analyses` (+ issues/items/rooms), `analysis_jobs`, `floorplan_*`, `feasibility_studies`, `deal_opportunities`, `share_links`, `public_gallery_projects`, `trades_*`, `pitch_deck_exports`, `project_export_snapshots`.
Evidence: `tests/invariants/config/data/database-inventory.ts` @ BASE SHA · verified 2026-08-19.

---

## 5. Uploaded photos

**VERIFIED FACT.** Metadata table `public.photos`: `id`, `project_id` → `projects(id) ON DELETE CASCADE`, `user_id` → `auth.users(id) ON DELETE CASCADE`, `storage_path`, `url`, `name`, `size`, `uploaded_at`. RLS enabled, own-row policy in original migration.
Evidence: same initial migration @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Bytes are written to Storage bucket `project-photos` via `uploadProjectPhotos` / `removeProjectPhoto` in `src/lib/photos-write.ts`. Web uses pip-auth browser client; native uses `getNativeSupabase()`.
Evidence: `src/lib/photos-write.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Latest committed migration sets `project-photos` `public = false`. Display uses short-lived signed URLs (900s). AI retrieval uses 300s signed URLs on the server.
Evidence: `20260816155524_project_photos_private.sql` · `SIGNED_URL_TTL_SECONDS` · `AI_SIGNED_URL_TTL_SECONDS` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Photo delete authority is RPC `delete_project_photo_metadata` then Storage removal from the deleted row path — not a client `from("photos")` pairing check.
Evidence: `src/lib/photos-write.ts` `removeProjectPhoto` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** `photos.url` column exists historically; current private-bucket design uses signed retrieval rather than durable public URLs. Whether old `url` values persist in rows is **PENDING VERIFICATION**.

**VERIFIED FACT.** Public **gallery** images use a separate `gallery` bucket inventoried as public-read. That is not the authenticated project-photo bucket.
Evidence: `tests/invariants/config/data/storage.ts` @ BASE SHA · verified 2026-08-19.

**WATCH ITEM.** Privacy policy asks users not to upload photos identifying other people or special-category data. There is no technical filter evidenced in this pass.

---

## 6. AI / analysis-derived data

**VERIFIED FACT.** `public.room_analyses` stores per-photo analysis fields including `room_type`, `condition_level`, `refurbishment_level`, `visible_issues`, `recommended_works`, `ai_summary`, `confidence_score`, `photo_url`, `photo_name`. `photo_id` references `photos(id) ON DELETE SET NULL`. RLS enabled. Publish RPC `replace_project_room_analyses` is evidenced in tests as `SECURITY INVOKER`.
Evidence: `supabase/migrations/20260523000000_room_analyses.sql` · `supabase/tests/database/room_analysis_text_array_persistence.test.sql` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Inventory also names `photo_analysis_results` (enforcement “partial”).
Evidence: `tests/invariants/config/data/database-inventory.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Server analysis adapters send photo bytes/URLs to OpenAI when `OPENAI_API_KEY` is set (`ai-vision.adapter.server.ts` and related). Native client does not call OpenAI directly; it calls `POST /api/mobile/v1/analysis/run`.
Evidence: those server files · `photo-analysis.provider.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** A Hugging Face vision adapter exists server-side.
Evidence: `src/features/ai-upload/infrastructure/adapters/hf-vision.adapter.server.ts` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Which provider is used in Production for a given analysis, and whether image payloads leave the UK/EEA.

**VERIFIED FACT.** In-app privacy policy states photos/prompts are sent to OpenAI and “We do not opt in to OpenAI model training.”
Evidence: `src/routes/privacy.tsx` @ BASE SHA · verified 2026-08-19.
**LEGAL CONFIRMATION REQUIRED.** That training opt-out against OpenAI’s current contractual terms.

---

## 7. Redesign / estimate / workflow data

**VERIFIED FACT.** Redesign concepts table `public.redesign_concepts` (`style`, `payload jsonb`, `user_id` / `project_id` cascade). Native generate path: `POST /api/mobile/v1/redesign/generate` (server-side AI).
Evidence: initial migration · `src/features/ai-design/presentation/generateRedesignConceptsForClient.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Estimates and line items are tenant-scoped with additional **pricing authority** RPC write constraints (inventory `rlsSummary`).
Evidence: `tests/invariants/config/data/database-inventory.ts` `estimates` / `estimate_items` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Five-stage workflow Photos → Analysis → Redesign → Estimate → Export is locked IA-0 on this programme.
Evidence: `docs/architecture/overview.md` @ BASE SHA · verified 2026-08-19.

---

## 8. Telemetry / analytics / diagnostics

| System | What source shows | Device vs server |
| ------ | ----------------- | ---------------- |
| PostHog | Feature usage, sanitized paths/URLs, optional exception capture; `localStorage+cookie` | JS in web/WKWebView when token present |
| Sentry | Exceptions, traces (0.2), session replay (0.05 / 1.0 on error), `sendDefaultPii: false` | JS in web/WKWebView when PROD + DSN; Node Sentry is server |
| Logger | Application logs (`src/lib/logger.ts` usage) | Runtime; destination **PENDING VERIFICATION** |

**VERIFIED FACT.** PostHog browser init as in `04-sdk-and-permissions-inventory.md` §4.1.
**VERIFIED FACT.** Sentry browser init as in §4.2 of that document.

**WATCH ITEM.** `/privacy` says non-essential cookies need consent. No consent banner/component was found under `src/` (oauth `/oauth/consent` is OAuth, not a cookie banner). If PostHog cookies are set without a consent gate, that is a **policy vs code** issue for legal review — not remediated here.

**PENDING VERIFICATION.** Approximate IP / device fields as described on `/privacy` versus actual PostHog/Sentry payloads after sanitizers.

**LEGAL CONFIRMATION REQUIRED.** Whether PostHog and Sentry Replay are “tracking” under Apple ATT / App Store nutrition labels.

---

## 9. Email

**VERIFIED FACT.** Server-only Resend sends transactional email from `notifications@mail.refurbgenius.info`.
Evidence: `src/lib/email.ts` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Full catalogue of email templates and whether magic-link / notifications include personal data beyond address.

---

## 10. Deletion and retention

### 10.1 Per-photo delete

**VERIFIED FACT.** `removeProjectPhoto({ photoId })` calls `delete_project_photo_metadata` then deletes Storage at the path returned from the deleted row.
Evidence: `src/lib/photos-write.ts` @ BASE SHA · verified 2026-08-19.

### 10.2 Account deletion (code)

**VERIFIED FACT.** `deleteAccountServerFn`:

1. `requireUser()` (cookie server session);
2. requires `SUPABASE_SERVICE_ROLE_KEY` and a Supabase URL on the **server**;
3. `admin.from("profiles").delete().eq("id", user.id)`;
4. `admin.auth.admin.deleteUser(user.id)`.

If service role/URL missing, it instructs emailing `support@refurbgenius.info` for deletion within 7 business days.
Evidence: `src/serverFns/auth.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** `photos.user_id` and `projects.user_id` are `ON DELETE CASCADE` from `auth.users`. Several other user-owned tables in later migrations also cascade.
Evidence: cited migrations @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Whether deleting `auth.users` removes **Storage objects** in `project-photos` / `floorplans` / `pitch-decks`. The delete function does not call Storage remove. Cascade of **rows** is not evidence of object cleanup.

**WATCH ITEM.** Settings copy: “Permanently delete your account, all projects, properties, and analysis history.” Privacy copy also lists uploaded photos and AI results, 30-day processing. Code path above is narrower than a full Storage sweep.

**PENDING VERIFICATION.** Native Settings deletion (cookie serverFn vs native session).

### 10.3 Retention periods

**LEGAL CONFIRMATION REQUIRED.** Operational logs “up to 12 months” and legal-hold language on `/privacy` are not evidenced as automated jobs in this pass.

---

## 11. Third-party transmission (supported vs not)

| Recipient | Supported by source? | What may be sent | Label |
| --------- | -------------------- | ---------------- | ----- |
| Supabase | Yes | Auth, DB rows, Storage objects, Realtime as used | VERIFIED FACT of client/server SDK use |
| OpenAI | Yes, server adapters | Photos / prompts for analysis, redesign, estimates, deal-copilot when key set | VERIFIED FACT of code path; live Production routing PENDING VERIFICATION |
| Hugging Face | Server adapter present | Vision payloads **if** that adapter is selected | PENDING VERIFICATION of live use |
| PostHog | Yes, browser SDK | Events, sanitized URLs, exceptions (if token) | VERIFIED FACT of code; token presence PENDING VERIFICATION |
| Sentry | Yes, browser + node | Errors, traces, replays (if DSN / PROD) | VERIFIED FACT of code; DSN presence PENDING VERIFICATION |
| Resend | Yes, server email | Email address + message HTML | VERIFIED FACT of wrapper |
| Vercel | Hosting/deploy | HTTP logs / hosting metadata typical of the platform | PENDING VERIFICATION of contract/subprocessor list |
| Apple | Sign-in JS / ASWebAuthenticationSession / Keychain | Auth URLs and Keychain items | PENDING VERIFICATION of exact Apple services used in Production |
| Capacitor/Ionic | Native runtime | Not a customer-data processor by itself | N/A |

Do **not** treat npm presence of `@huggingface/inference` or `openai` as proof that the **iOS binary** contains those SDKs.

---

## 12. Client/native security boundary (data-relevant)

**VERIFIED FACT.** Programme rule: never use service role in client or native-device code; native direct Supabase uses user JWT + RLS.
Evidence: `AGENTS.md` Critical Rules item 3 @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Invariant tests exist for `VITE_SUPABASE_SERVICE_ROLE_KEY` never referenced and server-only boundary.
Evidence: `package.json` script `security:boundary` · `tests/invariants/auth-env.invariant.test.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Display/AI signed URLs have TTLs (900s / 300s). This pack does not find a feature that persists those signed URLs as durable public links.
Evidence: TTL constants @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Historical `photos.url` column contents in Production.

---

## 13. Special category / children / location

**LEGAL CONFIRMATION REQUIRED.** `/privacy` states the service is not directed at under-18s and that photos must not contain special-category data. No age-gate implementation was inventoried in this pass.

**PENDING VERIFICATION.** Property address / postcode fields vs Apple “Precise Location” / “Physical Address” nutrition labels. Region multipliers use location **text** entered by the user (privacy copy), not Core Location (no location usage string in Info.plist).

**VERIFIED FACT.** No `NSLocation*` keys in Info.plist.
Evidence: `ios/App/App/Info.plist` @ BASE SHA · verified 2026-08-19.
