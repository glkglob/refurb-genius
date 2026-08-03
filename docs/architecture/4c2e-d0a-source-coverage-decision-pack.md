# 4C2E-D0A — Source Strategy and Coverage Decision Pack

```text
Status: 4C2E-D0A DECISION PACK COMPLETE (UNSIGNED)
Plan quality: PASS
Production readiness: BLOCKED
4C2E-D1: NOT AUTHORISED
Ticket: 4C2E-D0A (documentation and evidence preparation only)
Parent: 4c2e-d0-production-catalogue-publication-readiness-plan.md (merged, PR #102)
Base SHA: cb676d72239342a7af8a70435fd6f0b62ed4c60d
Branch: docs/4c2e-d0a-source-coverage-decision-pack
```

This pack converts the merged **4C2E-D0** readiness plan into concrete
**organisational decision worksheets** for Legal, Product, the Estimating SME,
and Engineering.

```text
Grok Build prepares structure and repository-confirmed defaults only.
Grok Build does NOT make legal decisions, approve sources, sign attestations,
create production rates, or authorise 4C2E-D1.
```

Evidence labels:

```text
[Repository-confirmed] — verified in code, schema, tests, or committed docs
[Reasoned recommendation] — planning proposal for human owners
[Unsigned] — requires named organisational sign-off
```

---

## 1. Status and purpose

### Purpose

| Goal | Outcome |
| --- | --- |
| Source strategy decisions | Worksheet + legal evidence checklist |
| Coverage freeze | Versioned coverage-profile contract |
| Contamination control | Blank QS attestation template |
| Pilot scope | Bounded unsigned proposal |
| Approvers / operators | Named role slots (blank) |
| Engineering readiness | Backlog only — **not implemented** |

### Status

```text
DECISION PACK READY FOR HUMAN APPROVAL (structure complete)
PRODUCTION READINESS: BLOCKED
4C2E-D1: remains blocked until signed decisions + independent gate verification
```

### Non-goals

```text
no legal approval by Grok Build
no production rate creation
no commercial cost-book copying
no supplier scraping
no production MANIFEST/snapshot
no catalogue persist/publish
no migrations
no production Supabase access
no reader or builder activation
no D1 implementation
```

---

## 2. Programme baseline

| Item | Value |
| --- | --- |
| Branch at D0A start | `main` |
| HEAD | `cb676d72239342a7af8a70435fd6f0b62ed4c60d` |
| D0 plan | `docs/architecture/4c2e-d0-production-catalogue-publication-readiness-plan.md` |
| D0 PR | #102 MERGED |
| B2 infrastructure | PR #101 MERGED |
| Production rates in repo | **None** (synthetic `mboq-2099.01.01` only) |
| Production path in code | `production: true` blocked; publish requires `licenceStatus = synthetic` only |

### Controlling principle (from D0)

```text
Infrastructure readiness ≠ legal approval ≠ product coverage approval
≠ production publication ≠ reader activation.
```

Completing this pack **does not** promote any organisational gate to PASS.

---

## 3. Decision authority

| Decision class | Owner | Grok Build role |
| --- | --- | --- |
| Legal / licence / redistribution | Legal | Structure only |
| Product coverage / pilot scope / thresholds | Product | Propose defaults only |
| Rate methodology / contamination attestation | Estimating SME | Template only |
| Technical publication / operators / env | Engineering lead + Ops | Backlog only |
| Business funding (QS build, OEM) | Leadership / Product | Options only |
| 4C2E-D1 authorisation | Explicit separate phase | **Not this phase** |

### Required human questions (by owner)

#### Legal

1. Which source classes are lawful for multi-tenant SaaS customer estimates?
2. What written evidence supports each approved class?
3. What attribution, retention, and termination rules apply?
4. What is the legal decision ID and review/expiry date?

#### Product

1. Confirm or reject blended source strategy recommendation?
2. Freeze pilot use case and excluded scopes?
3. Freeze `coverageProfileId` / version / mandatory keys / thresholds?
4. Name Product/coverage approver and Estimating SME?

#### Estimating SME

1. Will company-owned pilot rates be built under the contamination attestation?
2. Sign methodology and peer-review fields?
3. Confirm high-frequency key list and domain definitions?

#### Engineering / Ops

1. Name technical publication approver and production operators?
2. Bind production Supabase project identity allowlist?
3. Implement D1-P* backlog only after organisational gates close?

---

## 4. Source-strategy worksheet

### Decision values (use only these)

```text
APPROVED | REJECTED | DEFERRED | INSUFFICIENT EVIDENCE
```

### Repository-confirmed prefill (defaults only)

| Source class | Prefill | Authority |
| --- | --- | --- |
| Synthetic fixtures | **APPROVED** for **non-production only** | [Repository-confirmed] B1/B2 |
| Commercial books / desk-subscription harvest (BCIS desk, Spon’s, Laxton’s, bulk rekey) | **REJECTED** by default | D0 / 4C2E-A policy |
| Legacy `CATEGORY_BASE` / `TRADE_RATES` | **REJECTED** as measured-BOQ authority | D0 / L3 |
| AI-generated rates as “validated production” | **REJECTED** | D0 |
| All genuine production classes | **INSUFFICIENT EVIDENCE** until Legal/Product sign | D0 |

### 4.1 Company-owned QS build-ups

| Field | Value |
| --- | --- |
| Proposed use | Core unit rates for measured-BOQ authority |
| Source owner | Company |
| Data creator | [NAME REQUIRED] Estimating SME / QS |
| Acquisition method | First-party build-ups under written methodology |
| Ownership basis | Company work product (subject to Legal confirm) |
| Licence or contract reference | [REF REQUIRED — external vault only] |
| Multi-tenant SaaS redistribution right | [Legal outcome required] |
| Modification right | [Legal outcome required] |
| Customer-estimate display right | [Legal outcome required] |
| Territory | [e.g. UK — Legal/Product] |
| Customer class | [e.g. B2B SaaS tenants — Legal/Product] |
| Attribution | Internal method refs + `source_reference` per entry |
| Retention | [Legal] |
| Termination | [Legal] |
| Audit evidence | Methodology pack + contamination attestation + peer review |
| Contamination risk | **High** if rekeyed from commercial books |
| Decision owner | Legal + Product + Estimating SME |
| Legal outcome | **INSUFFICIENT EVIDENCE** |
| Product outcome | **INSUFFICIENT EVIDENCE** |
| Technical outcome | DEFERRED (tooling can store only after licence path) |
| Expiry/review date | [DATE REQUIRED] |

### 4.2 OGL construction indices

| Field | Value |
| --- | --- |
| Proposed use | Time/index adjustment factors (**not** unit rates) |
| Source owner | Public sector (dataset-specific) |
| Data creator | Publishing body |
| Acquisition method | Official published dataset retrieval |
| Ownership basis | OGL / open licence (dataset-specific Legal confirm) |
| Licence or contract reference | [REF REQUIRED — exact dataset + version] |
| Multi-tenant SaaS redistribution right | [Legal — do not assume from “public”] |
| Modification right | [Legal] |
| Customer-estimate display right | [Legal] |
| Territory | [Legal/Product] |
| Customer class | [Legal/Product] |
| Attribution | Exact OGL attribution wording [Legal] |
| Retention / Termination | [Legal] |
| Audit evidence | Retrieved snapshot hash + licence URL/version + retrieval date |
| Contamination risk | Low if used only as indices; high if used as unit rates |
| Decision owner | Legal |
| Legal / Product / Technical outcomes | **INSUFFICIENT EVIDENCE** / DEFERRED / DEFERRED |
| Expiry/review date | [DATE REQUIRED] |

### 4.3 Contracted supplier data

| Field | Value |
| --- | --- |
| Proposed use | Optional materials refresh |
| Source owner | Supplier |
| Data creator | Supplier |
| Acquisition method | Written contract feed only |
| Ownership / licence reference | [CONTRACT REF REQUIRED] |
| SaaS / modification / display rights | **Only as contracted** — [Legal] |
| Territory / customer class | [Legal] |
| Attribution / retention / termination | Per contract |
| Audit evidence | Signed schedule + feed version |
| Contamination risk | Medium (scope creep beyond contract) |
| Decision owner | Legal + Procurement + Product |
| Outcomes | **INSUFFICIENT EVIDENCE** |
| Expiry/review date | [DATE REQUIRED] |

### 4.4 Customer-derived aggregates

| Field | Value |
| --- | --- |
| Proposed use | Later calibration only (not first production pack) |
| Source owner | Customer / company process |
| Acquisition method | ToS-consented aggregates only |
| Rights | Privacy + ToS [Legal] |
| Risk | High (PII / confidential commercial) |
| Decision owner | Legal + Product |
| Outcomes | **DEFERRED** (not for first pilot) |
| Expiry/review date | [DATE REQUIRED] |

### 4.5 Commercial OEM data (e.g. BCIS OEM)

| Field | Value |
| --- | --- |
| Proposed use | Optional isolated licensed layer (later) |
| Source owner | Vendor |
| Acquisition method | Signed OEM only — **not** desk subscription |
| Rights | Per OEM schedule only |
| Risk | Medium (isolation / non-compete) |
| Decision owner | Legal + Finance + Product |
| Outcomes | **DEFERRED** / **INSUFFICIENT EVIDENCE** |
| Expiry/review date | [DATE REQUIRED] |

### 4.6 Commercial books or desk subscriptions

| Field | Value |
| --- | --- |
| Proposed use | **Forbidden backbone** |
| Prefill decision | **REJECTED** (default) |
| Rationale | Standard desk/book T&Cs do not grant multi-tenant SaaS redistribution without separate written licence |
| Override | Only with separate written licence granting SaaS display/redistribution/modification |
| Decision owner | Legal |
| Legal outcome | **REJECTED** (default) until explicit override evidence |
| Product / Technical | **REJECTED** |

### 4.7 Legacy application rate constants

| Field | Value |
| --- | --- |
| Proposed use | Not measured-BOQ authority |
| Prefill | **REJECTED** as measured-BOQ production authority |
| Decision owner | Engineering + Product |
| Outcomes | **REJECTED** |

### 4.8 AI-generated rates

| Field | Value |
| --- | --- |
| Proposed use | Dev/test only if labelled synthetic |
| Prefill | **REJECTED** as validated production authority |
| Decision owner | Engineering + Product + Legal (if ever reopened) |
| Outcomes | **REJECTED** for production |

### 4.9 Synthetic fixtures

| Field | Value |
| --- | --- |
| Proposed use | Local/CI technical validation only |
| Prefill | **APPROVED** non-production only |
| Production eligibility | **NOT APPLICABLE** |
| Decision owner | Engineering |
| Outcomes | **APPROVED** (non-production) |

### Overall source strategy (unsigned)

| Option | Description | Engineering recommendation | Org decision |
| --- | --- | --- | --- |
| A | Internal curated only | Viable core; limited long-term | [UNSIGNED] |
| B | OEM-first | Only after signed OEM | [UNSIGNED] |
| **C** | **Blended** (owned rates + OGL ± supplier ± later OEM) | **Recommended** | [UNSIGNED] |
| D | Block production rates | If neither A nor B funded | [UNSIGNED] |

```text
Strategy decision: [UNSIGNED — Legal + Product + Leadership]
Recommended (non-binding): C Blended
```

---

## 5. Legal evidence checklist

Before Legal may set a source class to **APPROVED**, the following must exist
**outside Git** (repository stores **references only**):

| # | Evidence | Required | Reference field in repo |
| --- | ---: | --- | --- |
| 1 | Named legal decision ID | Yes | `legalDecisionId` |
| 2 | Exact dataset or source name | Yes | decision record |
| 3 | Source version | Yes | decision record |
| 4 | Contract or ownership reference | Yes | vault path / matter ID |
| 5 | Permitted SaaS multi-tenant use | Yes | decision record |
| 6 | Permitted redistribution | Yes | decision record |
| 7 | Permitted modification | Yes | decision record |
| 8 | Territory | Yes | decision record |
| 9 | Customer classes | Yes | decision record |
| 10 | Attribution wording | Yes | decision record |
| 11 | Retention obligations | Yes | decision record |
| 12 | Termination consequences (incl. retirement) | Yes | decision record |
| 13 | Review or expiry date | Yes | decision record |
| 14 | Named legal approver | Yes | decision record |

```text
Do not commit confidential licence text, full contracts, or supplier credentials.
```

### Legal decision record shell (external)

```text
legalDecisionId:     [ID REQUIRED]
decisionDate:        [DATE REQUIRED]
sourceClass:         [CLASS]
dataset/version:     [REQUIRED]
evidenceRefs:        [VAULT PATHS ONLY]
saasUse:             [YES/NO + text]
redistribution:      [YES/NO + text]
modification:        [YES/NO + text]
territory:           [REQUIRED]
customerClasses:     [REQUIRED]
attribution:         [REQUIRED]
retention:           [REQUIRED]
termination:         [REQUIRED]
outcome:             APPROVED | REJECTED | DEFERRED | INSUFFICIENT EVIDENCE
legalApprover:       [NAME REQUIRED]
reviewDate:          [DATE REQUIRED]
```

---

## 6. Contamination-attestation template

**Status:** blank template — Grok Build must not sign.

### Identifiers

| Field | Value |
| --- | --- |
| Attestation ID | [ID REQUIRED] |
| Related `legalDecisionId` | [ID REQUIRED] |
| Related pilot / package revision (if any) | [mboq-… or N/A] |
| Coverage profile ID/version | [REQUIRED when rates exist] |

### Build-up metadata

| Field | Value |
| --- | --- |
| Rate build-up author | [NAME REQUIRED] |
| Methodology owner | [NAME REQUIRED] |
| Calculation date | [DATE REQUIRED] |
| Labour assumptions | [TEXT REQUIRED] |
| Materials assumptions | [TEXT REQUIRED] |
| Plant assumptions | [TEXT REQUIRED] |
| Waste assumptions | [TEXT REQUIRED] |
| Overheads assumptions | [TEXT REQUIRED] |
| Regional basis | [e.g. uk-region-multipliers-v1 national base] |
| VAT basis | exclusive |
| Currency | GBP |
| Indexation basis | [NONE / OGL dataset ref — Legal approved only] |
| Source references | [LIST — line-level] |
| Commercial-book contamination review | [PASS/FAIL + notes] |
| Third-party spreadsheet review | [PASS/FAIL + notes] |
| AI-generation disclosure | [NONE / DESCRIBE — production forbids AI-as-validated] |
| Peer-review identity | [NAME REQUIRED] |
| Exceptions | [NONE / LIST] |
| Sign-off date | [DATE REQUIRED] |
| Expiry / review date | [DATE REQUIRED] |

### Required attestation statement

```text
The submitted unit-rate build-ups were created from authorised
first-party methods and approved source inputs and were not bulk
rekeyed, copied or derived from unlicensed commercial cost books.
```

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Build-up author | [NAME REQUIRED] | [BLANK] | [BLANK] |
| Methodology owner | [NAME REQUIRED] | [BLANK] | [BLANK] |
| Peer reviewer | [NAME REQUIRED] | [BLANK] | [BLANK] |
| Estimating SME | [NAME REQUIRED] | [BLANK] | [BLANK] |

---

## 7. Coverage-profile contract

### Versioned profile fields

| Field | Required | Notes |
| --- | --- | --- |
| `coverageProfileId` | Yes | Stable id, e.g. `mboq-cov-uk-res-refurb` |
| `coverageProfileVersion` | Yes | Semver or date stamp; **denominator version** |
| `effectiveDate` | Yes | Profile effective date |
| `owner` | Yes | Product owner role |
| `pilotOrProduction` | Yes | `pilot` \| `production` |
| `propertyUseCase` | Yes | Named use case string |
| `mandatoryDomains` | Yes | Ordered list |
| `mandatoryRateKeys` | Yes | **Exact denominator list** |
| `optionalRateKeys` | Yes | May be empty |
| `highFrequencyRateKeys` | Yes | Subset of mandatory (or explicit list) |
| `excludedScopes` | Yes | Explicit exclusions |
| `regionalBasis` | Yes | Must align catalogue contract |
| `unitRules` | Yes | Canonical units only |
| `costTypeRules` | Yes | labour \| materials \| combined |
| `recencyRules` | Yes | Max age of `effective_from` |
| `deprecatedKeyRules` | Yes | Replacement required? |
| `replacementKeyRules` | Yes | Target must exist |
| `approvalStatus` | Yes | UNSIGNED until Product signs |
| `approvers` | Yes | Product + SME (+ Legal if required) |

### Formulas (binding)

```text
denominator = exact set of mandatoryRateKeys in coverageProfileVersion V

numerator = count of keys in denominator that are present in the candidate
            package as status=active, valid unit/cost_type, positive rate,
            and (for production) non-empty source_reference

overall_coverage = numerator / |denominator|

domain_coverage(D) =
  |mandatory keys in D present and valid| /
  |mandatory keys in D|

high_frequency_completeness =
  |HF keys present and valid| / |HF keys|

source_reference_completeness =
  entries_with_nonempty_source_reference / entryCount
```

```text
No percentage may be reported without:
  coverageProfileId + coverageProfileVersion + |denominator| + numerator.
```

### Placeholder profile (unsigned)

```text
coverageProfileId:      mboq-cov-uk-res-refurb-pilot
coverageProfileVersion: 0.0.0-UNSIGNED
effectiveDate:          [DATE REQUIRED]
owner:                  [NAME REQUIRED]
pilotOrProduction:      pilot
propertyUseCase:        UK residential internal refurbishment (standard)
mandatoryDomains:       [see §9 — PROPOSED]
mandatoryRateKeys:      [EXACT LIST REQUIRED — not frozen]
optionalRateKeys:       []
highFrequencyRateKeys:  [EXACT LIST REQUIRED — not frozen]
excludedScopes:         [see §10]
regionalBasis:          uk-region-multipliers-v1
unitRules:              m2 | m | item | hr | day only
costTypeRules:          labour | materials | combined
recencyRules:           effective_from age ≤ 365 days (proposed)
deprecatedKeyRules:     0 deprecated without valid replacement
replacementKeyRules:    target in same package, ≠ self
approvalStatus:         UNSIGNED
approvers:              [NAME REQUIRED]
```

---

## 8. Proposed thresholds

**These are proposed engineering/product defaults. They are not approved product requirements.**

| Metric | Proposed pilot | Proposed production | Rationale | Exceptions | Warning | Blocking | Decision owner | Approval state | Approval date | Review date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Overall mandatory keys | ≥ **0.80** | ≥ **0.95** | D0 default | Written Product waiver bound to identity | 0.05 below target | Below target | Product | **UNSIGNED** | — | — |
| Per mandatory domain | ≥ **0.70** | ≥ **0.90** | D0 default | Domain waiver | 0.05 below | Below target | Product + SME | **UNSIGNED** | — | — |
| High-frequency named lines | **100%** | **100%** | Pilot usability | None recommended | N/A | Any miss | Product + SME | **UNSIGNED** | — | — |
| Source-reference completeness | **1.00** | **1.00** | Production contract | None | N/A | Any miss | Engineering + Product | **UNSIGNED** | — | — |
| Rate recency (`effective_from`) | ≤ **365** days | ≤ **365** days | Freshness default | Long-lived rates only with SME waiver | 300–365 days | >365 without waiver | Product + SME | **UNSIGNED** | — | — |
| Invented / fallback rates | **0** | **0** | Authority integrity | None | N/A | Any | Engineering | **UNSIGNED** (policy locked in D0) | — | — |
| Prohibited sources | **0** | **0** | Legal | None | N/A | Any | Legal | **UNSIGNED** (default REJECTED sources) | — | — |

Long-lived rates older than 365 days: **blocking** unless an explicit SME/Product waiver is bound to the package identity.

---

## 9. Candidate domain taxonomy

**Status: PROPOSED — PRODUCT AND SME SIGN-OFF REQUIRED**

Canonical units for catalogue: `m2` | `m` | `item` | `hr` | `day`.  
Cost types: `labour` | `materials` | `combined`.

| Domain | Definition | Included work (examples) | Excluded work (examples) | Overlap | Safety/compliance | Expected units | Expected cost types | Product owner | SME owner | Pilot | Production |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| kitchen | Kitchen fit-out and associated finishes | Units, worktops, basic plumbing connections | Full electrical rewire (→ electrical) | plumbing, decoration | Medium | item, m, m2 | combined, labour, materials | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| bathroom | Bathroom fit-out and wet areas | Suite, tiling, sanitary | Structural waterproofing engineering | plumbing, decoration, damp | Medium | item, m2 | combined, materials, labour | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| flooring | Floor finishes | Carpet, LVT, timber finish | Structural floor joists | decoration | Low–Med | m2 | materials, combined | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| decoration | Surface finishes | Paint, wallpaper, preparation | Fire-stopping specialty | plastering | Low–Med | m2 | labour, materials, combined | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| electrical | Fixed electrical works | Rewire, consumer unit, points | Grid connection / DNO | — | **High** | item, hr, day | labour, combined | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| plumbing | Domestic plumbing | Pipework, fittings, basic appliances | Gas safe specialist isolation edge cases | heating, kitchen, bathroom | **High** | item, m, hr | labour, combined | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| heating | Heat generation/distribution | Boiler swap, radiators | Full system design certification pack | plumbing | **High** | item | combined, labour | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| roofing | Roof covering repairs | Tiles, felt, flashings (minor) | Major structural roof redesign | structural | Medium | m2, day | combined, labour | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| structural | Structural alterations | Lintels, basic openings (if in scope) | Full SE design packages | roofing | **High** | item, day | combined, labour | [NAME REQUIRED] | [NAME REQUIRED] | Often **excluded** from pilot | PROPOSED later |
| damp | Damp treatment | Tanking, injection (standard) | Specialist survey-led remediation | bathroom | Medium | item, m2 | combined | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| garden | External soft/hard soft landscaping | Patio, fencing minor | Major earthworks | — | Low | m2, day | combined | [NAME REQUIRED] | [NAME REQUIRED] | Optional pilot | PROPOSED |
| windows_doors | Openings joinery | Windows, external doors | Curtain walling | structural | Medium | item | combined | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| plastering | Plaster/board finish | Skim, board | Fire compartmentation design | decoration | Medium | m2 | labour, materials | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |
| carpentry | First/second fix timber | Doors internal, skirtings | Structural timber design | windows_doors | Low–Med | m, item | labour, materials | [NAME REQUIRED] | [NAME REQUIRED] | PROPOSED | PROPOSED |

### Omitted / ambiguous domains (raise with Product)

| Topic | Note |
| --- | --- |
| Hazardous materials (asbestos, lead) | **Excluded** from pilot; compliance-critical — separate programme |
| Gas / solid fuel certification | Overlaps heating; may need explicit domain |
| Insulation / energy retrofit | Not in D0 list — product decision |
| Demolition / strip-out | Often labour day rates — product decision |
| Scaffolding / access | Plant/day — product decision |
| Fire safety systems | Safety-critical — do not omit silently if product sells it |

Domain list remains **PROPOSED — PRODUCT AND SME SIGN-OFF REQUIRED**.

---

## 10. Pilot-scope proposal

**Status: UNSIGNED — Product + SME + Legal (source) required**

### Recommended planning target

```text
Standard internal refurbishment of a typical UK residential property,
excluding structural engineering, hazardous-material remediation,
major external works and specialist listed-building work.
```

### Assumptions

| Field | Proposal (unsigned) |
| --- | --- |
| Property type | Existing UK residential dwelling (e.g. 2–3 bed terrace/semi) |
| Included rooms | Kitchen, bathroom, living, bedrooms, hall/stairs (internal) |
| Included trades | Subset of §9 domains marked pilot PROPOSED, excluding structural by default |
| Included work categories | Finish and fit-out works listed in frozen `mandatoryRateKeys` only |
| Excluded scopes | Structural engineering design; asbestos/lead; major external works; listed-building specialist; commercial new-build; gas DNO; party wall awards |
| Regional basis | National base + engine regional multipliers (`uk-region-multipliers-v1`) |
| Effective-date requirement | Explicit `effective_from` on revision |
| Rate-recency requirement | ≤ 365 days unless waiver |
| Source-reference requirement | 100% of entries when `production: true` |
| Minimum coverage | Overall ≥ 0.80 and HF 100% under signed pilot profile |
| Unsupported-work behaviour | Explicit gap in evidence; **no invented fallback rates** |
| Runtime activation | **None** — publication verification only if ever authorised |

### Supported vs unsupported (illustrative until keys freeze)

| Supported (examples) | Unsupported (must gap) |
| --- | --- |
| Wall decoration m2 | Structural beam design |
| Floor finish m2 | Asbestos removal |
| Kitchen fit item | Major roof rebuild |
| Bathroom fit item | Listed-building conservation |
| Basic rewire item | Scaffolding hire packages |

Exact `rate_key` strings: **[EXACT LIST REQUIRED — not frozen in D0A]**.

---

## 11. Approval and operator matrix

Do not invent names. All signatory fields are blank.

| Role | Name | Role authority | System access | Conflict-of-interest check | Approval scope | Expiry/review | Backup |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Legal/source approver | [NAME REQUIRED] | Approve/reject source classes | Legal vault (external) | [PASS/FAIL REQUIRED] | Licence, SaaS rights, attribution | [DATE REQUIRED] | [NAME REQUIRED] |
| Product/coverage approver | [NAME REQUIRED] | Freeze coverage + pilot | Product docs | [PASS/FAIL REQUIRED] | Profile, thresholds, pilot | [DATE REQUIRED] | [NAME REQUIRED] |
| Estimating SME | [NAME REQUIRED] | Methodology + rates quality | Method packs | [PASS/FAIL REQUIRED] | Attestation, HF keys, domain defs | [DATE REQUIRED] | [NAME REQUIRED] |
| Technical publication approver | [NAME REQUIRED] | Technical gate for publish | Repo + staging secrets (controlled) | [PASS/FAIL REQUIRED] | Validation, identity, env | [DATE REQUIRED] | [NAME REQUIRED] |
| Primary production operator | [NAME REQUIRED] | Execute controlled runbook | Production secrets (allowlisted) | [PASS/FAIL REQUIRED] | Persist/publish ops only when authorised | [DATE REQUIRED] | Secondary operator |
| Secondary production operator | [NAME REQUIRED] | Backup operator | Same as primary | [PASS/FAIL REQUIRED] | Same | [DATE REQUIRED] | Primary |
| Incident commander | [NAME REQUIRED] | Contain bad publication | Ops + eng | [PASS/FAIL REQUIRED] | Retire/rollback incidents | [DATE REQUIRED] | [NAME REQUIRED] |
| Security contact | [NAME REQUIRED] | Credential / env incidents | Security tooling | [PASS/FAIL REQUIRED] | Secrets, access | [DATE REQUIRED] | [NAME REQUIRED] |
| Change-management approver | [NAME REQUIRED] | Production change window | Change system | [PASS/FAIL REQUIRED] | Migration deploy + publish window | [DATE REQUIRED] | [NAME REQUIRED] |

### Dual-approval rule (from D0)

```text
Legal/source + Product/coverage + Technical publication
must not all be the same person unless written small-team exception.
```

---

## 12. Approval identity

### Minimum immutable approval identity

| Field | Role | How approved |
| --- | --- | --- |
| `catalogRevision` | Content + package identity | Direct |
| `manifestVersion` | Governance | Direct or via `inputChecksum` |
| `schemaVersion` | Governance | Direct or via `inputChecksum` |
| `sourceId` | Source identity | Direct |
| `inputChecksum` | Raw package (MANIFEST + snapshot bytes) | Direct — covers many governance fields |
| `contentChecksum` | Canonical validated content | Direct |
| `entryCount` | Content cardinality | Direct |
| `normaliserVersion` | Transform identity | Direct |
| `effectiveFrom` | Price-basis date | Direct (also content if in snapshot) |
| `coverageProfileId` | Coverage governance | Direct |
| `coverageProfileVersion` | Denominator version | Direct |
| `legalDecisionId` | Legal governance | Direct |

### Classification

| Class | Fields |
| --- | --- |
| Content identity | `contentChecksum`, `entryCount`, snapshot-bound `effectiveFrom` / rates |
| Package / input identity | `inputChecksum`, `catalogRevision`, `sourceId`, `normaliserVersion` |
| Governance identity | `manifestVersion`, `schemaVersion`, `coverageProfileId/Version`, `legalDecisionId` |
| Database identity | Internal UUIDs (`revision_id`, `package_id`) — **not** substitute for package identity |

```text
Any change to a binding field invalidates all prior approvals.
Approvals must be re-issued against the new identity.
```

---

## 13. Engineering gap backlog

**Implement nothing in D0A.** Provisional ticket labels:

| Ticket | Purpose | Owner | Dependencies | Security boundary | Expected files (indicative) | Test strategy | Blocking gate | Explicit exclusions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **D1-P1** | Production licence-status model (`approved` path) | Engineering | Legal decision IDs exist | Fail closed; no auto-approve | manifestTypes, dry-run policy, persist/publish RPC policy | unit + pgTAP | Legal APPROVED source | No rates |
| **D1-P2** | Approved production MANIFEST contract fields | Engineering | D1-P1 | No secrets in MANIFEST | parseCatalogueManifest, schema docs | parser tests | Legal + Product refs | No rates |
| **D1-P3** | Production-policy validation end-to-end | Engineering | D1-P1/P2 | service_role RPC only | app + RPC | multi-session | Legal | No browser write |
| **D1-P4** | Coverage calculator | Engineering | Signed coverage profile | Read package only | new pure module + CLI flag | unit tests vs golden profile | Product freeze | No invent keys |
| **D1-P5** | Approval-identity checker | Engineering | Dual approvals process | Offline or server check; no secret leakage | checker module | unit tests | Named approvers | No auto-sign |
| **D1-P6** | Cross-revision semantic diff | Engineering | Prior published revision | Offline report | diff tool | fixtures | Product thresholds | No auto-publish |
| **D1-P7** | Environment/project allowlist | Engineering/Ops | Named production project | Fail closed | config + verifier | env tests | Ops identity | No default prod |
| **D1-P8** | Typed production confirmation | Engineering | D1-P7 | Interactive confirm revision+checksum | ops entrypoint | e2e staging | Operators named | No `--yes` default |
| **D1-P9** | Evidence-bundle writer | Engineering | Publish path | No secrets/rate dumps | reports writer | unit tests | Technical approver | No licence text |
| **D1-P10** | Staging publication drill harness | Engineering | D1-P1–P9 | Staging only | scripts/tests | automated drill | Staging env | No production |
| **D1-P11** | Production migration-deployment verifier | Engineering/Ops | Change management | Read-only deploy evidence | runbook + check | checklist automation | CM approver | No silent migrate |
| **D1-P12** | Operator authorisation check | Engineering/Ops | Operator matrix | Access control | allowlist | access tests | Named operators | No shared creds |

---

## 14. Dependency graph

```text
source strategy decision (Legal + Product + Leadership)
  → ownership/licence evidence (Legal)
  → contamination attestation (Estimating SME)
  → pilot scope (Product + SME)
  → coverage profile freeze (Product + SME)
  → named approvers/operators (all owners)
  → engineering production-path implementation (D1-P*)
  → independent verification
  → staging drill
  → production migration verification
  → D1 publication authorisation (separate phase)
```

```text
No step auto-authorises the next.
```

---

## 15. Gate-status matrix

Expected after D0A: **no new organisational gate becomes PASS** merely because this pack exists.

| Gate | State | Notes |
| --- | --- | --- |
| Lawful source class | **BLOCKED** | Unsigned |
| Redistribution evidence | **BLOCKED** | External Legal |
| Contamination attestation | **BLOCKED** | Template only |
| Methodology approval | **BLOCKED** | SME unsigned |
| Pilot scope | **BLOCKED** | Proposed only |
| Coverage profile | **BLOCKED** | 0.0.0-UNSIGNED |
| Exact denominator | **BLOCKED** | Keys not frozen |
| Threshold approval | **BLOCKED** | Defaults unsigned |
| Source-reference policy | **BLOCKED** for production pack | Policy known; pack absent |
| Named approvers | **BLOCKED** | Placeholders only |
| Named operators | **BLOCKED** | Placeholders only |
| Production project identity | **NOT VERIFIED** | Ops |
| Migration deployment evidence | **NOT VERIFIED** | Ops |
| Production licence path | **BLOCKED** | Engineering D1-P1 |
| Coverage calculator | **BLOCKED** | D1-P4 |
| Approval checker | **BLOCKED** | D1-P5 |
| Environment allowlist | **BLOCKED** | D1-P7 |
| Cross-revision gates | **BLOCKED** | D1-P6 |
| Staging drill | **BLOCKED** | D1-P10 |
| Incident/retirement drill | **BLOCKED** | Ops tabletop |
| B2 infrastructure | **PASS** | Not sufficient for D1 |
| Synthetic non-production path | **PASS** | Technical only |
| Reader separation maintained | **PASS** | No activation in D0A |
| This decision pack exists | **PASS** | Structure only |

---

## 16. Required human actions

| # | Owner | Action | Done when |
| ---: | --- | --- | --- |
| 1 | Leadership + Product + Legal | Sign source strategy (A/B/C/D) | Decision record filed |
| 2 | Legal | Complete evidence checklist per approved class | `legalDecisionId` issued |
| 3 | Estimating SME | Build rates only under approved sources; sign attestation | Attestation signed |
| 4 | Product + SME | Freeze coverage profile version + exact keys | Profile approvalStatus signed |
| 5 | Product | Sign thresholds table | Approval state filled |
| 6 | Product + SME | Sign pilot scope | Pilot UNSIGNED → signed |
| 7 | All owners | Name approvers/operators | Matrix names filled |
| 8 | Engineering lead | Authorise D1-P* implementation only after 1–7 | Separate ticket authorisation |
| 9 | Ops | Verify production project + migration deploy evidence | NOT VERIFIED → evidence |
| 10 | All | Do **not** treat this pack alone as production approval | D1 still blocked |

---

## 17. Acceptance criteria

### D0A documentation acceptance

```text
[x] clean main baseline at D0 merge
[x] decision worksheets for all source classes
[x] repository-confirmed prefill only where safe
[x] no false APPROVED for real production sources
[x] legal evidence checklist (reference-only)
[x] blank contamination attestation
[x] versioned coverage-profile contract + exact denominator rule
[x] thresholds visibly unsigned
[x] domains PROPOSED not frozen
[x] bounded pilot proposal
[x] blank approver/operator slots
[x] expanded approval identity
[x] engineering backlog without implementation
[x] gate matrix without false organisational PASS
[x] D1 remains blocked
```

### What does **not** count as acceptance

```text
existence of this document ≠ source approval
blank names filled by agent ≠ operator authorisation
proposed thresholds ≠ product requirements
```

---

## 18. Final recommendation

```text
D0A: DECISION PACK COMPLETE (structure)
PRODUCTION READINESS: BLOCKED
4C2E-D1: NOT AUTHORISED

NEXT ACTIONS (humans only):
  Legal, Product and the Estimating SME must complete and sign this pack.
  Grok Build cannot approve these decisions.

Engineering may begin D1-P* implementation only after explicit separate
authorisation and after organisational gates required as dependencies close.
```

### Leadership checklist (carry-forward)

| # | Decision | Options |
| ---: | --- | --- |
| 1 | Source strategy | A / B OEM / **C Blended (recommended)** / D block |
| 2 | Fund internal QS build | Yes / No |
| 3 | Pursue commercial OEM | Yes / No / Later |
| 4 | Freeze pilot coverageProfile | Sign / defer |
| 5 | Name dual approvers + operators | Assign / defer |

---

## Appendix A — Prohibited sources (unchanged from D0)

```text
BCIS data obtained through a standard desk subscription
Spon’s price-book tables
Laxton’s price-book tables
bulk rekeying of commercial cost books
scraped supplier websites
unlicensed third-party spreadsheets
AI-generated rates represented as externally validated rates
legacy CATEGORY_BASE or TRADE_RATES promoted as measured-BOQ authority
```

## Appendix B — High-frequency line placeholders (not rate keys)

Until Product freezes exact `rate_key` strings, treat as **intent only**:

```text
decoration wall finish m2
flooring floor finish m2
bathroom wall tile m2
kitchen fit-out item
bathroom fit-out item
electrical rewire item
plumbing basic item
```
