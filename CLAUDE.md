# CLAUDE.md

@AGENTS.md

## Claude Code notes

- Project skills live under `.claude/skills/` (TanStack Start integration, LLM analytics, and symlinks to shared Supabase skills).
- Shared/vendor skills are also available under `.agents/skills/` (canonical location for Supabase agent skills; referenced via `skills-lock.json`).
- Prefer `AGENTS.md` as the single source of truth for architecture, conventions, and safety rules. Keep Claude-specific configuration (skills, commands, settings) in `.claude/`.
