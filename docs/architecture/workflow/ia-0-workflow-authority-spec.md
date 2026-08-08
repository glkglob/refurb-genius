# IA-0 — Workflow Authority, Provenance, State, Resolver, Design & Trust Specification

| Field                   | Value              |
| ----------------------- | ------------------ |
| **Status**              | **LOCKED**         |
| **Version**             | **1.0.1**          |
| **Programme**           | Refurb Genius      |
| **Applies to**          | IA-1 through IA-10 |
| **Architecture status** | CLOSED             |

**Controlling journey:**

> **Photos → Analysis → Redesign → Estimate → Export**

## Authority

This document is the canonical workflow specification for the Refurb Genius IA programme.

IA-1 through IA-10 **MUST NOT** introduce conflicting workflow, Scope, provenance, resolver, entitlement, navigation, design or trust semantics.

## Change rule

If implementation requires changing a locked IA-0 rule, **STOP** and request architecture review rather than changing the rule implicitly.

## Version history

| Version   | Status | Note                                                                                                                                                                          |
| --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.0**   | LOCKED | Initial locked workflow authority specification.                                                                                                                              |
| **1.0.1** | LOCKED | Clarifies resolver semantics for canonical Scope reconciliation and In-progress stage continuation. No change to the five-stage workflow or product information architecture. |

---

# Refurb Genius — Final IA-0 Workflow Authority, Provenance, State, Resolver, Design & Trust Plan

**Programme:** Refurb Genius  
**Phase:** IA-0  
**Status:** **LOCKED**  
**Version:** **1.0.1**  
**Architecture status:** **CLOSED**  
**Controlling journey:** **Photos → Analysis → Redesign → Estimate → Export**

This specification is the controlling contract for the Refurb Genius project journey. It formalises workflow authority, currentness, invalidation, navigation continuation, AI trust, commercial behaviour, design and legacy convergence before implementation begins.

Normative terminology:

- **MUST / MUST NOT** — binding.
- **SHOULD / SHOULD NOT** — expected unless evidence justifies otherwise.
- **MAY** — permitted but optional.

---

# 1. Document control

IA-0 is the authoritative workflow specification for IA-1 through IA-10.

It inherits the previously locked:

- information architecture;
- global navigation;
- project-container model;
- five-stage journey;
- canonical Scope authority;
- Redesign position;
- Export terminology;
- mobile principle;
- monetisation principle;
- Design & Look principles;
- AI trust principles.

Implementation phases MUST conform to IA-0 and MUST NOT create divergent workflow rules.

Material changes to:

- stage order;
- workflow authority;
- Scope ownership;
- provenance semantics;
- invalidation rules;
- resolver precedence;
- entitlement progression

require explicit architecture review.

Implementation details not affecting these contracts MAY evolve within later phases.

---

# 2. Locked product principle

Refurb Genius MUST operate as one continuous, project-centred refurbishment decision workflow.

Customer journey:

> **Show us the property → understand it → reimagine it → price it → produce the result.**

Canonical product journey:

> **Photos → Analysis → Redesign → Estimate → Export**

The product MUST NOT feel like separate tools connected only by menus.

Project Overview is the project home and status surface.

It is **not** a sixth stage or “Stage 0”.

---

# 3. Locked information architecture

## 3.1 Global navigation

Global navigation is limited to:

1. **Dashboard**
2. **Projects**
3. **New Analysis**
4. **Deal Copilot**
5. **Trades / Marketplace**
6. **Settings**

Project stages MUST remain inside project context and MUST NOT be promoted into the global navigation.

---

## 3.2 Projects is canonical

**Projects** is the canonical property/project workspace.

“Studies”:

- MUST NOT remain an equal top-level product concept;
- MAY temporarily remain as a compatibility route, filtered Projects view or legacy label;
- SHOULD ultimately converge under Projects.

---

## 3.3 Selected project structure

```text
PROJECT
│
├── Overview
│   ├── Property identity
│   ├── Current workflow status
│   ├── Five-stage progress
│   ├── Key metrics
│   └── Continue where you left off
│
└── PRIMARY JOURNEY
    ├── 1. Photos
    ├── 2. Analysis
    ├── 3. Redesign
    ├── 4. Estimate
    └── 5. Export
```

The active project identity MUST remain clear across project routes.

---

## 3.4 Route mapping

| Product concept    | Route                               |
| ------------------ | ----------------------------------- |
| Dashboard          | `/dashboard`                        |
| New Analysis       | `/analyze`                          |
| Project Overview   | `/projects/$id`                     |
| Photos             | `/projects/$id/upload`              |
| Analysis           | `/projects/$id/analysis`            |
| Redesign           | `/projects/$id/redesign`            |
| Estimate           | `/projects/$id/estimate`            |
| Professional Scope | `/projects/$id/scope`               |
| Export             | `/projects/$id/report`              |
| Deal Copilot       | `/deal-copilot` + contextual access |
| Settings           | `/settings`                         |

`/projects/$id/redesign` is the only required new first-class workflow route.

No broad TanStack routing migration is authorised.

`/report` MAY remain the implementation route while **Export** is the customer-facing stage name.

---

# 3.5 Project creation simplicity

Project creation MUST be deliberately lightweight.

## Minimum requirement

Only one field is required:

- **Name**

A valid project name alone MUST be sufficient to:

1. create a durable project identity;
2. establish its canonical project ID;
3. enter project context;
4. make Photos immediately available.

Preferred continuation:

```text
Create project
→ durable project ID
→ /projects/$id/upload
→ Photos
```

## Optional fields

Creation MAY also collect:

- Address / postcode
- Property type
- Notes

These fields:

- MUST remain optional;
- MUST NOT block project creation;
- MAY be added or amended later.

Additional optional metadata MAY be introduced only if it preserves the lightweight-entry principle.

## Project creation MUST NOT require

- Photos
- Analysis
- Redesign
- Scope / Works
- Estimate
- Export
- Payment or upgrade solely to establish a project
- Complex multi-step onboarding
- Completion of optional property metadata

## Entitlement interaction

The basic ability to create a project identity SHOULD remain available without forcing an upgrade solely to enter the workflow.

Legitimate plan limits MAY exist for:

- maximum project count;
- storage;
- AI usage;
- advanced capabilities.

If a plan limit prevents project creation, that limit MUST be communicated explicitly.

It MUST NOT be disguised as missing property data or additional onboarding requirements.

## Validation

Validation SHOULD be minimal:

- non-empty valid project name;
- reasonable existing field constraints.

Validation MUST NOT expand into unnecessary upfront property-data collection.

## Failure behaviour

Project creation MUST be durable before progression occurs.

If creation fails:

- the product MUST NOT claim success;
- Photos MUST NOT open using a provisional/non-durable identity;
- a recoverable error MUST be shown;
- entered information SHOULD be preserved for retry where practical.

## UX

The creation experience SHOULD normally fit on one lightweight surface.

Example:

> **New Project**  
> Project name \*  
> Address / postcode — optional  
> Property type — optional
>
> **Create Project & Add Photos**

Project creation is an entry action, not another workflow stage.

---

# 3.6 New Analysis

`/analyze` is an entry orchestrator only.

```text
New Analysis
→ Create/select project
→ Photos
→ remain within /projects/$id/...
```

It MUST NOT implement an independent Analysis, Redesign, Estimate or Export workflow.

---

# 3.7 Deal Copilot context

Deal Copilot remains:

- globally available;
- contextually available within projects.

Within `/projects/$id/...`, contextual project identity MUST come from `$id`.

An ambiguous globally stored “selected project” MUST NOT override the active route identity.

---

# 3.8 Explicit non-goals

IA-0 does not authorise:

- broad repository restructuring;
- mass route migration;
- another Scope model;
- separate paid-plan navigation;
- a second workflow-state authority;
- page-local next-action logic;
- UI-owned invalidation;
- wholesale design-system replacement.

---

# 4. Five-stage workflow contracts

Each workflow stage MUST define:

- prerequisites;
- Ready;
- In progress;
- Complete;
- Needs attention;
- primary action;
- recovery action;
- upstream authority;
- authoritative output.

A stored output alone does not establish Complete.

---

## 4.1 Photos

### Purpose

Capture durable evidence of the real property.

### Upstream authority

Project identity.

### Output

Current durable project photo catalogue.

### Ready

Photos is Ready when:

- a valid project exists;
- photo mutations are authorised;
- no blocking mutation is underway.

### In progress

When a required photo operation is:

- uploading;
- validating;
- persisting;
- removing;
- replacing.

### Complete

At least one durable current project photo exists.

No mandatory “all rooms photographed” heuristic is introduced at IA-0.

Photo coverage quality MAY later be advisory.

Example:

> 4 photos uploaded.  
> Add the kitchen and bathroom for a more complete analysis.

It MUST NOT hard-block progression unless separately authorised later.

### Needs attention

A photo operation has failed and requires intervention.

Existing successful photos remain valid where unaffected.

### Actions

No photos:

> **Add Photos**

Photos available:

> **Analyse Photos**

### Mutation ownership

Photo add/remove/replace use-cases own catalogue mutation.

Successful catalogue mutations MUST change catalogue identity.

Failed mutations MUST NOT advance it.

---

# 4.2 Analysis

### Purpose

Understand the current property using the current photo catalogue.

### Upstream authority

Current photo catalogue fingerprint/revision.

### Output

Persisted Analysis authority.

### Blocked

Analysis cannot progress when:

- no durable photos exist;
- required photo mutation is unresolved;
- user lacks permission.

### Ready

Analysis is Ready when:

- current photos exist;
- no valid current Analysis covers them;
- no Analysis operation is active.

### In progress

A required analysis/update operation is running.

### Complete

Analysis is Complete only when:

1. valid persisted Analysis exists;
2. it covers the complete authorised current photo catalogue;
3. recorded photo-catalogue identity matches current identity;
4. required provenance is valid;
5. it is genuine authoritative output rather than mock/demo fallback.

### Needs attention

For example:

- photos changed;
- analysis covers an older catalogue;
- catalogue coverage is incomplete;
- required provenance is missing/invalid.

### Actions

Ready:

> **Analyse Photos**

Stale:

> **Update Analysis**

### Failure/recovery policy

**Atomic authoritative replacement.**

New Analysis MUST become authoritative only after complete valid persistence.

If regeneration fails:

- partial results MUST NOT become Complete;
- historical Analysis MAY remain stored;
- stale Analysis MUST remain non-current;
- downstream stages remain non-current.

---

# 4.3 Redesign

### Purpose

Select the intended refurbishment direction based on current Analysis.

### Upstream authority

Current Analysis revision.

### Outputs

- generated candidate concepts;
- one authoritative selected Redesign.

### Ready

Redesign is Ready when:

- Analysis is current;
- no authoritative selection exists for that Analysis;
- required Redesign operation is not active.

### In progress

A required generation or selection persistence operation is active.

Optional generation of alternative concepts SHOULD NOT invalidate an existing current selected Redesign.

### Complete

Redesign is Complete only when:

1. a concept has been deliberately selected/accepted;
2. the selection is durably persisted;
3. it references current Analysis;
4. its authority remains current.

Generated options alone do not establish Complete.

### Needs attention

When:

- Analysis changes;
- selected Redesign references older Analysis;
- selected authority otherwise becomes invalid.

### Actions

No concept:

> **Create Redesign**

Concepts exist but none selected:

> **Select Redesign**

Gated:

> **Unlock Redesign**

Stale:

> **Update Redesign**

### Failure/recovery policy

**Preserve existing current selected authority until successful replacement, unless its upstream Analysis changed.**

If a new optional concept generation fails while current Analysis is unchanged, an existing selected Redesign remains current.

If Analysis changes, that selected Redesign is non-current regardless of generation success.

---

# 4.4 Estimate

### Purpose

Price the intended refurbishment.

### Upstream authority

Current canonical Scope revision.

### Output

Persisted Estimate authority.

### Blocked

Estimate cannot become Ready until:

- Analysis is current;
- required Redesign is selected/current;
- Scope is current/reconciled;
- relevant entitlement is satisfied.

### Ready

A current Scope exists but no current Estimate corresponds to it.

### In progress

Required Estimate calculation/persistence is underway.

### Complete

Estimate is Complete only when:

1. valid persisted Estimate exists;
2. it records the current Scope revision;
3. that revision matches current Scope authority;
4. persistence completed successfully.

### Needs attention

For example:

- Scope changes;
- Redesign changes and Scope is reconciled;
- stored Estimate references an older Scope.

### Actions

Ready:

> **Build Estimate**

Stale:

> **Update Estimate**

### Failure/recovery policy

**Atomic publication.**

Partial Estimate output MUST NOT become authoritative.

Where upstream Scope has changed, previous Estimate is automatically non-current.

Where inputs remain identical and a refresh fails, an existing valid Estimate MAY remain current.

---

# 4.5 Export

### Purpose

Produce a durable useful project output.

### Upstream authority

Current Estimate revision plus required project/report identity.

### Output

Current Export/report snapshot.

### Ready

Current Estimate exists but no current Export corresponds to it.

### In progress

Required current report generation is underway.

### Complete

Export is Complete only when:

1. report/export snapshot exists;
2. generation succeeded;
3. it records current Estimate authority;
4. that recorded Estimate revision still matches.

Clicking Download does not establish completion.

### Needs attention

When Estimate authority changes after the snapshot was generated.

### Actions

Ready:

> **Create Report**

Stale:

> **Update Report**

Complete:

> **View / Export Report**

### Failure/recovery policy

**Atomic snapshot publication.**

Failed regeneration MUST NOT destroy an old report.

However, an old report based on a superseded Estimate MUST be clearly non-current.

---

# 5. Canonical Scope / Works authority

There is exactly one canonical Scope / Works authority.

```text
Current Analysis findings
        +
Current selected Redesign intent
        +
Accepted professional edits
        ↓
Canonical Scope / Works
        ↓
Estimate
```

## Analysis contributes

- condition;
- observed problems;
- recommended works;
- evidence.

## Redesign contributes

- chosen refurbishment outcome;
- replacement decisions;
- design/specification intent.

## Existence versus currentness

An existing Scope is not necessarily a current Scope.

Example:

```text
Scope S4
derived from Analysis A4 + Redesign R2

Redesign becomes R3

S4 still exists
but is no longer current.
```

Estimate MUST NOT remain Complete against S4.

## Professional editing

`/projects/$id/scope` edits the same canonical authority.

It MUST NOT create a parallel professional Scope.

## Reconciliation

Changes to Analysis or selected Redesign require Scope reconciliation.

Reconciliation MAY be automatic when deterministic.

Material user-controlled decisions SHOULD remain reviewable.

### Resolver continuation for non-current Scope (IA-0-CL1)

When current Analysis or selected Redesign changes such that the canonical Scope
is no longer current, the shared next-action resolver MUST use the contract in
**§9.1 Scope reconciliation continuation**. Summary:

| Field          | Binding value                                                                       |
| -------------- | ----------------------------------------------------------------------------------- |
| **stage**      | `estimate` (customer-facing resolver stage; Scope is **not** a sixth journey stage) |
| **status**     | Needs attention                                                                     |
| **actionKind** | `reconcile_scope`                                                                   |
| **route**      | `/projects/$id/estimate`                                                            |
| **label**      | Review Scope                                                                        |

`/projects/$id/scope` remains the professional/advanced editor of the **same**
canonical Scope authority and MUST NOT become the primary sixth-stage
continuation.

---

# 6. Workflow status model

User-facing vocabulary is restricted to:

- **Not started**
- **Ready**
- **In progress**
- **Needs attention**
- **Complete**

Indicative mapping:

| Internal condition | UI status             |
| ------------------ | --------------------- |
| blocked            | Not started / waiting |
| not_started        | Not started           |
| ready              | Ready                 |
| running            | In progress           |
| stale              | Needs attention       |
| invalid_upstream   | Needs attention       |
| failed_recoverable | Needs attention       |
| current            | Complete              |

Exact internal enum names are implementation-dependent.

The semantics are not.

## Exists ≠ Complete

A persisted output whose upstream authority no longer matches is not Complete.

Legacy `*_done` booleans MUST NOT override provenance.

Technical reasons SHOULD be translated into user language.

Prefer:

> **Analysis needs updating because your photos changed.**

Not:

> input fingerprint mismatch.

---

# 7. Provenance and revision identity

IA-0 requires the minimum provenance needed to prove currentness.

It MUST NOT introduce a generic workflow/versioning platform merely for architectural elegance.

Canonical chain:

```text
Photo catalogue
      ↓
Analysis
      ↓
Redesign
      ↓
Scope
      ↓
Estimate
      ↓
Export
```

## Photo catalogue

Must expose a deterministic current identity.

It MUST:

- remain stable when effective catalogue content is unchanged;
- change when a durable photo is added;
- change when removed;
- change when authoritative photo content is replaced;
- not rely solely on temporary/signed URLs;
- not depend on presentation ordering.

Implementation MAY use a deterministic hash or equivalent stable representation.

## Analysis provenance

At minimum:

- `input_photo_catalogue_fingerprint`
- Analysis authority identity/revision

## Redesign provenance

At minimum:

- `input_analysis_revision`
- selected Redesign identity
- selected Redesign authority revision

Generating an unselected candidate MUST NOT advance selected-Redesign authority.

## Scope provenance

At minimum:

- `input_analysis_revision`
- `input_redesign_revision`
- Scope revision

Material professional edits MUST advance Scope authority.

## Estimate provenance

At minimum:

- `input_scope_revision`
- Estimate revision

## Export provenance

At minimum:

- `input_estimate_revision`
- Export/report identity or revision

## Universal currentness rule

```text
CURRENT =
output exists
AND
recorded upstream authority matches current upstream authority
AND
stage-specific validity requirements pass
```

---

# 8. Invalidation graph + mutation ownership

Invalidation belongs to authoritative mutations.

The resolver only observes resulting state.

| Mutation                 | Owner                       | Authority consequence                                               |
| ------------------------ | --------------------------- | ------------------------------------------------------------------- |
| Add/remove/replace photo | Photo mutation use-case     | Photo revision changes; Analysis and downstream cease being current |
| Publish Analysis         | Analysis use-case           | Analysis revision advances; downstream currentness re-evaluated     |
| Select/change Redesign   | Redesign selection use-case | Redesign revision advances; Scope/Estimate/Export non-current       |
| Reconcile/edit Scope     | Scope use-case              | Scope revision advances; Estimate/Export non-current                |
| Publish/update Estimate  | Estimate use-case           | Estimate revision advances; Export non-current                      |
| Publish Export           | Export use-case             | New snapshot becomes current against Estimate                       |

Required cascade:

```text
PHOTO CHANGE
→ Analysis non-current
→ Redesign non-current
→ Scope non-current
→ Estimate non-current
→ Export non-current
```

```text
ANALYSIS CHANGE
→ Redesign non-current
→ Scope non-current
→ Estimate non-current
→ Export non-current
```

```text
REDESIGN SELECTION CHANGE
→ Scope requires reconciliation
→ Estimate non-current
→ Export non-current
```

```text
SCOPE CHANGE
→ Estimate non-current
→ Export non-current
```

```text
ESTIMATE CHANGE
→ Export non-current
```

The following MUST NOT own invalidation:

- Dashboard;
- Project Overview;
- navigation components;
- PipelineChecklist;
- resolver;
- route effects.

---

# 9. Canonical next-action resolver

There MUST be one shared continuation decision system.

Conceptually:

```ts
resolveProjectNextAction(projectWorkflowState, entitlements);
```

Return contract:

```ts
{
  stage,
  status,
  actionKind,
  route,
  label,
  reason,
  entitlementRequirement?
}
```

## Stable `actionKind`

Semantic actions include at minimum:

```text
add_photos

analyse_photos
update_analysis

create_redesign
select_redesign
update_redesign
unlock_redesign

reconcile_scope

build_estimate
update_estimate

create_export
update_export

view_stage_progress

view_completed_project
```

UI text MAY change.

Components MUST NOT derive behaviour by parsing labels.

Labels are presentation only. Consumers MUST NOT infer action semantics from labels.

## Resolver precedence

Canonical stage order for evaluation remains:

```text
Photos → Analysis → Redesign → Estimate → Export
```

The resolver evaluates authoritative dependencies from earliest to latest.

Binding precedence:

1. Earliest required upstream stage that is **non-current / Needs attention**.
2. Otherwise earliest required stage that is **In progress**.
3. Otherwise earliest incomplete **Ready** stage.
4. Apply entitlement behaviour to that exact required stage.
5. Never skip a required gated stage.
6. Only when all required authorities are current return completed-project behaviour.

Example:

```text
Analysis = stale
Redesign = stored
Estimate = stored
Export = stored
```

Required result:

> **Analysis → Update Analysis** (`update_analysis`)

Not Estimate or Export.

Additional precedence examples (IA-0-CL1):

```text
Analysis = Needs attention
Estimate = In progress
→ Analysis wins (update_analysis)
```

```text
Redesign required but incomplete
Estimate = In progress
→ Redesign wins
```

```text
Estimate = In progress
historical Export exists
→ Estimate / In progress / view_stage_progress
```

If two stages are unexpectedly recorded as In progress simultaneously:

the **earliest** stage in canonical order wins.

The resolver does not attempt to resolve or mutate concurrency. It only reports
deterministic continuation.

## Entitlement precedence

If Redesign is logically next but gated:

```text
stage = redesign
actionKind = unlock_redesign
```

The resolver MUST NOT skip to Estimate.

## §9.1 Scope reconciliation continuation

Scope remains an **internal dependency authority feeding Estimate**.

Scope is **NOT** a sixth primary customer-facing workflow stage.

When current Analysis or selected Redesign changes such that the canonical Scope
is no longer current:

| Field          | Binding value                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **stage**      | `estimate`                                                                                                                 |
| **status**     | Needs attention                                                                                                            |
| **actionKind** | `reconcile_scope`                                                                                                          |
| **route**      | `/projects/$id/estimate`                                                                                                   |
| **label**      | Review Scope                                                                                                               |
| **reason**     | The canonical Scope must be reconciled with the current Analysis and selected Redesign before Estimate can become current. |

Binding semantics:

1. Scope remains an internal dependency authority.
2. Scope is **not** added to the five-stage customer journey.
3. The customer-facing resolver stage remains **Estimate**.
4. `/projects/$id/estimate` is the canonical customer continuation route.
5. `/projects/$id/scope` remains the professional/advanced editor of the **same** canonical Scope authority.
6. A professional secondary action MAY navigate to `/projects/$id/scope`.
7. The primary resolver MUST NOT make `/scope` a sixth-stage continuation.
8. `reconcile_scope` is **distinct** from `update_estimate`.
9. `reconcile_scope` applies while Scope itself is non-current.
10. `update_estimate` applies only after Scope is current/reconciled and the existing Estimate is non-current against that current Scope.
11. `build_estimate` applies only when Scope is current and no current Estimate exists.

Required Estimate-family precedence:

```text
Scope non-current
→ reconcile_scope

Scope current + no Estimate
→ build_estimate

Scope current + stale Estimate
→ update_estimate
```

These cases MUST NOT be collapsed.

For resolver precedence, treat a non-current required Scope as an **Estimate-stage
dependency failure**. Therefore:

```text
Current Redesign + Scope non-current
→ stage: estimate
  status: Needs attention
  actionKind: reconcile_scope
  route: /projects/$id/estimate
  label: Review Scope
```

`reconcile_scope` MUST win over:

- `build_estimate`;
- `update_estimate`;
- `create_export`;
- `update_export`;
- completed-project action.

An earlier upstream broken Analysis or Redesign dependency still wins over Scope
reconciliation:

```text
Analysis stale + Scope stale
→ update_analysis
NOT reconcile_scope
```

## §9.2 In-progress continuation

When the resolver's earliest authoritative workflow stage is already performing
its required operation, the resolver MUST return:

| Field          | Binding value                                         |
| -------------- | ----------------------------------------------------- |
| **stage**      | the running workflow stage                            |
| **status**     | In progress                                           |
| **actionKind** | `view_stage_progress`                                 |
| **route**      | the canonical route for that stage                    |
| **label**      | stage-appropriate progress label                      |
| **reason**     | the required stage operation is currently in progress |

Examples:

| Running stage                    | stage      | status      | actionKind            | route                                   | label                  |
| -------------------------------- | ---------- | ----------- | --------------------- | --------------------------------------- | ---------------------- |
| Photos                           | `photos`   | In progress | `view_stage_progress` | `/projects/$id/upload`                  | View Upload Progress   |
| Analysis                         | `analysis` | In progress | `view_stage_progress` | `/projects/$id/analysis`                | View Analysis Progress |
| Redesign (pre–IA-4 transitional) | `redesign` | In progress | `view_stage_progress` | `/projects/$id/analysis?focus=redesign` | View Redesign Progress |
| Estimate                         | `estimate` | In progress | `view_stage_progress` | `/projects/$id/estimate`                | View Estimate Progress |
| Export                           | `export`   | In progress | `view_stage_progress` | `/projects/$id/report`                  | View Report Progress   |

After IA-4, Redesign MAY use its canonical first-class route according to the
then-current IA contract.

### Navigational-only CTA semantics

`view_stage_progress` is **NAVIGATIONAL ONLY**.

It MUST NOT:

- restart the operation;
- invoke AI;
- duplicate an upload;
- regenerate Redesign;
- rebuild Estimate;
- regenerate Export;
- mutate database state;
- set completion flags;
- perform invalidation.

The CTA remains enabled when the stage surface is safely navigable.

Its purpose is to return the user to the stage where the active operation can be
inspected.

It is **not** the initiating action.

Therefore:

- Analysis running MUST NOT return `analyse_photos`;
- Estimate running MUST NOT return `build_estimate`;
- Export running MUST NOT return `create_export`;

unless those operations are no longer running and the state has returned to Ready
(or another non-running status).

## Purity

The resolver MUST NOT:

- mutate database state;
- set completion flags;
- invalidate records;
- invoke AI;
- generate outputs;
- navigate;
- trigger analytics or other side effects.

`view_stage_progress` and `reconcile_scope` are **decision outputs** only. They do
not themselves perform navigation, Scope mutation, or operation restart. Consumers
render and navigate; authoritative mutations remain with their owning use-cases.

## Consumers

The same resolver MUST drive:

- Dashboard Continue;
- Project Overview;
- stage-end CTAs;
- mobile sticky CTA;
- empty states;
- stale recovery;
- post-action continuation.

No page may implement a second next-action algorithm.

---

# 10. AI trust + failure/recovery semantics

General principle:

> **AI proposes → user can inspect → user confirms where material → authority advances.**

AI output MUST NOT be represented as verified truth when it is inherently probabilistic.

---

## Analysis

Must remain traceable to actual project photos.

New Analysis authority is published atomically.

Failed partial generation MUST NOT become current.

---

## Redesign

Must be presented as:

> **A proposed refurbishment concept**

not:

> **A guaranteed construction design**

The product SHOULD preserve or clearly communicate:

- windows;
- doors;
- geometry;
- major structural features;
- original perspective.

Original and proposed views SHOULD be readily comparable.

Generated options are candidates.

The selected option is authority.

---

## Estimate

Estimate MUST make its basis inspectable, including where available:

- Analysis;
- selected Redesign;
- Scope items;
- quantities;
- materials;
- labour;
- assumptions;
- contingency;
- VAT/markup where applicable.

AI-assisted pricing MUST NOT be described as guaranteed final construction cost.

---

## Export

Export must identify the current state represented by the snapshot.

Old snapshots MAY remain historically accessible but MUST NOT appear current.

---

## Failure versus invalidation

Failure and stale authority are distinct.

Example:

```text
R5 is current.
User generates another optional design.
Generation fails.
Analysis unchanged.

R5 remains current.
```

But:

```text
R5 is based on A5.
Photos change.
Analysis later becomes A6.

R5 is non-current.
```

A failed attempt does not determine currentness.

Upstream authority does.

---

# 11. Design, responsive & accessibility contract

Workflow UI MUST converge on the existing design-system foundations, including:

- `src/docs/design-system.md`
- `COMPONENT_STANDARDS.md`

Existing suitable primitives SHOULD be reused.

No parallel design language should be introduced.

## Visual character

Target:

> **Calm, premium, serious UK proptech SaaS**

Characteristics:

- strong typography;
- disciplined spacing;
- clean cards;
- restrained emerald emphasis;
- semantic tokens;
- generous but controlled whitespace;
- low visual noise;
- first-class dark mode.

## Workflow hierarchy

Every project surface SHOULD prioritise:

```text
Property identity
↓
Current stage / progress
↓
Primary stage content
↓
Single dominant next action
↓
Secondary / advanced actions
```

## Single primary action

There SHOULD be one visually dominant workflow CTA.

Examples:

- Add Photos
- Analyse Photos
- Create Redesign
- Select Redesign
- Build Estimate
- Create Report
- Update Analysis
- Update Estimate
- Update Report

Secondary actions remain subordinate.

## Status presentation

Status MUST combine:

- wording;
- icon;
- semantic visual treatment.

Colour MUST NOT be the sole status signal.

“Needs attention” SHOULD be clear without unnecessarily alarming treatment.

## Desktop

Desktop should retain:

- compact global navigation;
- stable project header;
- persistent five-stage navigation.

A horizontal project-stage navigator is the preferred direction unless usability evidence supports another compact approach.

## Mobile

Global mobile model:

> **Home | Projects | + New | Copilot | More**

Inside a project:

- stage progress takes priority;
- next action SHOULD be sticky/easily reachable;
- global navigation becomes secondary;
- users MUST NOT open a hamburger/global menu merely to progress.

## Responsive acceptance

Validate at minimum:

- narrow mobile;
- standard phone;
- tablet;
- desktop;
- light mode;
- dark mode;
- content wrapping;
- stage overflow;
- sticky CTA behaviour.

## Accessibility

Accessibility is a release gate.

Required:

- keyboard navigation;
- visible focus;
- semantic labels;
- sufficient contrast;
- touch-safe targets;
- screen-reader-compatible status;
- non-colour-only meaning;
- reduced-motion support where relevant.

---

# 12. Commercial / entitlement behaviour

Every tier follows:

> **Photos → Analysis → Redesign → Estimate → Export**

Product tiers change depth and allowance, not IA.

| Capability | Basic             | Pro           | Refurb IQ / Professional |
| ---------- | ----------------- | ------------- | ------------------------ |
| Photos     | Standard limits   | Higher limits | Portfolio/commercial     |
| Analysis   | Core              | Detailed      | Professional depth       |
| Redesign   | Limited/allowance | Full concepts | Advanced controls        |
| Estimate   | Indicative        | Detailed      | BOQ/commercial           |
| Export     | Basic             | Professional  | Advanced outputs         |

Exact pricing and allowances are outside IA-0.

## Gated-stage rule

A required gated stage remains visible.

Example:

> Redesign — Ready  
> **Unlock Redesign**

It MUST NOT:

- disappear;
- silently skip;
- route to a later downstream stage.

## Commercial trust

Commercial UX SHOULD provide:

- transparent pricing;
- clear usage limits;
- clear credits where used;
- explicit renewals;
- understandable cancellation;
- clear project/data retention;
- no unexpected post-work paywall;
- clear export entitlement before the user invests substantial work.

---

# 13. Acceptance and negative test matrix

These cases become the initial workflow resolver/invariant test contract.

**actionKind** is authoritative. Labels are presentation only.

| Scenario                                                   | Stage                     | Status          | actionKind               | Route                                              | Label                  |
| ---------------------------------------------------------- | ------------------------- | --------------- | ------------------------ | -------------------------------------------------- | ---------------------- |
| Valid project name only                                    | Photos                    | Ready           | `add_photos`             | `/projects/$id/upload`                             | Add Photos             |
| Project name + no optional metadata                        | Photos                    | Ready           | `add_photos`             | `/projects/$id/upload`                             | Add Photos             |
| No photos                                                  | Photos                    | Ready           | `add_photos`             | `/projects/$id/upload`                             | Add Photos             |
| Required photo upload active                               | Photos                    | In progress     | `view_stage_progress`    | `/projects/$id/upload`                             | View Upload Progress   |
| Current photos, no Analysis                                | Analysis                  | Ready           | `analyse_photos`         | `/projects/$id/analysis`                           | Analyse Photos         |
| Analysis running                                           | Analysis                  | In progress     | `view_stage_progress`    | `/projects/$id/analysis`                           | View Analysis Progress |
| Analysis stale after photo mutation                        | Analysis                  | Needs attention | `update_analysis`        | `/projects/$id/analysis`                           | Update Analysis        |
| Current Analysis, no Redesign                              | Redesign                  | Ready           | `create_redesign`        | transitional Analysis Redesign surface             | Create Redesign        |
| Concepts exist, none selected                              | Redesign                  | Ready           | `select_redesign`        | transitional Analysis Redesign surface             | Select Redesign        |
| Redesign gated                                             | Redesign                  | Ready           | `unlock_redesign`        | transitional Analysis Redesign surface             | Unlock Redesign        |
| Redesign operation running                                 | Redesign                  | In progress     | `view_stage_progress`    | `/projects/$id/analysis?focus=redesign` (pre–IA-4) | View Redesign Progress |
| Redesign changes → Scope non-current                       | **Estimate**              | Needs attention | `reconcile_scope`        | `/projects/$id/estimate`                           | Review Scope           |
| Scope reconciled/current + no Estimate                     | Estimate                  | Ready           | `build_estimate`         | `/projects/$id/estimate`                           | Build Estimate         |
| Scope reconciled/current + Estimate references older Scope | Estimate                  | Needs attention | `update_estimate`        | `/projects/$id/estimate`                           | Update Estimate        |
| Estimate running                                           | Estimate                  | In progress     | `view_stage_progress`    | `/projects/$id/estimate`                           | View Estimate Progress |
| Current Estimate, no Export                                | Export                    | Ready           | `create_export`          | `/projects/$id/report`                             | Create Report          |
| Estimate changes after Export                              | Export                    | Needs attention | `update_export`          | `/projects/$id/report`                             | Update Report          |
| Export running                                             | Export                    | In progress     | `view_stage_progress`    | `/projects/$id/report`                             | View Report Progress   |
| All authorities current                                    | Completed project         | Complete        | `view_completed_project` | project Overview / report per convention           | View Project           |
| Analysis Needs attention + Estimate running                | Analysis                  | Needs attention | `update_analysis`        | `/projects/$id/analysis`                           | Update Analysis        |
| Two stages marked running                                  | earliest in journey order | In progress     | `view_stage_progress`    | that stage's canonical route                       | stage progress label   |
| Analysis stale + Scope stale                               | Analysis                  | Needs attention | `update_analysis`        | `/projects/$id/analysis`                           | Update Analysis        |

## Required negative assertions

- Missing address MUST NOT block project creation.
- Missing property type MUST NOT block project creation.
- Project creation MUST NOT require photos.
- Successful project creation MUST NOT leave the user searching for Photos.
- Stale Analysis MUST NOT return Redesign.
- Generated-but-unselected Redesign MUST NOT be Complete.
- Gated Redesign MUST NOT be skipped.
- Stale Scope MUST NOT make Estimate Complete.
- Stale Scope MUST NOT return `update_estimate` or `build_estimate` (must return `reconcile_scope` at Estimate stage).
- Stale Estimate MUST NOT make Export Complete.
- Stale Export MUST NOT appear current.
- Running stage MUST NOT return its initiating actionKind (`analyse_photos`, `build_estimate`, `create_export`, etc.).
- Earlier Needs attention MUST beat later In progress.
- Earliest simultaneous running stage in canonical order MUST win.
- Legacy `*_done` flags MUST NOT override provenance.
- Resolver MUST NOT mutate state.
- Dashboard/pages MUST NOT override resolver precedence.
- Primary resolver MUST NOT treat `/projects/$id/scope` as a sixth-stage continuation.

## Failure tests

Tests SHOULD prove:

- failed project creation does not create provisional workflow context;
- failed upload leaves existing successful photos intact;
- failed re-analysis publishes no partial authority;
- failed candidate Redesign generation preserves a current selection when upstream remains unchanged;
- failed Estimate regeneration publishes no partial Estimate;
- failed Export refresh preserves old snapshot;
- preserved historical outputs become non-current when their upstream revision changes.

---

# 14. Implementation programme and quality gates

## IA-0 — Specification

This document.

No broad implementation.

## IA-1 — Shared project workflow shell

Implement:

- project identity;
- five-stage navigation;
- status presentation;
- canonical workflow-state representation.

## IA-2 — Canonical next-action resolver

Implement:

- pure resolver;
- `actionKind` (including `reconcile_scope` and `view_stage_progress` per §9.1–§9.2);
- precedence (Needs attention → In progress → Ready);
- entitlement behaviour;
- executable test matrix.

IA-2 implements continuation **decision** logic only. It MUST NOT invent Scope
reconciliation mutation, provenance persistence, or first-class Redesign routes.

## IA-3 — Photos → Analysis continuity

Target:

```text
Create Project
→ Add Photos
→ Photos saved
→ Analyse Photos
→ Analysis
```

No navigation dead end.

## IA-4 — First-class Redesign

**Status: Completed on main** (PR #116; atomic selection, write-path seal, schema reconcile).

Implements:

`/projects/$id/redesign`

with:

- Analysis context;
- concept generation;
- explicit selection;
- comparison;
- truthfulness;
- durable single selected authority bound by `analysis_identity`;
- database uniqueness and sealed selection write path.

## IA-5 — Full five-stage continuity

**Status: Completed on main** (PR #117; verified implementation head `81299098f730340062c3e662a07b06b95a22c533`; merge SHA `21ce580a225a44614c63414c3382f561d640ec95`; migrations `20260808120000` / `20260808130000` / `20260808140000`; production Estimate category-authority + Export snapshot after PDF + all-current resolver `view_completed_project` re-verified under IA-5-MR1 Production Estimate Authority Runtime Configuration Repair).

Proved:

> **Photos → Analysis → Redesign → Estimate → Export**

including stale recovery (bounded production photo invalidation → Analysis non-current / `update_analysis` earliest action).

## IA-6 — Dashboard + Overview

**Status: Completed on main** (PR #119; verified implementation head `02e802ccc837ad26b63d65e82582ea84c9fa05c6`; merge SHA `2d83375209e266e5953e0edd71de3e8b16a92574`; no database migrations).

Proved on Dashboard and Project Overview:

- canonical continuation via `useProjectFiveStageWorkflow` → `composeProjectWorkflowState` → `resolveProjectNextAction`;
- durable state parity with the resolver (including legacy `*_done` flags non-authoritative);
- transient in-progress continuation (`view_stage_progress`) via project-scoped operation registry (non-authoritative; does not survive full page refresh without a durable job identity).

Residual carried from IA-5 (Overview / Photos `progressFromProjectFlags` presentation) is closed for IA-6 target surfaces.

## IA-7 — Global navigation convergence

**Status: Completed on main** (PR #120; verified implementation head `d401a895ea9d3bc4cbcaa3b12734bf4fee16464d`; merge SHA `e8678f638e1f697908705b816d58562a5bcbe10c`; no database migrations; production deployment `dpl_Bt1net31pNBzSxXoWnkEKo1hKEnY` on `www.refurbgenius.info` serving merged main).

Proved:

- one canonical `GLOBAL_NAV_ITEMS` authority with exact six destinations:
  Dashboard `/dashboard`, Projects `/projects`, New Analysis `/analyze`,
  Deal Copilot `/deal-copilot`, Trades / Marketplace `/trades`, Settings `/settings`;
- desktop Sidebar six-item IA; mobile bounded More menu (Deal Copilot, Settings, Sign out)
  without implementing IA-8 final mobile architecture;
- `/analyze` as canonical Project-entry form (shared `NewProjectEntry`); durable Project
  before `/projects/$id/upload`; Projects becomes global context after entry;
- Studies demoted / distinct / compatibility-only (`/studies`, `/studies/workspace` precedence);
- selected-project five-stage workflow remains separate under Projects; IA-5 / IA-6 unchanged.

## IA-8 — Mobile refinement

**Status: Planned / Next** — requires explicit authorisation.

- compact mobile navigation (target form refinement beyond IA-7 reachability);
- project progress;
- sticky primary action;
- responsive accessibility.

## IA-9 — Scope / Estimate professional depth

Add deeper:

- quantities;
- materials;
- labour;
- assumptions;
- professional Scope editing;
- BOQ/commercial depth.

Maintain one Scope authority.

## IA-10 — Export + commercial refinement

Add:

- full project report;
- estimate PDF;
- Scope export;
- before/after;
- sharing;
- tiered export depth;
- entitlement UX;
- currentness handling.

---

## Phase quality gates

Every implementation phase MUST pass appropriate:

**Functional**

- intended workflow works.

**Authority**

- currentness is correct.

**Navigation**

- next action is deterministic.

**Design**

- visual hierarchy conforms.

**Mobile**

- flow works without desktop assumptions.

**Accessibility**

- accessibility acceptance passes.

**AI trust**

- generated output is represented accurately.

**Architecture**

- ownership and public API boundaries remain intact.

**Regression**

- previously working flows remain valid.

**Scope containment**

- no unrelated restructuring enters the phase.

A phase MUST NOT pass solely because the UI renders.

---

# 15. Legacy convergence and specification decisions

## Existing `*_done` flags

May remain temporarily.

They:

- MUST NOT be sole workflow authority;
- MUST NOT override provenance;
- SHOULD ultimately become derived compatibility projections or be retired.

Long-lived dual authority is prohibited.

## Existing PipelineChecklist

The current shorter pipeline MUST converge on:

> **Photos → Analysis → Redesign → Estimate → Export**

Permitted:

- extend;
- refactor;
- replace while migrating consumers.

Not permitted:

- maintaining an independent three-stage workflow authority.

## Existing embedded Redesign behaviour

May remain operational during IA-1 through IA-3 to avoid unrelated disruption.

IA-4 establishes the first-class Redesign route.

The old and new surfaces MUST NOT establish competing selected-Redesign authorities.

## `/report`

May remain the route.

**Export** remains the product stage.

## Studies

May survive temporarily for compatibility.

Projects remains canonical.

## Transitional behaviour before IA-4

Existing production behaviour MAY continue.

However:

- IA-1 through IA-3 MUST NOT establish a permanent Analysis → Estimate architecture;
- Redesign remains part of the locked target dependency chain;
- temporary compatibility behaviour MUST NOT become a second contract.

## No implementation-defined authority

During migration there MUST NOT be:

- route-owned workflow truth;
- UI-owned invalidation;
- duplicated Scope authority;
- duplicated selected-Redesign authority;
- a second continuation resolver.

---

# IA-0 completion criteria

IA-0 is complete only when:

- project creation semantics are unambiguous;
- project creation remains lightweight;
- five-stage state semantics are unambiguous;
- Ready/In progress/Complete/Needs attention rules are defined;
- currentness is objectively testable;
- minimum provenance is defined;
- invalidation ownership is assigned;
- Scope authority is singular;
- resolver signature is deterministic;
- `actionKind` is included (including `reconcile_scope` and `view_stage_progress`);
- Scope reconciliation continuation is explicit without making Scope a sixth stage;
- In-progress continuation is navigational-only (`view_stage_progress`);
- resolver precedence is deterministic (Needs attention → In progress → Ready);
- resolver purity is binding;
- entitlement behaviour is deterministic;
- gated stages cannot be skipped;
- AI trust rules are defined;
- failure versus invalidation behaviour is defined;
- operation recovery policies are selected;
- design/mobile/accessibility requirements are recorded;
- legacy convergence is defined;
- acceptance and negative tests are defined;
- subsequent implementation phases do not need to invent missing workflow semantics.

---

# Final programme status

```text
IA-0 STATUS:
LOCKED — Version 1.0.1

CLARIFICATIONS APPLIED:
IA-0-CL1 — reconcile_scope + view_stage_progress

PRODUCT DIRECTION:
LOCKED

INFORMATION ARCHITECTURE:
LOCKED

PROJECT CREATION CONTRACT:
LOCKED
Name only required.
Optional metadata cannot block creation.

PROJECT WORKSPACE:
LOCKED

CUSTOMER JOURNEY:
LOCKED
Photos → Analysis → Redesign → Estimate → Export

WORKFLOW STATE CONTRACT:
LOCKED

PROVENANCE / CURRENTNESS CONTRACT:
LOCKED

INVALIDATION + MUTATION OWNERSHIP:
LOCKED

CANONICAL SCOPE AUTHORITY:
LOCKED
(not a sixth customer-facing stage)

NEXT-ACTION RESOLVER:
LOCKED
Includes reconcile_scope and view_stage_progress

RESOLVER PRECEDENCE + PURITY:
LOCKED
Needs attention → In progress → Ready

AI TRUST + FAILURE/RECOVERY:
LOCKED

DESIGN / RESPONSIVE / ACCESSIBILITY:
LOCKED

COMMERCIAL / ENTITLEMENT MODEL:
LOCKED

LEGACY CONVERGENCE:
LOCKED

BROAD ROUTE / REPOSITORY REWRITE:
NOT AUTHORISED

PROGRAMME (as of IA-0-CL1):
IA-1 — COMPLETED ON MAIN
IA-2 — PLANNED / UNBLOCKED AFTER IA-0-CL1 MERGES TO MAIN
         (not started; requires explicit implementation authorisation)

NEXT IMPLEMENTATION PHASE AFTER THIS CLARIFICATION MERGES:
IA-2 — CANONICAL NEXT-ACTION RESOLVER
```

## Controlling implementation statement

> **Refurb Genius has one lightweight entry point, one project identity, one five-stage customer journey and one workflow truth. A user can create a project with only a name and immediately begin Photos. From there, every stage advances through authoritative current state: real Photos drive Analysis, current Analysis drives selected Redesign, Analysis plus Redesign drive one canonical Scope, Scope drives Estimate, and the current Estimate drives Export. Every continuation surface uses the same pure resolver, and no stored result is Complete unless its provenance matches current upstream authority.**
