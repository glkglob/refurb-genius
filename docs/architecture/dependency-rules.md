# Dependency Rules

## The Hierarchy (One-Way Flow)

```
Application Shell (root src/)
    ▲
    │ depends on
    │
@repo/services  ←──┐
    ▲              │
    │ depends on   │
    │              │ depend on
@repo/core    ←──┐ │
    ▲            │ │
    │ depends on │ │
    │            ▼ ▼
  @repo/types
    ▲
    │
    └── (no dependencies on other packages)
```

**One-way rule**: Packages at higher levels can depend on packages at lower levels. Reverse imports are forbidden.

## Allowed Dependencies

### What @repo/types can depend on:

- **Nothing** (absolute bottom layer)
- Exception: Root `@/lib` type definitions (types-only imports)

**Type check:**

```typescript
// ✅ ALLOWED: type-only import
import type { Project } from "@/lib/projects";

// ❌ FORBIDDEN: runtime import
import { projectStore } from "@/lib/projects";
```

### What @repo/core can depend on:

- @repo/types
- Root @/lib (types only)
- Root @/core/trades (constants only, single exception)

**Type check:**

```typescript
// ✅ ALLOWED
import type { TradesJobCategory } from "@repo/types";
import { TRADES_JOB_CATEGORIES } from "@/core/trades";
import { UK_REGIONS } from "@/lib/projects";

// ❌ FORBIDDEN
import { opportunityStore } from "@repo/services";
import { Button } from "@repo/ui";
```

### What @repo/services can depend on:

- @repo/core
- @repo/types
- Root @/lib (types only)

**Type check:**

```typescript
// ✅ ALLOWED
import { runRoiEngine } from "@repo/services/roi";
import type { DealOpportunityInput } from "@repo/types";
import type { UKRegion } from "@/lib/projects";

// ❌ FORBIDDEN
import { Button } from "@repo/ui";
import { Dialog } from "@repo/ui";
import { aiProvider } from "@/integrations/openai";
```

### What @repo/ui can depend on:

- @repo/types (if needed, but shouldn't be)
- Root `@/components/ui/*` (facade layer re-exports)
- Root `@/lib/utils` (cn utility)

**Type check:**

```typescript
// ✅ ALLOWED (re-export)
export * from "@/components/ui/button";
export { cn } from "@/lib/utils";

// ❌ FORBIDDEN
import { scoreDealOpportunity } from "@repo/services";
import { DISCLAIMER } from "@repo/core";
```

### What root src/ can depend on:

- All packages (@repo/\*)
- All local code (src/\*)
- All npm packages

**Type check:**

```typescript
// ✅ ALLOWED (root can import everything)
import { runPricingEngine } from "@repo/services";
import { Button } from "@repo/ui";
import { Project } from "@repo/types";
import { UK_REGIONS } from "@repo/core";
import { myComponent } from "@/components/app";

// ✅ ALLOWED (root app drives orchestration)
```

## Forbidden Patterns

| Pattern                                  | Why Forbidden                         | Impact                  |
| ---------------------------------------- | ------------------------------------- | ----------------------- |
| `@repo/types` → `@repo/core`             | Types layer must be at bottom         | Circular dependency     |
| `@repo/core` → `@repo/services`          | Core is a dependency of services      | Reverse import          |
| `@repo/services` → `@repo/ui`            | Services is lower than UI             | Violates hierarchy      |
| `@repo/ui` → `@repo/services`            | UI is at same level, can't reach down | Circular dependency     |
| `@repo/types` → `@/core/deals`           | Types can't depend on app logic       | Creates coupling        |
| `@repo/core` → `@/integrations/supabase` | Core can't depend on runtime          | Creates coupling        |
| `@repo/services` → `React`               | Services aren't React components      | Violates responsibility |
| `@repo/services` → `Zustand`             | Services can't use stores             | Violates purity         |

## Import Statement Patterns

### Valid in @repo/types:

```typescript
// Type imports from root (rare, acceptable)
import type { Project } from "@/lib/projects";

// Internal types
import type { DealMetadata } from "./deal";

// NO runtime imports
```

### Valid in @repo/core:

```typescript
// From lower layer
import type { ProjectStatus } from "@repo/types";

// From root types only
import type { UKRegion } from "@/lib/projects";

// From root constants (1 exception)
import { TRADES_JOB_CATEGORIES } from "@/core/trades";

// Internal utilities
export const DISCLAIMER = "...";
```

### Valid in @repo/services:

```typescript
// From lower layers
import { runRoiEngine } from "@repo/services/roi";
import type { DealOpportunityInput } from "@repo/types";
import { REGION_MULTIPLIERS } from "@repo/core";

// From root types only
import type { ConditionLevel } from "@/lib/analysis";

// Self-contained logic
export function scoreDealOpportunity(input) { ... }
```

### Valid in @repo/ui:

```typescript
// Re-exports from root
export * from "@/components/ui/button";
export * from "@/components/ui/dialog";

// Utility re-export
export { cn } from "@/lib/utils";

// NO business logic
// NO constants or types re-exports
```

## Detecting Violations

### Automated checks:

```bash
# Check for upward imports (should find none)
grep -r "@repo/services" packages/core/src
grep -r "@repo/core\|@repo/services" packages/ui/src

# Check for forbidden root imports
grep -r "from.*@/" packages/*/src | \
  grep -v "@repo/" | \
  grep -v "@/lib/" | \
  grep -v "@/components/ui/" | \
  grep -v "@/core/trades"

# Type check catches violations at compile time
npm run typecheck
```

### Code review checklist:

- [ ] Is this file in the right package?
- [ ] Does it import only from allowed packages?
- [ ] Are imports types-only where required?
- [ ] Does it follow the hierarchy?
- [ ] Could this logic move to a lower layer?

## Why These Rules Exist

1. **Prevents circular dependencies**: One-way flow makes cycles impossible
2. **Enforces separation of concerns**: Business logic separate from types separate from UI
3. **Enables reuse**: Services can be reused by root app and future products
4. **Maintains testability**: Pure logic in services can be unit tested without React
5. **Protects from regression**: Clear boundaries make it hard to accidentally couple layers
6. **Simplifies onboarding**: New developers understand "types are lowest, app is highest"

## Exception Policy

Exceptions require:

1. **Documented reason**: Why the rule can't apply here
2. **Code review approval**: At least one other engineer agrees
3. **Comment in code**: Explain why breaking the rule is justified
4. **Ticket tracking**: Link to issue explaining the compromise

Current exceptions:

- @repo/types imports from @/lib/projects (types only, acceptable for SSR monorepo)
- @repo/core imports TRADES_JOB_CATEGORIES from @/core/trades (constant reuse, scope creep risk if it grows)

Future exceptions should be rare and intentional, not accidental.

## Migration Path

Old code uses root app imports:

```typescript
import { runPricingEngine } from "@/core/pricing/pricingEngine";
```

New code uses package imports:

```typescript
import { runPricingEngine } from "@repo/services";
```

Both work indefinitely. Migrate at your pace.

To encourage package imports in code review:

- Suggest `@repo/*` imports when reviewing new code
- Avoid encouraging `@/core/` paths
- Update imports when touching related code
