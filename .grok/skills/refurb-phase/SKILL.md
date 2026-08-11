---
name: refurb-phase
description: >
  Governed Refurb Genius phase orchestrator for Grok Build. Accepts a compact
  phase capsule (PHASE, MODE, AUTHORITY, BASE, CANDIDATE, BRANCH, ALLOWLIST,
  GOAL, MUST_PROVE, VALIDATION, DEFER, STOP_AFTER) and executes only that phase
  under AGENTS.md + .grok/rules/orchestration.md. Use for audit, planning,
  implementation, repair, independent-verification, commit, commit-push-ci,
  merge-production, db-release; when the user runs /refurb-phase; or when a
  phase capsule is supplied for Refurb Genius programme work.
---

# refurb-phase — Governed Phase Orchestrator

## Role

Parent orchestrator for **one** authorised Refurb Genius phase.

- `AGENTS.md` = architecture / product / security / programme authority
- `.grok/rules/orchestration.md` = execution behaviour
- Phase capsule = current authorised **scope** (may narrow; must not silently override higher governance)

If the capsule would require violating `AGENTS.md` or a locked architecture contract: **STOP** and request owner/architecture review.

Do not change application code unless MODE authorises mutation and ALLOWLIST permits it.

## Phase capsule

Parse (required fields in bold when mutation or remote mutation is intended):

```text
PHASE          # name / id
MODE           # audit | planning | implementation | repair |
               # independent-verification | commit | commit-push-ci |
               # merge-production | db-release
AUTHORITY      # what is authorised; what is not
BASE           # base SHA / ref
CANDIDATE      # candidate SHA when fixed
BRANCH         # working branch
ALLOWLIST      # files/paths permitted to change (empty for read-only)
GOAL           # outcome
MUST_PROVE     # evidence obligations
VALIDATION     # focused | affected | full | explicit list | reuse-if-valid
DEFER          # explicit out-of-scope residuals
STOP_AFTER     # hard stop condition / deliverable
```

Missing critical fields for the MODE: ask only for what blocks safe execution, or **STOP**.

## Startup (every MODE)

1. Load `AGENTS.md` and `.grok/rules/orchestration.md` (already always-on where configured).
2. Baseline lock: branch, `HEAD`, BASE/CANDIDATE as applicable, working tree, remote refs if needed.
3. Confirm MODE matches AUTHORITY.
4. Confirm ALLOWLIST empty for read-only modes.
5. On relevant drift: **STOP** (no auto-rebase/reset/stash/discard/force-push).

## Topology (ceilings, not quotas)

Select the **minimum useful** agents. Do not spawn to fill a template.

| MODE                                   | Default topology                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| simple / deterministic within any MODE | parent only                                                                                          |
| audit                                  | 1–2 read-only agents; parent synthesizes                                                             |
| planning                               | 1–2 read-only agents; **no mutation**                                                                |
| implementation                         | optional read-only discovery → **one** mutator → fresh reviewer                                      |
| repair                                 | one bounded mutation path → one reviewer                                                             |
| independent-verification               | up to two independent read-only reviewers + parent probes                                            |
| commit                                 | parent (scope, safety gates, commit if authorised)                                                   |
| commit-push-ci                         | parent; exact-head CI reconfirm after push                                                           |
| merge-production                       | parallel read-only evidence; parent serializes merge; fresh final reviewer                           |
| db-release                             | parent serializes Production DB release; read-only evidence may parallelise; **one** DB mutator only |

Rules:

- Planning / audit / IV children: **read-only** capabilities.
- Maximum **one mutator** by default.
- Never concurrent mutators on one working tree.
- Fresh reviewer must not be the mutator.

## Worktrees

```text
Read-only agents: no worktree required.
Single mutator: no additional worktree by default.
Multiple independently authorised concurrent mutations:
  isolated worktrees on the exact controlling ref/SHA.
Never create worktrees merely because subagents exist.
Never automatically merge child worktree output.
```

## Validation policy

```text
Focused  → changed behaviour (targeted tests / probes)
Affected → typecheck / relevant invariants / security / package boundaries
Full     → only when governance requires it, candidate changed materially,
           evidence is stale, risk is broad, or architecture/security/data
           scope warrants it
```

**Exact-candidate evidence reuse:** unchanged candidate SHA may reuse still-valid
validation, IV, and exact-head evidence for that SHA.

Do **not** auto-rerun full validation merely because a commit is next.

Before commit: staged-scope audit, commit-safety checks required by repo governance
and current risk (hooks, secrets, message). Candidate change invalidates related verification.

## Evidence hierarchy

1. git / working tree
2. repository source
3. focused probes
4. repository validation
5. GitHub exact-head
6. deployment revision
7. production runtime
8. previous reports (context only)

## Security (never automatic)

```text
--no-verify | force-push | reset --hard
broad secret allowlisting
disable Husky / Gitleaks / security checks
discard unrelated work
```

Blocked control → classify → investigate → narrow authorised fix → reverify.

## Child packet

```text
VERDICT:
FACTS:
BLOCKERS:
FILES/SYMBOLS:
PROBE_NEEDED:
FOLLOW_UP:
```

## MODE playbooks

### audit / planning

Read-only. Map facts, risks, options, DEFER. No commits. Output plan or audit report + STOP_AFTER.

### implementation

Lock BASE/BRANCH/ALLOWLIST → mutate only allowlisted paths → focused/affected validation per capsule → fresh review → report. No commit unless AUTHORITY includes it.

### repair

Bounded fix only (stated defect). No drive-by refactors. Reviewer confirms bound held.

### independent-verification

Reconstruct from source + probes + exact SHA. Do not trust implementer prose. Verdict PASS / PASS WITH FOLLOW-UP / FAIL / BLOCKED.

### commit / commit-push-ci

Verify candidate + allowlist + still-valid evidence. Stage only allowlist. Commit message per AUTHORITY. **No `--no-verify`.** Push only if MODE/AUTHORITY includes it. Reconfirm exact-head CI after push. No merge unless authorised.

### merge-production

Pre-merge: PR identity, candidate SHA, scope, exact-head green, base advancement class. Parent merges with repo-normal strategy. Verify remote main ancestry, production revision contains merge/candidate, smoke health. Residuals stay explicit. No auto next phase.

Under **Model B** (`docs/operations/database-delivery-model-b.md`): merge-production does **not** apply Production database migrations unless a separate explicit DB-apply authority is stated. Default after a DB-MIGRATION PR merge: **STOP**, then a distinct `db-release` phase.

### db-release

Explicit Production database release after merge (Model B).

- Confirm Model B authority and that Supabase Deploy to production remains OFF.
- Lock merged main SHA.
- Confirm linked Production project (`sxhzjmzfkgbogmlsbeju`).
- Inspect migration history (repo vs Production).
- Run dry-run; require exact authorised pending set.
- Require explicit Production-apply owner authority (distinct from merge authority).
- Apply once (`supabase db push --linked` or authorised equivalent).
- Verify history and zero pending on re-dry-run.
- Run focused security/runtime probes.
- Never merge/source-edit in db-release mode unless separately authorised.
- Never remote reset / rewrite applied history / routine migration repair.
- Rollback = forward repair migration.
- STOP after report.

## STOP

Stop when: authority missing/exceeded; drift; allowlist breach; AGENTS.md conflict; security bypass pressure; evidence gap with material risk; STOP_AFTER reached.

On STOP: report PHASE, VERDICT, evidence, blockers, DEFER, recommended next phase (**do not execute it**).

## Report skeleton

```text
PHASE:
MODE:
VERDICT: PASS | PASS WITH FOLLOW-UP | BLOCKED | FAIL
BASE / CANDIDATE / BRANCH / HEAD:
SCOPE:
EVIDENCE:
VALIDATION:
SECURITY:
DEFER:
NEXT: (recommendation only)
STOP:
```

## Reference

Human prompt-writing guide: `docs/operations/grok-build-prompt-standard.md`.  
Do not paste that full standard into always-loaded rules or child prompts.
