# CLAUDE.md

@AGENTS.md

## Claude Code notes

- Project skills live under `.claude/skills/` (TanStack Start integration, LLM analytics, and symlinks to shared Supabase skills).
- Shared/vendor skills are also available under `.agents/skills/` (canonical location for Supabase agent skills; referenced via `skills-lock.json`).
- Prefer `AGENTS.md` as the single source of truth for architecture, conventions, and safety rules. Keep Claude-specific configuration (skills, commands, settings) in `.claude/`.
- **IA programme:** For IA-1–IA-10 follow the LOCKED IA-0 workflow contract (Version **1.0.1**) at `docs/architecture/workflow/ia-0-workflow-authority-spec.md` (see AGENTS.md “IA workflow programme”).
  - IA-0 through IA-8 are **complete**.
  - IA-9 / IA-10 are **planned but not authorised**.
  - Current programme mode: **Controlled Public Beta + Observation**.
  - Do not begin IA-9 or IA-10 without fresh explicit owner authority.
- **Production database delivery** follows `AGENTS.md` and `docs/operations/database-delivery-model-b.md` (Model B: merge ≠ Production DB apply).
