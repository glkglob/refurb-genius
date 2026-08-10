# Grok Build — Refurb Genius Prompt Writing Standard

**Status:** Approved reference (human + authoring guide)  
**Audience:** Owners and operators writing Grok Build phase prompts  
**Companion runtime:**

| Layer                                         | Path                                            | Role                           |
| --------------------------------------------- | ----------------------------------------------- | ------------------------------ |
| Architecture / product / security / programme | `AGENTS.md` (+ linked architecture docs)        | Canonical knowledge authority  |
| Grok execution behaviour                      | `.grok/rules/orchestration.md`                  | Always-loaded compact policy   |
| Phase orchestration skill                     | `.grok/skills/refurb-phase/SKILL.md`            | Reusable governed-phase runner |
| This document                                 | `docs/operations/grok-build-prompt-standard.md` | Full prompt-writing standard   |

Do **not** paste this entire standard into always-loaded Grok rules. Keep runtime compact; keep this file as the comprehensive authoring reference.

---

## 1. Purpose

Make future Grok Build prompts **substantially shorter and more reliable** while preserving:

- Refurb Genius architecture and IA contracts
- security and secret-protection policy
- exact-SHA / exact-candidate governance
- independent verification discipline
- owner-controlled phase gates

Application code, CI, Gitleaks policy, MCP, and product behaviour are **out of scope** of this standard document itself.

---

## 2. Authority precedence

```text
AGENTS.md
→ architecture / product / security / programme authority

.grok/rules
→ Grok execution behaviour

current phase capsule
→ current authorised scope
```

Rules:

1. A phase **may narrow** scope (allowlist, MODE, STOP_AFTER).
2. A phase **must not silently override** `AGENTS.md` or locked architecture contracts (e.g. IA-0).
3. If an authorised phase appears to require violating higher governance: **STOP** and request owner/architecture review.
4. Do not create parallel knowledge authorities (`GROK.md`, second AGENTS, duplicated stack/architecture inventories in `.grok/`).

`CLAUDE.md` remains a thin pointer to `AGENTS.md`. It is not a Grok instruction file.

---

## 3. Design principles for prompts

### Prefer capsules over novels

Once the operating model is installed, an owner prompt should usually be a **phase capsule** plus only the facts that are unique to this phase (SHAs, allowlist, MUST_PROVE, DEFER).

Avoid re-stating:

- tech stack
- full repository layout
- generic coding style
- entire security doctrine

Those live in `AGENTS.md`.

### Prefer explicit gates over implied continuation

Always state:

- what is authorised now
- what is **not** authorised
- when to STOP
- that the recommended next phase is **not** auto-executed

### Prefer exact SHAs over branch poetry

When a candidate is fixed, name:

```text
BASE = <full sha>
CANDIDATE = <full sha>
BRANCH = <name>
```

Require STOP on relevant drift.

### Prefer evidence over narrative

Order of proof (see §7). Previous reports are context when live evidence is available.

---

## 4. Phase capsule schema

Standard fields:

```text
PHASE
MODE
AUTHORITY
BASE
CANDIDATE
BRANCH
ALLOWLIST
GOAL
MUST_PROVE
VALIDATION
DEFER
STOP_AFTER
```

### Field definitions

| Field          | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| **PHASE**      | Stable id/name (e.g. `PH-SENTRY-1D`, `IA-7-PLAN`)                       |
| **MODE**       | Execution mode (see §5)                                                 |
| **AUTHORITY**  | Explicit allow / deny for mutation, commit, push, merge, prod           |
| **BASE**       | Parent/base SHA or ref the candidate builds on                          |
| **CANDIDATE**  | Exact implementation SHA when locked; omit only for pure planning/audit |
| **BRANCH**     | Working branch name                                                     |
| **ALLOWLIST**  | Paths permitted to change; empty ⇒ no source mutation                   |
| **GOAL**       | Outcome in one short paragraph                                          |
| **MUST_PROVE** | Evidence obligations (tests, probes, exact-head, prod revision, …)      |
| **VALIDATION** | `focused` / `affected` / `full` / explicit commands / `reuse-if-valid`  |
| **DEFER**      | Explicit residuals; must not be “fixed” without new authority           |
| **STOP_AFTER** | Hard stop (e.g. report only; commit only; no merge)                     |

### Minimal authoring template

```text
PHASE: <id>
MODE: <mode>
AUTHORITY: <what is allowed / forbidden>
BASE: <sha>
CANDIDATE: <sha or n/a>
BRANCH: <branch>
ALLOWLIST:
  - path/a
  - path/b
GOAL: <one paragraph>
MUST_PROVE:
  - ...
VALIDATION: focused | affected | full | reuse-if-valid | <commands>
DEFER:
  - ...
STOP_AFTER: <condition>
```

Invoke the project skill when useful (see §12 for verified invocation).

---

## 5. Supported MODE values

| MODE                       | Intent                      | Mutation        | Typical stop                       |
| -------------------------- | --------------------------- | --------------- | ---------------------------------- |
| `audit`                    | Fact-finding                | No              | Audit report                       |
| `planning`                 | Plan / options              | No              | Plan ready                         |
| `implementation`           | Build allowlisted change    | Yes (allowlist) | Code + validation; often no commit |
| `repair`                   | Bounded defect fix          | Yes (narrow)    | Fix + review                       |
| `independent-verification` | Adversarial re-proof        | No              | PASS / FAIL / BLOCKED              |
| `commit`                   | Create commit only          | Git only        | Commit SHA recorded                |
| `commit-push-ci`           | Commit, push, exact-head CI | Git + remote    | CI green on exact head             |
| `merge-production`         | Merge + prove prod          | Merge only      | Prod verified; phase closed        |

Do not combine unrelated MODEs in one prompt unless the owner explicitly serialises a multi-step gate (e.g. “commit then push”) in AUTHORITY and STOP_AFTER.

---

## 6. Adaptive agent topology

**Ceilings, not quotas.** Use the minimum useful number of agents. Do not spawn an agent merely to satisfy a template.

| Situation                | Ceiling                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| Simple deterministic     | Parent only                                                                |
| Audit / planning         | 1–2 read-only agents                                                       |
| Implementation           | Optional discovery + **one mutator** + one fresh reviewer                  |
| Repair                   | One bounded mutation path + one reviewer                                   |
| Independent verification | Up to two independent read-only reviewers + parent probes                  |
| Commit / push            | Parent normally                                                            |
| Merge / production       | Parallel read-only evidence; parent serializes merge; fresh final reviewer |

Hard rules:

- Planning-only work uses **read-only** capabilities.
- Default maximum **one mutator**.
- Never concurrent mutators against one working tree.
- Reviewer must be fresh relative to the mutator when review is required.

---

## 7. Evidence hierarchy

```text
1. current git / working-tree state
2. repository source
3. focused executable probes
4. repository validation
5. GitHub exact-head evidence
6. deployment revision
7. production runtime
8. previous phase reports
```

Reports are **context**, not proof, when direct evidence is available.

Exact-head rule: remote checks (CI, Security, deploy metadata) must correspond to the **candidate or merge SHA under review**, not “latest on branch” if they differ.

---

## 8. Progressive validation and evidence reuse

### Progressive validation

```text
Focused
→ changed behaviour (targeted unit/integration/probes)

Affected
→ typecheck / relevant invariants / security / package boundaries

Full
→ only when governance explicitly requires it,
  candidate changed materially,
  existing evidence is stale,
  risk is broad,
  or architecture/security/data scope warrants it
```

### Exact-candidate evidence reuse

An **unchanged** exact candidate SHA may reuse still-valid:

- focused/affected/full validation results
- independent verification outcomes
- exact-head CI / security checks

for that same SHA.

**Do not** write or implement:

```text
heading to commit → automatically rerun full validation
```

Before commit, run only the **additional commit-safety** checks required by repository governance and current risk (for example staged-scope audit, hooks, secret scan on staged changes, commit message). Consult `AGENTS.md` pre-commit expectations and `docs/operations/secret-protection.md` without re-deriving architecture.

**Any candidate change** invalidates verification relevant to the changed behaviour; re-prove what changed.

---

## 9. Worktree policy

```text
Read-only agents:
no worktree required.

Single mutator:
no additional worktree by default.

Multiple independently authorised concurrent mutations:
use isolated worktrees based on the exact controlling ref/SHA.

Never create worktrees merely because subagents exist.

Never automatically merge child worktree output.
```

Owner must explicitly authorise multi-mutator / multi-worktree fan-out.

---

## 10. Security non-bypass policy

Never automatically:

```text
--no-verify
git push --force
git reset --hard
broad secret-scan allowlisting
disable Husky
disable Gitleaks
disable security checks
discard unrelated work
```

When a security control blocks:

```text
classify
→ investigate
→ narrowly remediate if authorised
→ reverify
```

Not bypass. Prefer fixture/source representation fixes over policy weakenings (see historical Gitleaks JWT fixture remediation pattern).

---

## 11. Child-agent contract

Children should normally return:

```text
VERDICT:
FACTS:
BLOCKERS:
FILES/SYMBOLS:
PROBE_NEEDED:
FOLLOW_UP:
```

Keep child output concise. The **parent** synthesizes the formal phase report for the owner.

Independent verification agents must **reconstruct** behaviour from source and probes; they must not rubber-stamp implementer reports.

---

## 12. Skill: `refurb-phase`

### Intent

`refurb-phase` is the **project-level** Grok skill for governed phase execution. It consumes a phase capsule and applies topology, validation, worktree, security, and STOP rules consistently.

### Installation path

```text
.grok/skills/refurb-phase/SKILL.md
```

### Invocation (verify after install)

Grok discovers project skills under `<repo>/.grok/skills/`. Supported patterns in current Grok Build:

| Mechanism          | Expected form                                | Notes                                                        |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------ |
| Slash command      | `/refurb-phase`                              | When skill is `user-invocable` (default true) and discovered |
| Skills menu        | `/skills` → `refurb-phase`                   | TUI discovery                                                |
| Natural language   | Phase capsule + “run refurb-phase”           | Model may auto-invoke from skill `description`               |
| Full capsule paste | Capsule alone in a Grok session in this repo | Skill should activate when description matches               |

**Authoring rule:** Do not hard-code a slash syntax in owner runbooks until post-install `grok inspect` (or equivalent) confirms discovery. Record the **verified** invocation in the install report and update this section if tooling differs.

**Verified on install (this repository, Grok Build 1.0.0):**

```text
Discovery: grok inspect --json lists skill name "refurb-phase"
           source type=project
           path=.grok/skills/refurb-phase/SKILL.md
           userInvocable=true
Rule:      projectInstructions includes .grok/rules/orchestration.md
Slash:     /refurb-phase is supported (userInvocable=true; skill description
           documents /refurb-phase; skills menu /skills refurb-phase)
Natural:   phase capsule + Refurb Genius programme work may auto-invoke
```

Re-run `grok inspect --json` after moving the skill if discovery must be reconfirmed.

---

## 13. Baseline, drift, and git hygiene

Before mutation:

1. `git fetch` when remote evidence matters
2. Record branch, `HEAD`, BASE, CANDIDATE
3. Record staged/unstaged/untracked noise

On **relevant** drift: **STOP**.  
Do not automatically:

- rebase onto a moved main
- reset hard
- stash/discard unrelated work
- force-push

to reconcile drift without owner authority.

---

## 14. Commit, push, merge, production

Write AUTHORITY explicitly.

| Action            | Requires                                                      |
| ----------------- | ------------------------------------------------------------- |
| Commit            | MODE/AUTHORITY includes commit; allowlist match; hooks intact |
| Push              | Explicit push authority; no force                             |
| Merge             | Explicit merge authority; exact-head green; scope clean       |
| Production verify | Deployment revision contains merge/candidate; runtime smoke   |

Never assume merge SHA equals candidate SHA (merge commits differ). Prove ancestry when needed.

Production evidence is not satisfied by preview alone.

---

## 15. Residuals and gap honesty

DEFER items stay deferred unless a new phase authorises them.

Do not close umbrella gaps when only a subset shipped. Example pattern:

```text
GAP-X: PARTIAL — <subset> MERGED + VERIFIED; RESIDUAL: <rest>
```

not `CLOSED` if residuals remain active.

---

## 16. STOP conditions (prompt authors must enable them)

Prompts should make STOP easy and mandatory when:

- authority missing, ambiguous, or exceeded
- relevant baseline/candidate drift
- allowlist or scope expansion needed
- AGENTS.md / locked contract conflict
- security bypass would be required
- required evidence unavailable at material risk
- STOP_AFTER reached

On STOP, require a short state report + smallest next authorised step — not silent continuation.

---

## 17. Anti-patterns

| Anti-pattern                                | Prefer                                           |
| ------------------------------------------- | ------------------------------------------------ |
| Multi-phase “do everything” mega-prompt     | One MODE per gate                                |
| Re-paste AGENTS.md / stack                  | Capsule + references                             |
| “Then continue to next phase” without owner | Recommendation + STOP                            |
| Auto full suite before every commit         | Exact-candidate reuse + commit-safety            |
| Fixed 5-agent topology always               | Adaptive minimum                                 |
| Worktree per subagent                       | Worktree only for concurrent authorised mutators |
| `--no-verify` to land                       | Classify + fix + reverify                        |
| Closing gaps with residuals                 | PARTIAL + explicit residual                      |
| Trusting last session prose alone           | Reconstruct from SHA + source + probes           |

---

## 18. Example: compact implementation capsule

```text
PHASE: PH-EXAMPLE-1
MODE: implementation
AUTHORITY: mutate ALLOWLIST only; no commit; no push
BASE: abcdef...
CANDIDATE: n/a (create on branch)
BRANCH: fix/ph-example-1
ALLOWLIST:
  - src/platform/example/foo.ts
  - src/platform/example/foo.test.ts
GOAL: Add fail-closed sanitiser for X; preserve public API Y.
MUST_PROVE:
  - unit tests for hostile inputs
  - no secrets in freeform fields after sanitize
VALIDATION: focused + affected typecheck/invariants if boundaries touch
DEFER:
  - related subsystem Z
STOP_AFTER: implementation report; do not commit
```

## 19. Example: compact IV capsule

```text
PHASE: PH-EXAMPLE-1-IV
MODE: independent-verification
AUTHORITY: read-only; no mutation
BASE: abcdef...
CANDIDATE: 123456...
BRANCH: fix/ph-example-1
ALLOWLIST: (none)
GOAL: Prove CANDIDATE meets MUST_PROVE without trusting implementer report.
MUST_PROVE:
  - reconstruct behaviour from source
  - rerun focused probes
  - confirm allowlist-only diff from BASE
VALIDATION: reuse-if-valid focused suite; re-run if SHA drift
DEFER: Z
STOP_AFTER: IV verdict only
```

## 20. Example: compact merge-production capsule

```text
PHASE: PH-EXAMPLE-1-MERGE
MODE: merge-production
AUTHORITY: merge PR #N only; no further implementation
BASE: abcdef...
CANDIDATE: 123456...
BRANCH: fix/ph-example-1
ALLOWLIST: (merge only; no source edits)
GOAL: Merge exact candidate; prove production revision and health.
MUST_PROVE:
  - exact-head CI green on CANDIDATE
  - origin/main contains merge
  - production deployment revision ancestry
  - HTTP + critical path smoke
VALIDATION: reuse still-valid exact-head; post-merge focused smoke
DEFER: listed residuals remain open
STOP_AFTER: phase complete report; no next phase
```

---

## 21. Relationship to programme history

This standard codifies practices proven in Refurb Genius governed slices (exact SHA locks, independent verification, Gitleaks non-bypass remediation, merge + production revision proof, residual honesty). It does not re-open completed product phases.

---

## 22. Maintenance

| Change type                             | Where to edit                                       |
| --------------------------------------- | --------------------------------------------------- |
| Architecture / product / security rules | `AGENTS.md` / architecture docs                     |
| Always-on execution policy              | `.grok/rules/orchestration.md` (keep ~80–150 lines) |
| Phase runner behaviour                  | `.grok/skills/refurb-phase/SKILL.md`                |
| Authoring guidance / examples           | This file                                           |

Keep the always-loaded rule compact. Expand examples and prose **here**, not in `.grok/rules`.

---

## 23. Install checklist (for operating-model changes)

When changing the Grok execution layer:

1. Touch only authorised Grok/docs paths unless a product phase says otherwise.
2. Do not modify `AGENTS.md` / `CLAUDE.md` unless install is otherwise impossible.
3. Verify discovery with `grok inspect` / `grok inspect --json` when available.
4. Record rule discovery, skill discovery, and **actual** invocation syntax.
5. Do not claim slash-command support without evidence.
6. No commit/push unless a later phase authorises it.
