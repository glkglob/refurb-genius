# Data inventory

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**Current BASE SHA:** `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7`
**Verified:** 2026-08-20
**Scope:** Personal and user-generated data classes evidenced in repository source and migrations.
**Not:** a live Production dump, a DPIA, or a legal determination of lawful basis.

This file is an **addition** on current main. It conceptually reconciles the historical `78b3a64` data inventory; that file did not exist on BASE.

Third-party **transmission** is recorded only where source shows an outbound call or an explicit product statement. Adapter presence is not proof of live Production routing.

---

## 1. Controller-facing product copy (not independently verified)

The in-app privacy policy is a **product statement**, not engineering proof.

**VERIFIED REPOSITORY FACT.** Route `/privacy` exists (`src/routes/privacy.tsx`). “Last updated: June 2026”. Operator named as Rissolol Ltd. Contact `support@refurbgenius.co.uk`.
Evidence: git blob `src/routes/privacy.tsx` @ BASE SHA · verified 2026-08-20.

**LEGAL CONFIRMATION REQUIRED (AC1-F04).** The same page still contains placeholders: company number “[to be completed]”, registered office “[registered office address — to be completed]”, ICO registration “[to be completed]”.
Evidence: same file · verified 2026-08-20.

**LEGAL CONFIRMATION REQUIRED.** Lawful bases, international-transfer safeguards, PECR cookie consent, children’s age 18, and 30-day deletion SLA as written on `/privacy` require counsel review against current processing (including PostHog, Sentry Replay, Hugging Face adapter, Resend).

**WATCH ITEM.** Policy lists OpenAI and Supabase as named processors and groups hosting/error monitoring/product analytics as “Other Services” without naming PostHog, Sentry, Vercel, Resend, or Hugging Face.

**VERIFIED REPOSITORY FACT.** Product copy on `/privacy`, `/support`, and `/terms` uses `support@refurbgenius.co.uk`. No `support@refurbgenius.info` string appears under `src/` at this BASE.
Evidence: those route files @ BASE SHA · verified 2026-08-20.

**HISTORICAL FACT** @ `b599931` / `78b3a64`: `deleteAccountServerFn` unconfigured-server fallback told the user to email `support@refurbgenius.info`. That fallback string is **not** present in current `src/serverFns/auth.ts` (generic “temporarily unavailable” message). Do **not** treat that historical divergence as AC1-F12 (F12 is third-party AI sharing).

**PENDING VERIFICATION.** Whether `support@refurbgenius.co.uk` is an operational mailbox.

---

## 2. User / account data

| Data | Storage evidenced | Label |
| ---- | ----------------- | ----- |
| Email, auth user id | Supabase Auth (`auth.users`); mapped in app auth types | VERIFIED REPOSITORY FACT that auth user is used; live Auth schema is Supabase-hosted **PENDING VERIFICATION** of Production contents |
| Profile / role | `public.profiles` (`id` references `auth.users`) | VERIFIED REPOSITORY FACT |
| Default region preference | `localStorage` key `refurbgenius:default-region` | VERIFIED REPOSITORY FACT |

Evidence: `src/routes/_authed/settings.tsx` `DEFAULT_REGION_KEY` · database inventory @ BASE SHA · verified 2026-08-20.

---

## 3. Authentication / session identifiers

| Item | Web | Native |
| ---- | --- | ------ |
| Session cookie | `pip-auth` (documented cookie name) | Not the native session store |
| Native session | — | Keychain via `@aparajita/capacitor-secure-storage`, storage key `rg-native-auth` |
| OAuth callback | `/auth/callback`; custom scheme `com.refurbgenius.app://auth/callback` | ASWebAuthenticationSession returns callback URL string to JS |

**VERIFIED REPOSITORY FACT.** Native client: `persistSession: true`, storage key `rg-native-auth`.
Evidence: `src/platform/supabase/native.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Web serverFns document cookie name `pip-auth`.
Evidence: `AGENTS.md` · `packages/supabase/src/browser.ts` comment @ BASE SHA · verified 2026-08-20.

---

## 4. Project / property data

**VERIFIED REPOSITORY FACT.** `public.projects` includes `user_id` → `auth.users(id)` with own-row RLS. Related inventoried tables include estimates, redesign concepts, scope analyses, analysis jobs, floorplan tables, pitch-deck exports, photos.
Evidence: `tests/invariants/config/data/database-inventory.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Five-stage workflow Photos → Analysis → Redesign → Estimate → Export is locked IA-0 on this programme.
Evidence: `docs/architecture/overview.md` @ BASE SHA · verified 2026-08-20.

---

## 5. Uploaded photos

**VERIFIED REPOSITORY FACT.** Bytes are written to Storage bucket `project-photos` via `uploadProjectPhotos` / `removeProjectPhoto` in `src/lib/photos-write.ts`. Web uses pip-auth browser client; native uses `getNativeSupabase()`.
Evidence: `src/lib/photos-write.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Display uses short-lived signed URLs (900s). AI retrieval uses 300s signed URLs on the server.
Evidence: `SIGNED_URL_TTL_SECONDS` · `AI_SIGNED_URL_TTL_SECONDS` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Display mint (`src/features/ai-upload/presentation/projectPhotoDisplay.ts`) comments that it signs `storage_path` only and never treats `ProjectPhoto.url` as retrieval authority. Committed test asserts source does not log signed URLs or write localStorage/database.
Evidence: `projectPhotoDisplay.ts` · `projectPhotoDisplay.test.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** No `persistQueryClient` / query-persister API appears under `src/`.
Evidence: negative search `persistQueryClient` under `src/` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT (boundary).** React Query holds minted display URLs in memory (`PROJECT_PHOTO_DISPLAY_GC_TIME_MS` 5 minutes). That is session cache, not a durable public Storage link.

**PENDING VERIFICATION.** Exhaustive proof that no log sink, analytics property, or other write path persists a `createSignedUrl` result. TTL + the locators above do not prove global absence.

**VERIFIED REPOSITORY FACT.** Current upload writes `getPublicUrl` into `p_url` (`photos-write.ts`). That is a **public-URL constructor string**, not a signed URL, and is a separate data class from JIT signed retrieval.

**WATCH ITEM.** Privacy policy asks users not to upload photos identifying other people or special-category data. There is no technical filter evidenced in this pass.

---

## 6. AI / analysis-derived data (AC1-F12)

**VERIFIED REPOSITORY FACT.** Server analysis adapters send photo bytes/URLs to OpenAI when `OPENAI_API_KEY` is set. Native client does not call OpenAI directly; it calls `POST /api/mobile/v1/analysis/run`. Native redesign generate and scope analyze similarly use Bearer mobile API paths; OpenAI stays server-side.
Evidence: analysis/redesign/scope server adapters · `src/platform/http/mobile-api.server.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** A Hugging Face vision adapter exists server-side (`hf-vision.adapter.server.ts`).
Evidence: that file @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Which provider is used in Production for a given analysis, and whether image payloads leave the UK/EEA.

**VERIFIED REPOSITORY FACT.** In-app privacy policy states photos/prompts are sent to OpenAI and “We do not opt in to OpenAI model training.”
Evidence: `src/routes/privacy.tsx` @ BASE SHA · verified 2026-08-20.

**EXTERNAL FACT (AC1-F12).** App Review Guideline 5.1.2(i) requires that apps not use, transmit, or share someone’s personal data without permission; they must clearly disclose where personal data will be shared with third parties, **including with third-party AI**, and obtain explicit permission before doing so. The guideline is **not** described here as an on-device-only requirement.
Sources: https://developer.apple.com/app-store/review/guidelines/ · https://developer.apple.com/news/?id=ey6d8onl · verified 2026-08-20.

**LEGAL CONFIRMATION REQUIRED (AC1-F12).** Whether current disclosure and permission UX satisfies 5.1.2(i). This pack does **not** determine that every property image is personal data. The OpenAI training opt-out as written on `/privacy` also requires counsel review against current contractual terms.

---

## 7. Telemetry / analytics / diagnostics

| System | What source shows | Device vs server |
| ------ | ----------------- | ---------------- |
| PostHog | Feature usage, sanitized paths/URLs, optional exception capture; `localStorage+cookie` | JS in web/WKWebView when token present |
| Sentry | Exceptions, traces (0.2), session replay (0.05), `sendDefaultPii: false` | JS in web/WKWebView when DSN present; Node Sentry is server |

**WATCH ITEM (AC1-F08).** `/privacy` says non-essential cookies need consent. No consent banner/component was found under `src/` (oauth `/oauth/consent` is OAuth, not a cookie banner). If PostHog cookies are set without a consent gate, that is a **policy vs code** issue for legal review — not remediated here.

**PENDING VERIFICATION.** Approximate IP / device fields as described on `/privacy` versus actual PostHog/Sentry payloads after sanitizers.

**LEGAL CONFIRMATION REQUIRED.** Whether PostHog and Sentry Replay are “tracking” under Apple ATT / App Store nutrition labels.

---

## 8. Email

**VERIFIED REPOSITORY FACT.** Server-only Resend sends transactional email from `notifications@mail.refurbgenius.info`.
Evidence: git blob `src/lib/email.ts` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Full catalogue of email templates and whether magic-link / notifications include personal data beyond address.

---

## 9. Deletion and retention

Per-photo delete and account deletion current-main evidence live in [`06-account-deletion-evidence.md`](./06-account-deletion-evidence.md). Do not repeat the pre-#174 Storage-gap defect as current.

**VERIFIED REPOSITORY FACT.** Settings copy: “Permanently delete your account, all projects, properties, and analysis history.” Privacy Account Deletion lists profile/credentials, projects/properties/analysis history, uploaded photos and AI results, processed within 30 days.
Evidence: `src/routes/_authed/settings.tsx` · `src/routes/privacy.tsx` @ BASE SHA · verified 2026-08-20.

**LEGAL CONFIRMATION REQUIRED.** Operational logs “up to 12 months” and legal-hold language on `/privacy` are not evidenced as automated jobs in this pass.

---

## 10. Third-party transmission (supported vs not)

| Recipient | Supported by source? | What may be sent | Label |
| --------- | -------------------- | ---------------- | ----- |
| Supabase | Yes | Auth, DB rows, Storage objects, Realtime as used | VERIFIED REPOSITORY FACT of client/server SDK use |
| OpenAI | Yes, server adapters | Photos / prompts for analysis, redesign, estimates when key set | VERIFIED REPOSITORY FACT of code path; live Production routing PENDING VERIFICATION |
| Hugging Face | Server adapter present | Vision payloads **if** that adapter is selected | PENDING VERIFICATION of live use |
| PostHog | Yes, browser SDK | Events, sanitized URLs, exceptions (if token) | VERIFIED REPOSITORY FACT of code; token presence PENDING VERIFICATION |
| Sentry | Yes, browser + node | Errors, traces, replays (if DSN) | VERIFIED REPOSITORY FACT of code; DSN presence PENDING VERIFICATION |
| Resend | Yes, server email | Email address + message HTML | VERIFIED REPOSITORY FACT of wrapper |
| Vercel | Hosting/deploy | HTTP logs / hosting metadata typical of the platform | PENDING VERIFICATION of contract/subprocessor list |
| Apple | Sign-in JS / ASWebAuthenticationSession / Keychain | Auth URLs and Keychain items | PENDING VERIFICATION of exact Apple services used in Production |

Do **not** treat npm presence of `@huggingface/inference` or `openai` as proof that the **iOS binary** contains those SDKs. Do **not** infer App Privacy declarations from package names (AC1-F13; see [`08`](./08-app-privacy-declarations-worksheet.md)).

---

## 11. Client/native security boundary (data-relevant)

**VERIFIED REPOSITORY FACT.** Programme rule: never use service role in client or native-device code; native direct Supabase uses user JWT + RLS.
Evidence: `AGENTS.md` Critical Rules @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Invariant tests exist for `VITE_SUPABASE_SERVICE_ROLE_KEY` never referenced and server-only boundary.
Evidence: `package.json` script `security:boundary` · `tests/invariants/auth-env.invariant.test.ts` @ BASE SHA · verified 2026-08-20.

---

## 12. Generated types vs live schema (AC1-F14)

**VERIFIED REPOSITORY FACT.** Account-deletion metadata reads document that live Preview/Production ownership/path columns differ from generated `Database` types for some tables. Reads use a structural client so live column names are not forced through stale `user_id` typings. Current live columns used by the runner:

| Table | Path column | Owner column |
| ----- | ----------- | ------------ |
| `photos` | `storage_path` | `user_id` |
| `opportunity_photos` | `storage_path` | `user_id` |
| `floorplan_models` | `storage_path` | `uploaded_by` |
| `pitch_deck_exports` | `storage_path` | `created_by` |

Evidence: git blob `src/features/account-deletion/application/executeAccountDeletion.server.ts` @ BASE SHA · query: `MetadataSelectClient`, `selectOwnedColumn` · verified 2026-08-20.

**WATCH ITEM (AC1-F14).** This is generated-types / live-schema reconciliation drift. This pack **describes** it. This slice does **not** regenerate types or add a migration.

**EXTERNAL FACT.** Generated TypeScript types come from the target database schema.
Source: https://supabase.com/docs/guides/deployment/managing-environments · verified 2026-08-20.

---

## 13. Special category / children / location

**LEGAL CONFIRMATION REQUIRED.** `/privacy` states the service is not directed at under-18s and that photos must not contain special-category data. No age-gate implementation was inventoried in this pass.

**PENDING VERIFICATION.** Property address / postcode fields vs Apple “Precise Location” / “Physical Address” nutrition labels. Region multipliers use location **text** entered by the user, not Core Location (no location usage string in Info.plist).

**VERIFIED REPOSITORY FACT.** No `NSLocation*` keys in Info.plist.
Evidence: `ios/App/App/Info.plist` @ BASE SHA · verified 2026-08-20.
