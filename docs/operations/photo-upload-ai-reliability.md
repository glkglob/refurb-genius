# Photo upload & AI reliability improvements

Implementation of the phased reliability plan for project photo upload and vision analysis.

## Phase 1 — Reliable upload

| Change | Location |
| --- | --- |
| Canonical max size `MAX_PHOTO_BYTES` (10MB) + batch cap | `src/lib/photos-write.ts` |
| Stage-aware user error copy | `src/lib/upload-errors.ts` |
| Per-file progress + partial success + retry on upload page | `src/routes/_authed/projects.$id.upload.tsx` |
| Upload readiness probe (auth + storage list) | `src/lib/upload-health.ts` |
| Bulk uploader uses same error copy + retry | `src/components/BulkPhotoUpload.tsx` |

## Phase 2 — Observability

| Change | Location |
| --- | --- |
| Events: `upload_started`, `upload_failed`, `upload_partial_success`, `analysis_fallback`, `analysis_retry`, `estimate_generated` | `src/lib/analytics.ts` |
| Structured start/success/failure logs with projectId, size, stage | `src/lib/photos-write.ts` |
| Hook-level event emission | `useUploadPhotos` |

**Deferred:** full signed-upload migration (client still uses direct Supabase Storage + RLS). Prefer signed URLs if Vercel-side body limits become an issue; current path avoids proxying file bytes through the app server.

## Phase 3 — AI reliability

| Change | Location |
| --- | --- |
| Vision concurrency capped at 3 (OpenAI + HuggingFace) | `ai-vision.adapter.server.ts`, `hf-vision.adapter.server.ts` |
| Existing per-photo retry (`withRetry`) + fallback preserved | vision adapters |
| Re-analyse weak photos control | analysis page |
| Domain status helpers (`photoAiStatus`, `isRetryableAnalysis`) | `domain/rules.ts` |

## Phase 4 — AI quality

| Change | Location |
| --- | --- |
| Group analyses by room before display / estimate | `groupAnalysesByRoom` + analysis page |
| Confidence review threshold (0.55) + “Needs review” badge | `needsHumanReview`, `AnalysisCard` |
| Duplicate detection helper (name+size) | `findDuplicatePhotoIds` |
| Non-destructive field merge helper | `suggestWithoutOverwrite` |

## Phase 5 — Product polish

| Change | Location |
| --- | --- |
| Upload → Analyse → Estimate checklist | `PipelineChecklist` on upload + analysis |
| Per-file / weak-photo retry buttons | upload + analysis pages |

## Exit criteria (manual QA)

1. Valid JPEG/PNG/WebP under 10MB upload successfully with per-file progress.
2. Oversized / non-image files show clear validation errors without partial orphans.
3. Partial batch failure keeps successes and offers retry for failures.
4. Health banner appears when auth/storage probe fails.
5. Analysis of many photos does not fan out unbounded (max 3 concurrent vision calls).
6. Fallback / low-confidence photos show “Needs review” and can be re-analysed.
7. Analysis UI groups results by room type.

## Bucket / env checklist

- [ ] `project-photos` bucket exists and is public (or signed URL strategy updated)
- [ ] Storage RLS: insert/select/update/delete scoped to `auth.uid()` folder
- [ ] `OPENAI_API_KEY` (or HuggingFace) set on server
- [ ] PostHog project token for production event capture
