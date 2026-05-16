Wire a real AI redesign concept generator to replace the mock static concepts.

## Context

The redesign system uses a provider pattern identical to photo analysis.

Active provider is set in `src/core/ai/redesignConcepts.ts`:
```ts
export const redesignProvider: RedesignProvider = mockRedesignProvider;
```

The mock returns hardcoded entries from `src/lib/redesign.ts` (`REDESIGN_CONCEPTS` array).

The `RedesignConcept` type is in `src/lib/redesign.ts` — read it before starting.

## What to build

### Step 1 — Check env

Read `src/lib/ai-config.ts`. If `/wire-openai-vision` has not been run yet, create `src/lib/ai-config.ts` with:
- `isOpenAiConfigured(): boolean` — checks `import.meta.env.VITE_OPENAI_API_KEY`
- `getOpenAiApiKey(): string` — returns key or throws

### Step 2 — Build the real provider

In `src/core/ai/redesignConcepts.ts`, add:

```ts
export const openAiRedesignProvider: RedesignProvider
```

The `generate(input)` method must:
1. Call OpenAI `gpt-4o` (text only — no image generation needed) with a prompt that asks for 3 redesign concept objects matching `RedesignConcept` fields:
   - `id` (generate a slug, e.g. `"modern-minimal-1"`)
   - `style` (one of the `RedesignStyle` values from `src/lib/redesign.ts`)
   - `title` (e.g. "Modern Minimal")
   - `description` (2–3 sentences of design direction)
   - `palette` (array of 3–5 hex colour strings)
   - `materials` (array of 3–5 material/finish strings)
   - `afterGradient` — set to a CSS linear-gradient string using the palette colours (image generation is out of scope; this field holds the placeholder)
2. Return the parsed array of `RedesignConcept`

Include `roomType` and any style filter from `input` in the prompt so the concepts are contextually appropriate.

The `list()` method should fall back to the mock list — it is used synchronously on initial render and real generation is async.

### Step 3 — Activate

```ts
export const redesignProvider: RedesignProvider = isOpenAiConfigured()
  ? openAiRedesignProvider
  : mockRedesignProvider;
```

### Step 4 — Error handling

If the API call fails, throw a descriptive error. The calling component in `src/routes/projects.$id.analysis.tsx` has a try/catch — the error will surface there.

## Rules

- Do NOT add the `openai` npm package — use `fetch` directly
- Do NOT change any component or route files
- Only touch `src/core/ai/redesignConcepts.ts` and `src/lib/ai-config.ts`
- `RedesignConcept` is the source of truth — parse model output into it
- Run `npx tsc --noEmit` — must pass with zero errors
- Run `npm run format` before committing
- Commit: `feat: wire OpenAI text redesign concept generator`
