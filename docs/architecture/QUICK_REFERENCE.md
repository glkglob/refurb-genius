# Architectural Boundary Quick Reference

## TL;DR

**Rule**: Code outside `src/features/` and `src/platform/` **CANNOT** import from:
- `@/core/*`
- `@/lib/*`
- `@/services/*`
- `@/integrations/*`

**Enforcement**: Automated test will fail CI if violated.

## Common Violations & Fixes

### ❌ Route importing utility
```typescript
// src/routes/_authed/dashboard.tsx
import { cn } from "@/lib/utils";  // WRONG
```

### ✅ Route importing from platform
```typescript
// src/routes/_authed/dashboard.tsx
import { cn } from "@/platform/utils";  // CORRECT
```

---

### ❌ Component importing legacy
```typescript
// src/components/ui/button.tsx
import { cn } from "@/lib/utils";  // WRONG
```

### ✅ Component importing from platform
```typescript
// src/components/ui/button.tsx
import { cn } from "@/platform/utils";  // CORRECT
```

---

### ❌ Server function importing legacy
```typescript
// src/serverFns/auth.ts
import type { AuthUser } from "@/lib/auth";  // WRONG
```

### ✅ Server function importing from platform
```typescript
// src/serverFns/auth.ts
import type { AuthUser } from "@/platform/auth";  // CORRECT
```

## Migration Checklist

When you see a violation:

1. **Identify the legacy module** (e.g., `@/lib/utils`)
2. **Check if platform equivalent exists** (e.g., `@/platform/utils`)
3. **If not, create it**:
   ```bash
   # Example: Moving utils
   mkdir -p src/platform/utils
   # Move/copy the utility
   # Update exports
   ```
4. **Update imports** in your file
5. **Run tests** to verify:
   ```bash
   pnpm test:ui
   ```

## Directory Structure

```
src/
├── features/          ✅ Can import from legacy (transitional)
│   ├── estimate/
│   ├── ai-design/
│   └── ai-upload/
├── platform/          ✅ Can import from legacy (transitional)
│   ├── supabase/
│   ├── utils/        ← Move @/lib/utils here
│   ├── logger/       ← Move @/lib/logger here
│   ├── analytics/    ← Move @/lib/analytics here
│   └── auth/         ← Move @/lib/auth here
├── core/              ✅ Can import from core/lib (internal)
├── lib/               ✅ Can import from lib (internal)
├── routes/            ❌ CANNOT import from legacy
├── components/        ❌ CANNOT import from legacy
├── serverFns/         ❌ CANNOT import from legacy
└── services/          ⚠️  Transitional (will migrate to features)
```

## Running Tests

```bash
# Run all tests (including invariant)
pnpm test:ui

# Watch mode
pnpm test:ui:watch

# Run only invariant tests
pnpm test:invariants
```

## Getting Help

1. **Check audit**: `docs/architecture/audit-2026-06-10.md`
2. **Check summary**: `docs/architecture/PHASE_2_3_SUMMARY.md`
3. **Check test**: `tests/invariants/no-legacy-imports.invariant.test.ts`

## Common Questions

**Q: Why can't I import from `@/lib/utils`?**  
A: Routes/components should be decoupled from legacy infrastructure. Use `@/platform/utils` instead.

**Q: What if the platform module doesn't exist yet?**  
A: Create it! Move the utility from `@/lib/*` to `@/platform/*` and update exports.

**Q: Can features import from legacy?**  
A: Yes, temporarily. Features are the transition layer. Eventually, they'll import from platform only.

**Q: Why is this important?**  
A: Enforces clean architecture, enables incremental migration, prevents circular dependencies, improves testability.

**Q: The test is failing, what do I do?**  
A: Follow the remediation steps in the error message. See the audit document for your specific file.
