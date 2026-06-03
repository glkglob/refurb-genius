/**
 * Server functions for project CRUD operations.
 *
 * @file src/serverFns/projects.ts
 *
 * This module provides the canonical protected `createProjectServerFn` used
 * by the New Project flow (`/projects/new`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (THE HARD REFRESH / DIRECT NAV BUG)
 * ─────────────────────────────────────────────────────────────────────────────
 * Before this file:
 *   • `src/hooks/useProjects.ts` `useCreateProject` mutation (and the legacy
 *     `projectStore.create` in `src/lib/projects.ts`) performed:
 *       const { user } = await supabase.auth.getUser();   // ← client memory only
 *       await supabase.from("projects").insert({ user_id: user.id, ... })
 *   • `supabase.auth.getUser()` on the browser client returns null after a
 *     hard refresh or direct URL paste because the in-memory session (populated
 *     by the React auth provider) has not been restored yet.
 *   • Result: "You must be signed in." errors even though the user *is*
 *     authenticated (cookies are present, sidebar shows the user, _authed
 *     beforeLoad would have passed).
 *
 * This serverFn fixes it by:
 *   1. Being a `createServerFn` → its `.handler()` ALWAYS executes on the
 *      Nitro server (even when invoked from hydrated client code).
 *   2. Calling `requireUser()` (from `./auth.ts`) which uses the *cookie*
 *      authenticated server Supabase client (`createSupabaseServerClient`).
 *   3. Performing the INSERT with the *server-validated* `user.id`.
 *   4. Using an explicit Zod validator so the contract is typed + runtime safe.
 *
 * Callers (React Query etc.) simply do:
 *   await createProjectServerFn({ data: newProjectInput })
 *
 * The returned value is a fully shaped `ProjectWithProgress` (same shape the
 * old client code returned) so the calling UI (projects.new.tsx) needs zero
 * changes.
 *
 * Future: other project mutations (update, delete, setStage) can be moved here
 * in the same pattern. The legacy `projectStore.create` and the duplicate
 * code in `useProjects.ts` (the fetch paths) can stay for reads/caching until
 * a fuller migration.
 *
 * USAGE RULES (same as auth.ts):
 *   - Never import browser Supabase clients (`@/services/supabase` etc.) here.
 *   - All server-only imports (supabase server, logger if added later) live
 *     inside the handler or are dynamic.
 *   - Import this from client code freely — only the declaration crosses the
 *     boundary; the handler body is stripped for the client bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Type-only imports are 100% safe and produce zero runtime code.
// They never pull browser Supabase clients or other client-only modules.
import type { NewProjectInput } from "@/lib/projects";

// Centralized server auth primitives (the single source of truth).
import { requireUser, createSupabaseServerClient } from "@/serverFns/auth";

// Pure mapper — safe to import at top level (only type imports inside it,
// no side-effects, no browser clients).
import { rowToProject } from "@/lib/mappers";

/**
 * Canonical lists duplicated here solely for Zod enum validation.
 *
 * We cannot `import { UK_REGIONS, PROPERTY_TYPES } from "@/lib/projects"` (or
 * from `@repo/core`) at runtime because that module transitively pulls the
 * browser Supabase client singleton (forbidden by the serverFn rules and
 * CLAUDE.md). Type-only imports of `UKRegion` / `PropertyType` *are* safe.
 *
 * Keeping the lists here is the pragmatic minimal approach for now; they are
 * the same values as the source of truth. If they ever diverge the worst case
 * is a slightly stricter/loser server validation (which is acceptable).
 */
const UK_REGIONS = [
  "London",
  "South East England",
  "South West England",
  "East of England",
  "East Midlands",
  "West Midlands",
  "North West England",
  "North East England",
  "Yorkshire and the Humber",
  "Scotland",
  "Wales",
  "Northern Ireland",
] as const;

const PROPERTY_TYPES = [
  "Flat",
  "Terraced",
  "Semi-detached",
  "Detached",
  "HMO",
  "Bungalow",
] as const;

/**
 * Zod schema for the New Project creation payload.
 *
 * Matches `NewProjectInput` from the domain plus sensible runtime constraints
 * (positive prices, reasonable ranges for beds/baths/size, required fields).
 * The client form already does similar validation, but the serverFn must never
 * trust the client.
 *
 * Notes:
 * - `notes` is optional on the wire (form can be empty) → defaults to "".
 * - All numeric fields arrive as numbers from the React caller (JSON serialised).
 */
const createProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  address: z.string().trim().min(1, "Address is required"),
  postcode: z.string().trim().min(1, "Postcode is required"),
  region: z.enum(UK_REGIONS),
  property_type: z.enum(PROPERTY_TYPES),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  size_sqm: z.number().positive().max(10000),
  purchase_price: z.number().positive(),
  estimated_gdv: z.number().positive(),
  notes: z.string().default(""),
});

/**
 * Creates a new refurbishment project owned by the authenticated user.
 *
 * This is the server-side replacement for the previous client-only
 * `projectStore.create` / inline supabase insert in `useCreateProject`.
 *
 * Security / correctness guarantees:
 * - `requireUser()` throws "You must be signed in." (matching the old error
 *   message) if the cookie session is invalid / missing. This is evaluated
 *   on the server using the real JWT from cookies.
 * - The `user_id` written to the row is **always** taken from the validated
 *   server session, never from the (potentially tampered) payload.
 * - RLS policies on the projects table (`auth.uid() = user_id`) will still
 *   hold as a second line of defence.
 *
 * @returns The created project with progress flags (shape identical to the
 *          previous client implementation so all callers continue to work).
 */
export const createProjectServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createProjectInputSchema.parse(input))
  .handler(async ({ data }) => {
    // This runs exclusively on the server (Nitro / Vercel function).
    // Cookies from the current HTTP request are available here.
    const user = await requireUser();

    // No generic needed on the wrapper (it always returns the Database-typed client).
    const supabase = await createSupabaseServerClient();

    const { data: row, error } = await supabase
      .from("projects")
      .insert({
        // CRITICAL: user_id comes from the *server-validated* session.
        // Any user_id the client might have tried to send is ignored.
        user_id: user.id,
        name: data.name,
        address: data.address,
        postcode: data.postcode,
        region: data.region,
        property_type: data.property_type,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        size_sqm: data.size_sqm,
        purchase_price: data.purchase_price,
        estimated_gdv: data.estimated_gdv,
        notes: data.notes,
        status: "Draft",
        // photos_done etc. default to false via DB schema
      })
      .select()
      .single();

    if (error) {
      // Keep error surface identical to the old client code for minimal
      // caller changes. Real observability (Sentry, logs) can be added here
      // later in the same way the old `captureApiError` did on the client.
      throw new Error(error.message);
    }

    // Return the exact same domain shape the React Query hook + UI expect.
    return rowToProject(row);
  });
