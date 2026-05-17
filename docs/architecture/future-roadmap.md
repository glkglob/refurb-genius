# Future Roadmap

## Current State (End of Phase 4)

- ✅ Real workspace monorepo operational
- ✅ Four extraction phases completed
- ✅ 7 workspace packages configured
- ✅ All builds passing, production-ready
- ✅ 1,355 LOC extracted to packages, 17,295 LOC remains in root

**Next decision point**: Stabilize or continue extracting?

## Phase 4.5: Stabilization & Documentation (RECOMMENDED)

**Duration**: 1-2 weeks

**Objectives:**

1. Validate production stability with new monorepo structure
2. Monitor for regressions or performance issues
3. Document package contracts and boundaries
4. Establish team practices for new code
5. Identify any missed extraction opportunities

**Validation checklist:**

- [ ] Production build runs without errors
- [ ] Deployment to Vercel succeeds
- [ ] Auth initialization still works correctly
- [ ] Route discovery and SSR work
- [ ] No unexpected bundle size changes
- [ ] Team understands new import paths
- [ ] Code review process updated to enforce rules
- [ ] Documentation complete and accessible

**Team sync:**

- Review monorepo structure with team
- Explain import rules and boundaries
- Establish code review guidelines
- Document any project-specific patterns

**Metrics to measure:**

- Build time (compare before/after)
- Bundle size (client vs. server)
- SSR rendering time
- Cold start time on Vercel
- Error rate in production

**Go/No-go decision point**: Proceed to Phase 5 only if:

- ✅ No production regressions detected
- ✅ Team understands package structure
- ✅ All tests passing consistently
- ✅ Build performance acceptable

---

## Phase 5: Fix Known Trade-Offs (Post-Stabilization)

**Duration**: 2-3 days

**Choose one or more:**

### Option A: Consolidate pricingData Duplication (Recommended)

**Problem:**

- pricingData.ts exists in both @repo/core and @repo/services
- Created during Phase 4 due to Vite build path resolution issues
- Risk: Future updates to one copy miss the other

**Solution:**

- Keep only @repo/core/src/utilities/pricingData.ts (source of truth)
- Update @repo/services/src/pricing/pricingEngine.ts to import from @repo/core
- Fix Vite path resolution (or accept cross-package import if it works)
- Delete duplicate @repo/services/src/pricing/pricingData.ts
- Delete shim at src/core/pricing/pricingData.ts

**Risk level**: Low (consolidation, no new extraction)

**Effort**: 1-2 hours

**Go/No-go**: Do this immediately after stabilization phase

---

### Option B: Harden @repo/types Independence (Optional)

**Problem:**

- @repo/types imports some types from `@/lib/projects`, etc.
- Blocks publishing types to npm (not needed for internal use, but best practice)
- Creates coupling between types layer and root app

**Solution:**

- Extract root `@/lib` type definitions to `packages/types/` or separate package
- Make @repo/types have zero external dependencies (except TypeScript)
- Document as "types layer truly independent" architectural milestone

**Risk level**: Medium (type refactoring across codebase)

**Effort**: 2-3 days

**Go/No-go**: Optional, do only if time permits

---

### Option C: Extract @repo/integrations Facade (Uncertain)

**Problem:**

- Supabase and OpenAI initialization remain at root
- Integration layer could benefit from organization

**Possible solution:**

- Create @repo/integrations as re-export facade (like @repo/ui)
- Keep actual client initialization at root
- Provide convenient import path for integration clients

**Risk level**: Medium (auth hydration is complex, easy to break)

**Effort**: 3-5 days (significant testing required)

**Go/No-go**: Only attempt if stabilization phase goes perfectly

**Warning**: Do not extract actual client initialization. Only create facade re-exports.

---

## Phase 6: Multi-App Architecture (Future, Beyond Roadmap)

**When ready**: After Deal Copilot requirements clarified

**Goal**: Support Deal Copilot and Refurb IQ as separate apps sharing business logic

**Proposed structure:**

```
apps/
├── refurb-genius/
│   ├── src/
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json
├── deal-copilot/
│   ├── src/
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json
packages/
├── services/         ← shared
├── core/            ← shared
├── types/           ← shared
├── ui/              ← shared
└── integrations/    ← shared (if extracted)
```

**Each app has:**

- Own TanStack Start bootstrap (own `src/server.ts`, vite config)
- Own route tree
- Own UI components (can use @repo/ui primitives)
- Own providers and stores

**Shared packages:**

- @repo/types (domain contracts)
- @repo/core (constants, utilities)
- @repo/services (business logic)
- @repo/ui (component primitives)
- @repo/integrations (optional, Supabase/OpenAI setup patterns)

**Key decision**: Each app = separate Vercel deployment? Or co-hosted?

**Risk level**: High (architecture change, significant refactoring)

**Effort**: 2-3 weeks (requires careful planning, extensive testing)

---

## Phase 7: Package Build Isolation (Optional, Later)

**When**: Only if separate package publishing becomes requirement

**Goal**: Each package can build independently to dist/

**Current state**: All packages build together to single .vercel/output/

**Would require:**

- Per-package build scripts
- Per-package tsconfig.json
- TypeScript declaration files (.d.ts)
- Per-package dist/ outputs
- Package publishing workflow

**Effort**: 1-2 weeks

**Go/No-go**: Only if need to publish packages to npm (not current requirement)

---

## Decision Tree

```
Is monorepo stable?
├── NO  → Go back to Phase 4.5 (stabilize 1-2 more weeks)
└── YES ↓

Is pricingData duplication bothering team?
├── YES → Do Phase 5 Option A (consolidate, 1-2 hrs)
└── NO  ↓

Is @repo/types publishability important?
├── YES → Do Phase 5 Option B (harden types, 2-3 days)
└── NO  ↓

Are Deal Copilot requirements clear?
├── NO  → Wait, gather requirements
├── YES → Plan Phase 6 (multi-app, 2-3 weeks)
└── MAYBE → Start Phase 5 Option C (integrations facade, 3-5 days)

Do we need per-package builds?
├── NO  → Phase 7 not needed
└── YES → Schedule Phase 7 (package isolation, 1-2 weeks)
```

---

## Success Criteria

**After Phase 4.5 (Stabilization)**:

- ✅ Zero production incidents related to monorepo
- ✅ Team shipping code confidently with new import paths
- ✅ Build times same or faster than before
- ✅ Code review process updated
- ✅ Documentation complete and team-reviewed

**After Phase 5 (Consolidation)**:

- ✅ pricingData duplication resolved
- ✅ No new regressions from consolidation
- ✅ Type imports cleaner (if Option B done)
- ✅ Team comfortable with package hygiene

**After Phase 6 (Multi-App, if done)**:

- ✅ Deal Copilot and Refurb Genius can be deployed independently
- ✅ Shared packages used by both apps
- ✅ Zero duplication between app-specific code
- ✅ Monorepo scales to 2+ apps without friction

---

## Anti-Patterns to Avoid

| Anti-Pattern                                 | Why Bad                                     | Prevention                                      |
| -------------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| Extract too much too fast                    | Increases risk of regression                | Phase 4.5 stabilization required before Phase 5 |
| Create circular dependencies                 | Breaks type checking, causes runtime errors | Strict code review of imports                   |
| Move src/ again                              | TanStack Start plugin will fail             | Document as permanent constraint                |
| Leave pricingData duplicated forever         | Maintenance burden grows                    | Consolidate in Phase 5                          |
| Extract auth/routing/providers               | SSR breaks                                  | Keep at root (documented boundary)              |
| Create per-package build outputs prematurely | Extra complexity, maintenance burden        | Wait for clear npm publishing requirement       |
| Forget backward compatibility                | Breaks existing code                        | Keep shims at old locations                     |

---

## Parking Lot: Ideas for Future Consideration

- **@repo/analytics**: Shared analytics event contracts and helpers
- **@repo/fixtures**: Shared test fixtures and mocks
- **@repo/hooks**: Shared React hooks (if truly cross-app)
- **@repo/errors**: Error handling and formatting
- **@repo/api**: Shared API client patterns
- **@repo/permissions**: Access control logic

**Rule**: Only extract after:

1. Stabilization phase complete
2. Multi-app architecture decided
3. Clear requirement to reuse across apps
4. Code already exists and is mature

Do not extract "just in case."

---

## Communication Plan

**Tell team:**

- Monorepo structure is now stable
- Import rules are documented
- Code review will enforce boundaries
- Future phases depend on requirements (Deal Copilot, Refurb IQ)

**Share documentation:**

- All team members review `docs/architecture/`
- Code review template updated with import rules
- Slack channel pinned with link to docs

**Regular sync:**

- Bi-weekly sync to discuss any boundary violations
- Monthly review of monorepo health (build times, errors, etc.)
- Plan Phase 5 kick-off after stabilization metrics confirm readiness

---

## Conclusion

Phases 1-4 complete. Monorepo is operational and production-ready.

**Immediate action**: 1-2 week stabilization phase (Phase 4.5).

**Then**: Fix known trade-offs (Phase 5 consolidation).

**Then**: Plan multi-app architecture based on Deal Copilot/Refurb IQ requirements.

The foundation is solid. Build with confidence. 🚀
