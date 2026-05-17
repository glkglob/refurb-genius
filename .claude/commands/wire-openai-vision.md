Wire the OpenAI Vision photo analysis provider so the app uses real AI instead of mock data.

## Context

The photo analysis system uses a provider pattern. The active provider is set in one place:

`src/core/ai/photoAnalysis.ts` — last line sets `export const photoAnalysisProvider = mockPhotoAnalysisProvider`

The mock provider wraps `src/lib/analysis.ts` which returns hardcoded room analyses.

The real provider needs to:

1. Read uploaded photos for the project from Supabase Storage via `photoStore.list(projectId)` in `src/core/projects`
2. Download each photo as a base64 data URL (or pass the public URL directly)
3. Call the OpenAI Vision API (`gpt-4o`) with the image and a structured prompt
4. Parse the response into the `RoomAnalysis[]` type from `src/lib/analysis.ts`

## What to build

### Step 1 — Check environment

Read `src/lib/supabase-config.ts` to understand the env-check pattern. Add a similar helper for OpenAI:

In `src/lib/ai-config.ts` (create it):

- Export `isOpenAiConfigured(): boolean` that checks `import.meta.env.VITE_OPENAI_API_KEY`
- Export `getOpenAiApiKey(): string` that returns the key or throws a clear setup error

Add `VITE_OPENAI_API_KEY=` to `.env.example`.

### Step 2 — Build the real provider

In `src/core/ai/photoAnalysis.ts`, add a new exported provider alongside the existing mock:

```ts
export const openAiVisionPhotoAnalysisProvider: PhotoAnalysisProvider;
```

It must:

- In `get(projectId)` — return `analysisStore.get(projectId)` (same cache)
- In `run({ projectId })`:
  1. Call `photoStore.list(projectId)` to get uploaded photos
  2. If no photos, return `[]`
  3. For each photo, call OpenAI Vision with a prompt that asks for:
     - `room_type` (Kitchen, Bathroom, Bedroom, Living Room, Hallway, Exterior, Other)
     - `condition` (Modern, Average, Dated, Poor, Full Renovation Needed)
     - `refurb_level` (Cosmetic, Light, Medium, Heavy, Full)
     - `issues` — string array of visible problems
     - `recommended_works` — string array of work items
     - `ai_summary` — 1–2 sentence description
  4. Parse the JSON response into `RoomAnalysis` objects (use `src/lib/analysis.ts` types)
  5. Cache results via `analysisStore.set(projectId, results)` (check if this method exists or add it)
  6. Return the results
- In `subscribe(fn)` — delegate to `analysisStore.subscribe(fn)`

Use `fetch` directly (no extra SDK package needed for a simple Vision call):

```
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer ${getOpenAiApiKey()}
Content-Type: application/json
```

### Step 3 — Activate the provider

At the bottom of `src/core/ai/photoAnalysis.ts`, change the active provider:

```ts
export const photoAnalysisProvider: PhotoAnalysisProvider = isOpenAiConfigured()
  ? openAiVisionPhotoAnalysisProvider
  : mockPhotoAnalysisProvider;
```

This means the app uses real Vision when the key is present and falls back to mock when it is not.

### Step 4 — Error handling

If the OpenAI call fails (network error, rate limit, invalid key), the provider must throw a descriptive `Error` so the UI's existing error state in `src/routes/projects.$id.analysis.tsx` can catch and display it.

## Rules

- Do NOT add the `openai` npm package — use `fetch` directly
- Do NOT change any component or route files — only `src/core/ai/photoAnalysis.ts` and new supporting files
- Do NOT put the API key in source code — only via env var
- The `RoomAnalysis` type is the source of truth — parse OpenAI output into it, never change the type to match the model
- Run `npx tsc --noEmit` after changes — must pass with zero errors
- Run `npm run format` before committing
- Commit on the current branch with message: `feat: wire OpenAI Vision photo analysis provider`
