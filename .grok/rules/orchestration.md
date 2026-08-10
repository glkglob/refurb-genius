# Grok Build — Execution Policy (Refurb Genius)

Always-loaded **execution** rules only. Architecture, product semantics, coding
conventions, security requirements, and programme contracts live in `AGENTS.md`
and linked architecture docs. Do not restate them here.

## Authority

```text
AGENTS.md owns architecture, product semantics, repository conventions,
security requirements and programme contracts.

.grok/rules owns Grok execution behaviour.

The current authorised phase/prompt may narrow execution scope but must
not silently override AGENTS.md.

If an authorised phase appears to require violating AGENTS.md or a locked
architecture contract, STOP and request owner/architecture review.
```

Phase capsules and skills implement this policy; they never replace it.

## Phase gate

1. Execute **only** the explicitly authorised phase / MODE.
2. Never automatically execute a recommended next phase.
3. After the phase report: **STOP** unless the same message authorises more.
4. No commit, push, merge, or production action unless that phase authorises it.

## Baseline lock (before any mutation)

Record and verify: branch, `HEAD`, controlling base/candidate SHA (as applicable),
staged vs unstaged scope, unrelated working-tree noise, and remote refs when
push/merge/CI is in scope.

On **relevant** baseline, branch, or candidate SHA drift: **STOP**.
Do not auto-rebase, reset, stash, discard, or force-push to “fix” drift.

## Mutation safety

Never automatically:

```text
--no-verify | git push --force | git reset --hard
broad secret-scan allowlisting
disable Husky / Gitleaks / security checks
discard unrelated work
```

Blocked security controls: classify → investigate → narrowly remediate **if
authorised** → reverify. Never bypass.

Default: **one mutator**. Never run concurrent mutators against one working tree.

## Worktrees

```text
Read-only agents: no worktree required.
Single mutator: no additional worktree by default.
Multiple independently authorised concurrent mutations:
  isolated worktrees on the exact controlling ref/SHA.
Never create worktrees merely because subagents exist.
Never automatically merge child worktree output.
```

## Adaptive topology

Use the **minimum useful** number of agents. Ceilings, not quotas:

| MODE                     | Ceiling                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| simple deterministic     | parent only                                                                |
| audit / planning         | 1–2 read-only agents                                                       |
| implementation           | optional discovery + **one** mutator + one fresh reviewer                  |
| repair                   | one bounded mutation path + one reviewer                                   |
| independent-verification | up to two independent read-only reviewers + parent probes                  |
| commit / commit-push-ci  | parent normally                                                            |
| merge-production         | parallel read-only evidence; parent serializes merge; fresh final reviewer |

Planning-only work: **read-only** capabilities. Do not spawn agents to fill a template.

## Evidence hierarchy

Prefer live evidence over narrative:

1. current git / working-tree state
2. repository source
3. focused executable probes
4. repository validation
5. GitHub **exact-head** evidence
6. deployment revision
7. production runtime
8. previous phase reports

Reports are context, not proof when direct evidence is available.

## Exact-candidate evidence reuse

An **unchanged** exact candidate SHA may reuse still-valid validation / IV /
exact-head evidence for that SHA.

Any candidate change invalidates verification relevant to the changed behaviour.
Do **not** treat “heading to commit” as automatic full re-validation.

Before commit: run additional **commit-safety** checks required by repository
governance and current risk (hooks, secrets, staged scope, message).

## Progressive validation

```text
Focused  → changed behaviour
Affected → typecheck / relevant invariants / security / package boundaries
Full     → only when governance requires it, candidate changed materially,
           evidence is stale, risk is broad, or architecture/security/data
           scope warrants it
```

## Review and independent verification

- After non-trivial implementation/repair: prefer a **fresh** adversarial reviewer
  that did not perform the mutation.
- Independent verification **reconstructs** behaviour from source, probes, and
  exact SHA evidence; it does not trust implementer reports alone.
- Exact-head remote checks must match the candidate SHA under review.

## Child-agent contract

Children return compact packets:

```text
VERDICT:
FACTS:
BLOCKERS:
FILES/SYMBOLS:
PROBE_NEEDED:
FOLLOW_UP:
```

Parent synthesizes the formal phase report. Keep reports concise and evidence-led.

## STOP conditions

STOP immediately when:

- phase authority is missing, ambiguous, or exceeded
- relevant baseline / candidate drift
- allowlist or scope would expand without authorisation
- AGENTS.md or locked architecture would be violated
- security control would need a bypass
- merge/prod revision does not contain the verified candidate
- required evidence cannot be obtained and risk is material

On STOP: report state, blockers, and the smallest authorised next step. Do not invent authority.
