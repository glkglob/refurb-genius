# Production Database Delivery — Model B

**Status:** IN FORCE  
**Scope:** Production database / schema migration delivery for Refurb Genius  
**Canonical authority:** This runbook is the operational contract for Production migration release.

---

## Core contract

```text
MODEL B

MERGE TO MAIN
≠
PRODUCTION DATABASE APPLY

A repository merge does not authorise or apply Production DB changes.

Production DB application requires a separate explicit owner gate.
```

```text
OWNER MERGE AUTHORISATION
≠
OWNER PRODUCTION DB APPLY AUTHORISATION
```

---

## Control plane (configuration)

### Supabase GitHub Integration

```text
Deploy to production = OFF
Automatic branching = ON
```

| Setting                  | Role under Model B                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| **Automatic branching**  | PR Preview rehearsal (preview project + migration application to Preview where configured) |
| **Deploy to production** | **Must remain OFF** so merge-to-main does not auto-mutate Production schema                |

### Proof posture

```text
CONFIGURATION VERIFIED
  (control plane independently verified; Deploy to production OFF)

BEHAVIORAL MIGRATION PROOF
  DEFERRED TO 1B4
  (a real authorised post-control-plane migration merge has not yet proven
   non-auto-apply under Deploy OFF; do not claim it until observed)
```

### Main branch protection

`main` is governed by the repository ruleset named **`main-governance`**
(numeric ruleset IDs are operational evidence only, not permanent policy).

Required repository-owned status checks (exact job names):

```text
ci
invariant-tests
secret-scan (gitleaks)
server-only-boundary
dependency-audit
client-bundle-secret-smoke
```

Also enforced structurally:

```text
PR required
required approving reviews = 0
review-thread resolution required
strict / branch-up-to-date required status checks
force push blocked
branch deletion blocked
routine bypass actors = none
```

Optional / external checks (Supabase Preview, Vercel, CodeRabbit, cubic, etc.)
are **not** universal ruleset requirements unless a later authorised control-plane
phase changes that policy.

---

## Production target hard gate

| Role                                          | Project ref            |
| --------------------------------------------- | ---------------------- |
| **Production (canonical)**                    | `sxhzjmzfkgbogmlsbeju` |
| Preview example (historical / non-production) | `ggyzyrhvtqmvqtylaegd` |

Every Production dry-run / apply phase **must** prove:

```text
linked project_ref = sxhzjmzfkgbogmlsbeju
```

before any Production dry-run or apply.

Preview project refs **must never** support Production claims.

---

## DB-MIGRATION PR classification

```text
DB-MIGRATION PR =
any PR changing supabase/migrations/**
```

| Path                               | Classification                                               |
| ---------------------------------- | ------------------------------------------------------------ |
| `supabase/migrations/**`           | Production schema migration candidate (this runbook)         |
| `supabase/tests/database/**` alone | Tests only — **not** a Production schema migration by itself |
| `supabase/config.toml`             | Deployment-sensitive config — separate release class         |
| `supabase/functions/**`            | Edge Function release — separate release class               |

Do not treat every `supabase/**` change as a Production schema migration.

---

## Pre-merge gate (DB-MIGRATION PR)

Before merge of a DB-MIGRATION PR, require evidence of:

1. Clean local migration replay
2. Focused DB / pgTAP tests where applicable
3. Migration inventory registration (repository inventory conventions)
4. Exact-head CI green
5. Exact-head Security green
6. Supabase Preview success where applicable
7. Read-only Production migration-history comparison
8. Exact expected pending-set calculation
9. Forward-repair / rollback plan
10. **Explicit owner merge authorisation**

Hard separation:

```text
Owner authorisation to merge
does NOT authorise Production DB apply.
```

---

## Post-merge Production DB release

Canonical sequence after a DB-MIGRATION PR is merged:

```text
 1. Merge approved candidate
 2. Identify MERGE_SHA
 3. Require merged-main CI green
 4. Require merged-main Security green
 5. Confirm application / deployment compatibility as required by migration class
 6. Verify linked Production project_ref = sxhzjmzfkgbogmlsbeju
 7. supabase migration list --linked
 8. supabase db push --linked --dry-run
 9. Verify exact expected pending set
10. Obtain explicit owner Production-apply authority
11. supabase db push --linked
12. Verify migration history
13. Repeat dry-run → zero pending
14. Run security / functional / production probes
15. Close release only on evidence
```

```text
NO Production DB mutation before step 10.
```

Preferred apply mechanism (current programme default):

```text
Controlled operator CLI (manual)

MODEL_B_APPLY_MECHANISM = CLI
```

Do not use automatic push-triggered Production migration apply.
A protected `workflow_dispatch` environment may be designed later; it is not the
default automatic path and is not required by this runbook.

Use Grok MODE **`db-release`** (or equivalent explicit owner authority) for
steps 6–15. Do not treat MODE `merge-production` as including step 11 by default.

---

## Pending-set gate

If dry-run produces any of:

```text
0 pending when one is expected
> expected count
unexpected older migration
unexpected newer migration
history mismatch
```

then:

```text
STOP
```

Never force through with:

```text
--include-all
migration repair
remote reset
history rewrite
```

without a **separate** recovery authority.

---

## Backlog control

```text
repo migration versions
−
Production schema_migrations versions
=
Production migration backlog
```

Outside an active authorised release:

```text
non-empty backlog
→ block additional migration merges
→ classify and release explicitly
```

Do **not** auto-apply backlog. Do **not** re-enable Deploy to production merely
to clear backlog.

---

## Drift control

Hard checks:

```text
Production version absent from repo
repo version absent from Production
multiple unexpected pending versions
out-of-order migration
history mismatch
```

Recovery:

```text
STOP
→ preserve evidence
→ bounded recovery plan
→ explicit owner authority
```

Never:

```text
remote reset
rewrite applied history
automatic migration repair
```

---

## Rollback

```text
Applied migration history is immutable.

Rollback normally =
new forward repair migration.
```

```text
App rollback does not undo database changes.
```

For P0 / P1 security or customer regression:

```text
halt / pause under Public Beta §9
  (docs/operations/public-beta-launch-authorization.md)
preserve evidence
prepare bounded forward repair
obtain explicit owner authority
```

This runbook does not redefine beta severity thresholds.

---

## App / DB ordering matrix

| Class               | Safe ordering principle                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| **EXPAND**          | DB may precede app if the old app remains compatible.                      |
| **CONTRACT**        | App compatibility first; DB contract only after old dependency is removed. |
| **SECURITY POLICY** | Explicit case-specific ordering required.                                  |
| **DATA TRANSFORM**  | Prefer staged expand → transform/verify → app → contract.                  |
| **BREAKING**        | Forbidden as a single-step release; requires an explicit staged plan.      |

Do not claim every migration is backward-compatible.

---

## Edge Functions and Storage

Because **Deploy to production = OFF**, automatic Production delivery via the
Supabase GitHub integration also no longer applies to relevant surfaces:

```text
Edge Function Production release:
  NOT automatically delivered by merge.

Storage config Production release:
  NOT automatically delivered by merge.
```

```text
EXPLICIT RELEASE MODEL =
FOLLOW-UP / NOT YET CODIFIED
```

Do not invent a final Edge Function / Storage deploy sequence in migration
phases. Do not change `supabase/config.toml` under migration-only authority.

---

## Actor separation

| Actor                                              | Authority                                                   |
| -------------------------------------------------- | ----------------------------------------------------------- |
| GitHub Actions                                     | Application CI / Security only — **no** Production DB apply |
| Supabase GitHub Integration                        | Preview branching ON; Production auto-deploy OFF            |
| Operator CLI (or future explicit release workflow) | Production DB dry-run / apply under owner gate              |
| Vercel                                             | Application deployment                                      |

Do not conflate these authorities.

---

## Negative assertions (forbidden operating assumptions)

Current operating authorities must **never** treat as true:

```text
merge = Production DB apply
Supabase production auto-deploy should be enabled
db push may use a Preview project for Production claims
remote reset is a rollback
migration repair is routine recovery
applied migration may be edited / re-written
```

---

## Related documents

| Document                                              | Role                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `AGENTS.md`                                           | Current programme + concise Model B pointer                    |
| `docs/operations/beta-operations-playbook.md`         | Beta ops; references this runbook                              |
| `docs/operations/public-beta-launch-authorization.md` | Historical launch authority + §9 severity (**do not rewrite**) |
| `docs/operations/grok-build-prompt-standard.md`       | Prompt MODEs including `db-release`                            |
| `.grok/rules/orchestration.md`                        | Execution policy for `db-release`                              |
| `.grok/skills/refurb-phase/SKILL.md`                  | Phase runner playbook for `db-release`                         |
