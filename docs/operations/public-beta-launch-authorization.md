# Controlled Public Beta — Launch Authorisation

| Field | Value |
| ----- | ----- |
| **Document type** | Release / programme governance record |
| **Status** | **IN FORCE** |
| **Decision date** | 2026-08-09 |
| **Release** | Refurb Genius Controlled Public Beta |
| **Decision** | **GO** |
| **Launch class** | Controlled Public Beta |
| **Owner** | Product / engineering programme maintainers |

This record is **governance only**. It does not change product behaviour, schema,
pricing, workflow authority, or production configuration.

---

## 1. Final release decision

| Item | Value |
| ---- | ----- |
| **PUBLIC BETA FINAL GO/NO-GO** | **GO** |
| **Authorised product baseline (immutable for this decision)** | `8e181527f2c73f81554121c7ed517f24500366a6` |
| **Production deployment** | `dpl_7byGcC4A4v94qNcRqvFHVcGeM2uE` |
| **Production domain** | https://www.refurbgenius.info |
| **P0 at decision** | **0** |
| **P1 core at decision** | **0** |
| **REFURB GENIUS** | READY FOR CONTROLLED PUBLIC BETA |
| **IA-9** | **Not authorised by this decision** |
| **IA-10** | **Not authorised by this decision** |

**Product baseline** remains the R2 merge SHA above. A later documentation-only
commit on `main` does **not** replace the product beta baseline unless product
source changes.

---

## 2. Exact baseline evidence (at authorisation)

Recorded at decision time:

| Check | Result |
| ----- | ------ |
| Branch | `main` |
| `origin/main` / local HEAD | `8e181527f2c73f81554121c7ed517f24500366a6` |
| Working tree | Clean |
| PR #123 | **MERGED** (merge commit = product baseline) |
| Production deployment | `dpl_7byGcC4A4v94qNcRqvFHVcGeM2uE` |
| Production source SHA | `8e181527f2c73f81554121c7ed517f24500366a6` |
| Production status | READY |
| Aliases include `www.refurbgenius.info` | Yes |

---

## 3. Completed beta gates (concise)

Launch follows successful completion of the programme gates below.
Full historical reports are not duplicated here; SHAs anchor repair baselines.

| Gate | Outcome | Notes / anchors |
| ---- | ------- | --------------- |
| IA-0 → IA-8 | **COMPLETE** | See [IA-0 programme](../architecture/workflow/ia-0-workflow-authority-spec.md) and [future roadmap](../architecture/future-roadmap.md) |
| Public Beta preflight | **COMPLETE** | Pre-Go/No-Go readiness |
| Public Beta Final Go/No-Go | **GO** (technical) | After R1 + R2 production verification |
| PUBLIC-BETA-R1 zero-refurb repair | **PASS** | R1 merge `363efd8cc92ddbf9594ecd61600290980df8015f` |
| R1 independent verification | **PASS** | |
| R1 production verification | **PASS** | |
| PUBLIC-BETA-R2 workflow-authority repair | **PASS** | Authorised head `bf38a9496279504c7ed35cd79765b2abaf74b719` |
| R2 independent verification | **PASS** | |
| R2 production verification | **PASS** | R2 merge / product baseline `8e181527f2c73f81554121c7ed517f24500366a6` |

Important repair references:

- **R1 merge:** `363efd8cc92ddbf9594ecd61600290980df8015f`
- **R2 authorised head:** `bf38a9496279504c7ed35cd79765b2abaf74b719`
- **R2 merge / product beta baseline:** `8e181527f2c73f81554121c7ed517f24500366a6`

---

## 4. Core production contracts verified

Production verification (R2 merge phase and prior gates) established:

- Normal-customer signup/auth path operational
- Name-only Project creation operational
- Dashboard/Projects: no unsupported £0 refurb claim
- Photos → Analysis invalidation correct (pre-route Needs attention)
- Analysis automatic recovery correct
- Old Redesign becomes non-current after Analysis revision
- Scope continuation waits for durable current authority
- Estimate primary continuation persists canonical authority
- Desktop Estimate continuation verified
- 390 mobile Estimate continuation verified
- 320 mobile mutation-owned continuation verified
- Name-only / unknown-size Project can complete Estimate
- Estimate is bound to current Scope
- Export completion requires durable current Estimate snapshot
- Estimate revision invalidates previous Export
- PDF Export works
- Deal Copilot / Pitch Deck / other beta review evidence completed per prior Go/No-Go records
- No core P0 / P1 remains at decision

Architecture semantics are **not** reinterpreted by this document.

---

## 5. Accepted P2 carry-forward register

P2 items **do not block** controlled Public Beta. Do not repair in this phase.
Do not auto-assign to IA-9 unless later evidence justifies it.

| ID | Title | Summary |
| -- | ----- | ------- |
| **PB-P2-01** | Unknown Project size display | Report may display `0 sqm` rather than customer-friendly “Not set”. |
| **PB-P2-02** | Reference-size assumption wording | Internal category Estimate may use `REFERENCE_SIZE_SQM = 90` when size is unknown; customer-facing wording could more explicitly identify assumed/reference size (must not present 90 m² as measured fact). |
| **PB-P2-03** | Same-input Estimate re-save | Deliberate identical re-save may create a new Estimate revision and make Export require regeneration (hygiene; not single-tap duplicate write). |
| **PB-P2-04** | Apple Sign-In clientId | Third-party `clientId should be a string` pageerror remains non-blocking. |
| **PB-P2-05** | Magic Link delivery proof | Current-run delivery proof limitation; retain prior verified evidence. |
| **PB-P2-06** | PDF deep text extraction | Deep automated PDF text-extraction tooling limitation in gates. |
| **PB-P2-07** | Performance measurement | Full Lighthouse-level measurement not available in beta gate. |
| **PB-P2-08** | PostHog taxonomy | Instrumentation / event taxonomy remains sparse. |
| **PB-P2-09** | Photo upload a11y polish | Minor accessibility / polish follow-up. |

Classification retained from production verification for name-only financial assumption:

**NAME-ONLY FINANCIAL ASSUMPTION:** SAFE WITH P2 COPY LIMITATION (PB-P2-01 / PB-P2-02).

---

## 6. Controlled-beta operating rules

Operating model for the authorised controlled beta (expectations only — no new
infrastructure is created by this decision):

1. Admit users **gradually**; avoid broad public promotion until early signal is healthy.
2. Monitor **signup / auth**.
3. Monitor **Project creation**.
4. Monitor **photo upload / Analysis** failures.
5. Monitor **Estimate authority-save** errors.
6. Monitor **Scope bind** failures.
7. Monitor **Export snapshot / PDF** failures.
8. Monitor unexpected **4xx / 5xx**.
9. Monitor customer reports of **incorrect financial presentation**.
10. Preserve ability to **halt onboarding** if a P0 or core P1 emerges.

Day-to-day procedures remain in [Beta Operations Playbook](./beta-operations-playbook.md)
and [AI Operational Governance](./ai-operational-governance.md).

---

## 7. Financial / AI trust rule

Public Beta approval **does not** certify estimates as contractor quotations or
guaranteed market prices.

Retained product trust position:

- AI Analysis may require human review
- Redesign is conceptual and not a constructability guarantee
- Estimate is **decision-support / indicative**
- Professional verification remains appropriate for real-world decisions
- Deterministic financial outputs must remain **internally coherent**
- No unsupported financial figures may be presented as authoritative

---

## 8. Rollback reference

| Role | SHA |
| ---- | --- |
| **Current beta product release** | `8e181527f2c73f81554121c7ed517f24500366a6` |
| **Previous known production baseline (before R2)** | `363efd8cc92ddbf9594ecd61600290980df8015f` |

**Do not perform rollback from this document.** Any future rollback requires
explicit authorisation based on an observed production blocker.

---

## 9. Release monitoring thresholds (escalation)

### P0 — halt beta / investigate immediately

- Cross-user data exposure
- Privileged secret exposure
- Destructive unexplained data loss
- Production-wide crash
- Fundamentally unsafe financial result
- Auth bypass

### P1 — pause affected acquisition/flow and repair

- Signup materially broken
- Project creation duplicated / broken
- Photo workflow unrecoverable
- Stale workflow authority shown as current
- Misleading financial result
- Estimate persistence materially failing
- Export falsely shown current
- Prominent live capability broken

### P2 — continue beta and schedule

- Friction, copy clarity, non-blocking third-party noise, polish, sparse analytics
- Includes the PB-P2 register above

---

## 10. Programme state after this decision

| Item | State |
| ---- | ----- |
| IA-0 through IA-8 | **COMPLETE** |
| Controlled Public Beta | **AUTHORISED** |
| IA-9 | **PLANNED / NOT AUTHORISED** |
| IA-10 | **PLANNED / NOT AUTHORISED** |
| Next programme mode | **CONTROLLED BETA + OBSERVATION** |

**Public Beta GO does not automatically authorise IA-9.**

The next product-development phase should be selected using early beta evidence,
not sequence inertia alone.

---

## 11. Related documents

- [Beta Operations Playbook](./beta-operations-playbook.md)
- [AI Operational Governance](./ai-operational-governance.md)
- [Future Roadmap](../architecture/future-roadmap.md)
- [IA-0 Workflow Authority Spec](../architecture/workflow/ia-0-workflow-authority-spec.md)
- [Architecture Overview](../architecture/overview.md)
