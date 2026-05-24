# Archived Legacy AI Agent Guidance & Railway Experiment Artifacts

**Archived:** May 2026

This directory preserves historical artifacts that were previously active in the repository but are no longer maintained or relevant to current development practices.

## Contents

### Cursor Rules (9 files)
These were custom rules for the Cursor AI coding assistant:
- 00-project-overview.mdc
- 01-tech-stack.mdc
- 02-safe-agent-behaviour.mdc
- 03-shared-core.mdc
- 04-pricing-roi.mdc
- 05-supabase-security.mdc
- 06-ui-components.mdc
- 07-ai-boundaries.mdc
- 08-git-workflow.mdc

Originally located at `.cursor/rules/`

### Claude Commands (6 files)
These were custom slash commands for Claude Code:
- add-email-notifications.md
- add-pdf-export.md
- expand-admin-panel.md
- fix-fast-refresh-warnings.md
- wire-ai-redesign.md
- wire-openai-vision.md

Originally located at `.claude/commands/`

### Railway Backend Experiment
- `RAILWAY_SETUP.md` — This document described an experimental attempt to run a separate FastAPI + CrewAI backend on Railway while keeping the TanStack Start frontend on Vercel. The corresponding `backend/` directory and related files were removed as part of decommissioning this experiment.

## Purpose of This Archive

These files are retained purely for historical reference. They document earlier experiments with AI coding agents and deployment architecture that were later superseded by the current monorepo structure and internal development practices.

**Do not treat any content in this directory as current guidance.** Active standards and instructions have been consolidated elsewhere in the repository (primarily in `docs/` and team processes).

---

*This archive was created during the cleanup of legacy AI tooling artifacts and experimental deployment documentation.*