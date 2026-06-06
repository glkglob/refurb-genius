<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Refurb Genius. Here is a summary of every change made:

**Client initialisation** — `PostHogProvider` from `@posthog/react` was added to `src/routes/__root.tsx`'s `RootShell` component, wrapping the entire application. This replaces the previous lazy-init approach inside `analytics.ts` and ensures PostHog is available to all components at startup. Exception capture (`capture_exceptions: true`) is also enabled.

**Server client** — A singleton `posthog-node` client was created at `src/lib/posthog-server.ts` for use in server functions that need to capture server-side events.

**Analytics wrapper updated** — `src/lib/analytics.ts` was updated to use the canonical `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` environment variable, and the manual `posthog.init()` call was removed (PostHogProvider handles it). Nine new event names were added to the `AnalyticsEventName` type.

**Environment** — `.env` was confirmed to contain `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST`.

**New packages installed** — `@posthog/react`, `posthog-node`, `@posthog/ai`, `@opentelemetry/sdk-node`, `@opentelemetry/resources`, and `@opentelemetry/instrumentation-openai`.

## Events added

| Event                        | Description                                                                 | File                                           |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| `user_signed_in`             | User successfully signs in with email/password                              | `src/routes/auth.tsx`                          |
| `signup_completed`           | User creates a new account (email flow); also calls `identifyAnalyticsUser` | `src/routes/auth.tsx`                          |
| `oauth_sign_in_initiated`    | User initiates Google OAuth sign-in flow                                    | `src/routes/auth.tsx`                          |
| `project_created`            | User successfully creates a new refurbishment project                       | `src/routes/_authed/projects.new.tsx`          |
| `photos_uploaded`            | Photos uploaded to a project (includes `photo_count`)                       | `src/routes/_authed/projects.$id.upload.tsx`   |
| `ai_analysis_started`        | User clicks Run AI Analysis                                                 | `src/routes/_authed/projects.$id.upload.tsx`   |
| `ai_analysis_completed`      | AI photo analysis returns results (includes `room_count`)                   | `src/routes/_authed/projects.$id.analysis.tsx` |
| `estimate_viewed`            | User reaches the cost estimate page — top of estimate funnel                | `src/routes/_authed/projects.$id.estimate.tsx` |
| `trades_job_posted`          | User posts a new job to the trades marketplace (includes `job_category`)    | `src/routes/_authed/trades_.new.tsx`           |
| `marketplace_listing_viewed` | User opens the trades marketplace — top of trades funnel                    | `src/routes/_authed/marketplace.tsx`           |

_Pre-existing events already in the codebase: `deal_analyzed`, `report_exported`, `session_abandoned`, `roi_viewed`, `pricing_band_selected`, `onboarding_started`, `onboarding_completed`._

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- 📊 **Dashboard** — [Analytics basics (wizard)](https://us.posthog.com/project/456912/dashboard/1677691)
- 🔀 **Project pipeline funnel** — [Ss6GJawz](https://us.posthog.com/project/456912/insights/Ss6GJawz) — conversion from project creation → photos → AI analysis → estimate → report
- 📈 **User acquisition** — [5J46VebC](https://us.posthog.com/project/456912/insights/5J46VebC) — sign-ins and sign-ups over time
- 🤖 **AI analysis completions** — [Jya0KC77](https://us.posthog.com/project/456912/insights/Jya0KC77) — daily AI analysis volume
- 🔨 **Trades jobs posted** — [7tvan7e3](https://us.posthog.com/project/456912/insights/7tvan7e3) — marketplace supply activity
- 🏪 **Trades marketplace funnel** — [woEf4I8N](https://us.posthog.com/project/456912/insights/woEf4I8N) — conversion from marketplace browse to job post

## LLM analytics (added)

Every OpenAI call made by Refurb Genius (photo vision analysis, scope analysis, cost estimation, and redesign generation) is now automatically observed by PostHog.

**How it works** — `src/lib/posthog-otel.ts` initialises a `NodeSDK` with the `PostHogSpanProcessor` from `@posthog/ai/otel` and the `OpenAIInstrumentation` from `@opentelemetry/instrumentation-openai`. The SDK starts once when the server module loads (imported as the very first line of `src/server.ts`). The OTel instrumentation monkey-patches the `openai` package so every `chat.completions.create` call is captured as a `$ai_generation` event in PostHog with model name, token counts, latency, and cost automatically populated.

**Files changed for LLM analytics:**

| File                      | Change                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| `src/lib/posthog-otel.ts` | New — OTel SDK init with `PostHogSpanProcessor` + `OpenAIInstrumentation` |
| `src/server.ts`           | Added `import "./lib/posthog-otel"` as first import                       |

**Where to view AI traces** — open [PostHog AI Observability](https://us.posthog.com/project/456912/ai-observability/generations) to see live `$ai_generation` events once the app handles a request that calls OpenAI.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-tanstack-start/` and `.claude/skills/llm-analytics-setup/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
