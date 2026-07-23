# Priority 1.12 — Shared capability boundaries

What each platform capability owns vs what applications own.

---

## AI

| Shared package (target: `packages/ai`) | Application owns |
|----------------------------------------|------------------|
| Provider abstraction | Prompts |
| Retries, timeouts, rate limiting | Response schemas (product) |
| Cost tracking, usage logging | Interpretation of results |
| Prompt registry (infrastructure) | Workflows (when to call vision/chat) |
| Response validation (transport-level) | User experience |
| Provider failover | Product-specific model choice policy |

**Today:** app `src/platform/openai`, `huggingface`; pure helpers may live in `@repo/services/ai`.  
**Rule:** package executes requests; apps decide what results mean.

---

## Authentication

| Platform | Application |
|----------|-------------|
| Users, sessions | Product-specific gates (e.g. “must have a project”) |
| Organisations / memberships | Signup marketing UX |
| Permissions / entitlements plumbing | Role labels in product copy |
| Account management primitives | Auth presentation feature |

**Today:** `@repo/supabase` + app auth hooks/serverFns + feature `auth` presentation.

---

## Billing

| Platform | Application |
|----------|-------------|
| Plans, limits, feature flags | How “upgrade” is presented |
| Usage quotas | Checkout UX (`features/payment`) |
| Webhook verification plumbing | Product paywalls copy |

Applications **consume** availability; they do not implement payment ledgers.

---

## Documents

| Platform | Application |
|----------|-------------|
| Uploads, metadata, storage paths | Document meaning (what a “report” is) |
| Permissions, signed URLs | Analysis pipelines |
| Processing status | Presentation, product reports |

---

## Notifications

| Platform | Application |
|----------|-------------|
| Email/SMS/push adapters | When to notify (product events) |
| Delivery status | Template content / branding |

---

## Storage

| Platform | Application |
|----------|-------------|
| Bucket helpers, path conventions | Which entity a file belongs to in UX |
| Public vs private URL helpers | Gallery/photo product flows |

**Today:** `lib/photos`, `services/storage` — candidates for `packages/storage`.

---

## Organisations

| Platform | Application |
|----------|-------------|
| Tenant model, membership | Org admin product screens |
| Workspace switcher data | Product-specific workspace semantics |

---

## Projects (shared entity — careful)

| Platform (only if multi-app true share) | Application |
|------------------------------------------|-------------|
| Shared identity fields, IDs | Refurbishment project wizard |
| Cross-product links | Estimates, studies, analysis rows |

**Do not assume every app shares one “Project”.** Prefer:

```
Workspace
  ├── Refurbishment Project
  ├── Future product record
  └── Future product record
```

Introduce shared Project only when products collaborate on the same object.

---

## Audit

| Platform | Application |
|----------|-------------|
| Append-only event write/read | Which product actions are audited |
| Actor/resource schema | Admin console UX |

---

## Reporting / documents export

| Shared package | Application feature |
|----------------|---------------------|
| PDF rendering, templates, export infra, print layout | Report content, sections, business data, permissions, branding |

---

## Data ownership (three categories)

### Platform data

users · organisations · memberships · subscriptions · audit · notifications · files (blob metadata)

### Application data

estimates · projects (product) · studies · analysis · reports (content)

### Shared data

Only when multiple applications genuinely require the same business object — avoid premature generic models.

---

## Summary

Capabilities are **product-neutral**. Features remain **product-specific**.  
Promotion into packages follows [package-promotion.md](./package-promotion.md).
