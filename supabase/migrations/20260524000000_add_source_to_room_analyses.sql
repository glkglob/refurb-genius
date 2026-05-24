-- Add `source` column to room_analyses to track where the analysis result originated.
-- Valid values: 'ai' (real OpenAI Vision), 'mock' (dev template), 'fallback' (error path),
-- or 'persisted' (loaded from previous session).
-- All pre-existing rows default to 'persisted' for full backward compatibility.
-- RLS policies are unaffected.

alter table room_analyses
  add column if not exists source text not null default 'persisted';

-- Enforce the known AnalysisSource enum values at the database level.
alter table room_analyses
  add constraint room_analyses_source_check
  check (source in ('ai', 'mock', 'fallback', 'persisted'));
