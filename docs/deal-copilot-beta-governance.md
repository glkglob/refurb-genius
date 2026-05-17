# Deal Copilot Lite – Beta Governance & Operational Runbook

**Status**: Ready for Controlled Beta Rollout  
**Target Launch Date**: 2026-05-17  
**Rollout Model**: Staged internal beta → Customer subset → General availability  
**Support Tier**: Operational (on-call monitoring required)

---

## Executive Summary

Deal Copilot Lite is a lightweight deal analysis module that consumes three deterministic financial engines (`pricingEngine`, `roiEngine`, `dealScore`) from the shared `@repo/services` library. It is **not** an AI system and produces **zero AI-generated financial outputs**. All metrics (ROI%, yield%, profit, investment score, cost breakdown) are deterministic calculations based on property inputs.

**Scope**:
- Single-deal analysis (not portfolio-level)
- Route-level module (no platform-wide architecture changes)
- Synchronous analysis (no async workflows, background jobs, or queues)
- Beta feedback capture for credibility and pricing confidence validation

**Key Guarantee**: Deterministic correctness. Given the same property inputs, Deal Copilot always produces identical financial outputs. Failures are prevented at form validation and render safety boundaries.

---

## Accepted Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Calculation drift across deployments** | Low | High | Deterministic validation runner (`scripts/validate-deal-copilot.ts`) runs before every deployment; compares against golden-path fixture. Non-zero exit code blocks merges. |
| **Stale/invalid UI rendering** | Low | Medium | Production safety checks (`src/lib/deal-copilot/safety.ts`) validate all values before render; fallback to "—" for NaN/Infinity/undefined. |
| **Form input edge cases** | Low | Medium | Strict money parser rejects negatives, multiple decimals, extreme values. UI disables save until all required fields valid. |
| **Supabase save failures** | Medium | Low | Existing `opportunityStore` error handling preserved; user sees error message and can retry. Form state not lost. |
| **Regional/condition lookup failures** | Low | Low | Engines guard against missing lookups; default to conservative assumptions (national average). No thrown errors. |
| **Performance regression** | Low | Low | Memoization throughout (form → scoreInput → analysis). Synchronous analysis <100ms typical case. No polling or useEffect loops. |
| **Memory leaks in long sessions** | Low | Low | All state is local `useState`; no external subscriptions except read-only opportunityStore snapshot. No setInterval/setTimeout. |
| **Long-lived form state corruption** | Low | Low | Form state only contains strings and enums; immutable updates via `setForm()`. No shared mutable state. |

---

## Rollout Scope & Constraints

### What IS Included

✅ **In Scope**:
- Single-property analysis (purchase price, refurb budget, rental income, region, condition)
- Financial metrics (ROI%, yield%, profit, investment score, cost breakdown, timeline)
- Deal recommendation (Strong/Consider/Watch/Reject)
- Risk flags (Low/Moderate/High + specific warnings)
- Pricing estimate section (labour/materials/VAT breakdown)
- Save-to-opportunity workflow (Supabase integration)
- Beta feedback form (usefulness rating + notes)
- Deterministic validation runner (CI/CD gate)
- Structured diagnostics logging (console categorization)
- Production safety validation (pre-render checks)

### What Is NOT Included

❌ **Out of Scope**:
- **Portfolio analysis**: Comparison of multiple deals, portfolio-level ROI aggregation
- **AI summary generation**: No LLM/Claude integration; only deterministic template text
- **Refinancing scenarios**: Single deal, single strategy; no scenario branching
- **Export workflows**: PDF/report generation handled separately; Deal Copilot feeds data to existing report engine
- **Historical benchmarking**: No external data sources; uses existing regional lookup tables only
- **Sensitivity analysis**: Single-point estimates only; no Monte Carlo or range analysis
- **Platform-level changes**: Standalone route module; no auth, pricing, or architecture redesign

---

## Known Limitations

1. **Synchronous Only**: Analysis runs synchronously in browser; very large forms may briefly block UI (typical analysis <100ms)
2. **Session-Only State**: Form data lost on page refresh; no draft persistence to database
3. **Single Property**: One deal per analysis; portfolio comparison requires separate UI or route
4. **Fixed Assumptions**: Property size, finish level, condition mapping are deterministic only; no user overrides
5. **Regional Data Only**: UK regions only; international properties not supported
6. **No Scenario Branching**: Purchase/refurb/exit strategies are fixed; no "what-if" branching
7. **Beta Feedback Optional**: User can skip providing feedback; no mandatory completion gate
8. **Console Logging Only**: No external observability platform integration (yet); logs appear in browser console + server logs only

---

## Deterministic Guarantees

### Financial Calculation Invariants

1. **ROI Formula**: `(estimated_profit / total_project_cost) × 100`
   - Engines validate: `total_project_cost > 0` and `estimated_profit` is finite
   - If breach: logged as anomaly, but calculation still proceeds with fallback

2. **Gross Yield**: `(annual_rental_income / total_project_cost) × 100`
   - Annual rental = monthly_rent × 12
   - Engines clamp result to [−∞, +∞] with guard against Infinity

3. **Investment Score**: 0–10 scale based on weighted factors
   - Scope: profitability, yield, project efficiency, market conditions
   - Calculation is deterministic lookup table; no ML/AI involved

4. **Cost Breakdown**: Labour + Materials + Contingency + VAT
   - Regional multipliers (0.7–1.8× based on region/condition)
   - Fixed labour rates per category × quantity
   - Contingency = base % of materials/labour (configurable per region)

### Validation Checkpoints

**Form Validation** (before engine calls):
- Required fields: title (non-empty), purchase price, GDV, monthly rent, refurb budget, region, condition
- Money parsing: rejects negatives, multiple decimals, NaN
- Enum validation: region ∈ UK_REGIONS, condition ∈ CONDITION_LEVELS

**Pre-Render Validation** (after engine calls):
- All numeric fields must be `Number.isFinite()`
- ROI result recommendation ∈ ["Strong", "Consider", "Watch", "Reject"]
- Pricing result estimate_items array must be valid objects
- If any breach: logged as error, value rendered as "—" (fallback)

**Runtime Diagnostics** (ongoing):
- Calculation anomalies logged (drift detection)
- Invalid values flagged with field name + type
- Save failures categorized (network vs. validation)
- Duplicate saves skipped (idempotent)

---

## Operational Monitoring Checklist

### Daily Operations

- [ ] **Deterministic validation passing**: `npm run lint && npm run typecheck && npm run build:vercel && pnpm tsx scripts/validate-deal-copilot.ts` should show `6/6 tests passed` with no drift
- [ ] **Browser console clean**: No `[deal-copilot/error]` or `[deal-copilot/render]` errors in production logs for >1 hour
- [ ] **Supabase opportunityStore responding**: Verify save requests completing within <2s; if >5s, escalate to database team
- [ ] **Regional lookup tables up-to-date**: Confirm last update to UK regions/conditions <7 days ago; if stale, escalate

### Weekly Operations

- [ ] **Beta feedback volume**: Check feedback submission counts; zero feedback may indicate UX friction
- [ ] **Usefulness rating distribution**: Target >60% "Yes" on usefulness; <40% indicates potential calculation accuracy issue
- [ ] **Save success rate**: Monitor save failures; if >5% failure rate, escalate to database team
- [ ] **Performance metrics**: Confirm typical analysis time <100ms; if >200ms consistently, investigate memoization

### Monthly Operations

- [ ] **Regression fixture validation**: Run golden-path tests against latest engine versions; if drift >0.1%, block deploy
- [ ] **User feedback analysis**: Review optional feedback notes for patterns (e.g., "score too optimistic", "pricing underestimated")
- [ ] **Error trend analysis**: Categorize console errors; if new pattern emerges, escalate to engineering
- [ ] **Platform stability**: Confirm no impact on other routes (deal management, portfolio, projects)

---

## Rollback Criteria

### Immediate Rollback Triggers

**RED**: Stop accepting new analyses, escalate immediately

1. **Calculation Drift Detected**: Deterministic validation runner fails (e.g., ROI expected 18.9%, got 18.5%)
   - Action: Revert last deploy; run `git bisect` to identify commit
   - Communication: Notify #deal-copilot-beta channel + support team

2. **Widespread Render Failures**: >10% of analyses show "—" (fallback) values in metrics
   - Action: Disable route UI; show maintenance notice
   - Root cause: Check `safety.ts` validation logs for pattern

3. **Save Workflow Failure**: >15% of save attempts fail; Supabase connection lost or quota exceeded
   - Action: Disable save button; inform user of temporary unavailability
   - Rollback: Revert to previous version if issue persists >15 minutes

4. **Performance Degradation**: Typical analysis time >500ms (10× increase)
   - Action: Profile memoization; check if new components causing unnecessary re-renders
   - Rollback: Revert if cause unclear

### Yellow (Monitor & Prepare for Rollback)

- **Calculation Drift <0.1%**: Log as anomaly; escalate to eng review (may be acceptable rounding)
- **Save Failure Rate 10–15%**: Investigate Supabase; increase error logging
- **Feedback Usefulness <50%**: Review user notes; may indicate UX clarity issue (not a blocker)

### Green (Normal Operations)

- **Calculation matches golden path ±0.01%**
- **Save success rate >95%**
- **Analysis time <150ms typical case**
- **Feedback usefulness >60%**

---

## Support Procedures

### Customer Reporting an Issue

**Scenario 1: "My deal score seems too optimistic"**
1. Collect: property inputs (purchase price, refurb budget, region, condition, rental income)
2. Reproduce: Run same inputs through Deal Copilot Lite
3. Validate: Check against golden-path fixture to confirm engine behavior is deterministic
4. Root cause: If deterministic, issue is model assumptions (regional lookups, condition mapping), not calculation
5. Response: Explain assumptions; offer guidance on overrides or manual review

**Scenario 2: "Pricing estimate doesn't match my quotes"**
1. Collect: breakdown (labour/materials/contingency/VAT from Deal Copilot)
2. Validate: Confirm regional multipliers applied correctly (check `pricingEngine` configuration)
3. Root cause: Likely legitimate difference (market variation, finish level assumption, category scope)
4. Response: Explain pricing engine assumptions; recommend manual line-item review for final estimates

**Scenario 3: "Analysis won't save to opportunities"**
1. Collect: browser console logs (search for `[deal-intake] Save failed`)
2. Check: Supabase status page; verify user has create_opportunity permission
3. If network issue: Retry; if persistent, escalate to database team with full error message
4. If permission issue: Add user to deal-copilot-beta group in Supabase auth

**Scenario 4: "I got NaN / — / 'undefined' values"**
1. Collect: property inputs and screenshot
2. Validate: Check `safety.ts` validation logs to confirm pre-render safety caught issue
3. Root cause: Likely invalid input (negative value, extreme outlier)
4. Response: Confirm inputs are valid; offer to re-run with corrected values
5. If persists: File bug; reproduce with saved test case

### On-Call Runbook

**If Deterministic Validation Fails**:
```bash
# 1. Check last deploy
git log --oneline -5

# 2. Run validation locally
pnpm tsx scripts/validate-deal-copilot.ts

# 3. If standard-flip fails
npm run typecheck src/lib/deal-copilot/
npm run lint src/lib/deal-copilot/

# 4. Identify changed files
git diff HEAD~1 src/lib/deal-copilot/ src/components/deal-copilot/

# 5. If engine mappings changed, run git blame on those lines
git blame src/lib/deal-copilot/dealAnalysis.ts | grep -A5 "runRoiEngine"

# 6. Revert last commit or merge
git revert HEAD  # or git reset --hard origin/main
```

**If Save Workflow Fails Silently**:
```bash
# 1. Check Supabase status
# Visit https://supabase.com/dashboard → check incidents

# 2. Run browser console diagnostics
# Open DevTools → search for [deal-intake] in console

# 3. If permission denied
supabase auth update <user-id> --role deal-copilot-beta

# 4. If network timeout
# Check API rate limiting; increase timeout in opportunityStore if needed
```

**If Performance Degrades**:
```bash
# 1. Profile React component
# In browser DevTools Profiler, record a single analysis
# Look for unnecessary re-renders (memoization not working)

# 2. Check memoization dependencies
grep -n "useMemo.*\[" src/components/deal-copilot/DealIntakeForm.tsx

# 3. If form state updating too frequently
# Check if scoreInput dependency is correct (should only change on form change)
```

---

## Regression Response Workflow

### If Regression Detected

1. **Confirm Regression**
   - Deterministic runner shows drift (e.g., ROI: expected 18.9%, got 19.5%)
   - Run fixture 3 times to confirm not random noise
   - Compare against last known-good deploy

2. **Isolate Root Cause**
   - Check if input parsing changed (dealValidation.ts)
   - Check if engine mapping changed (dealAnalysis.ts)
   - Check if dependent engines changed (pricingEngine, roiEngine)
   - Run `git blame` on modified lines

3. **Assess Impact**
   - If drift <0.5% and isolated to edge case (e.g., negative profit): May be acceptable; document decision
   - If drift >1% or affects golden-path: **Immediate rollback required**
   - If only some test cases fail: Investigate specific input pattern

4. **Notify & Escalate**
   - Slack #deal-copilot-beta: "Regression detected in standard-flip test. Drift: X%. Rolling back commit Y."
   - Assign P1 bug: "Deterministic test regression: [metric] calculation changed"
   - Block further deploys until resolved

5. **Post-Mortem**
   - Root cause analysis: Why did this pass CI?
   - Fix: Code change + updated fixture if intentional
   - Prevention: Enhanced test case or validation rule added

---

## Deployment Checklist

**Before Every Deploy**:

- [ ] `npm run typecheck` passes (zero TS errors in src/lib/deal-copilot/ and src/components/deal-copilot/)
- [ ] `npm run lint` passes (all deal-copilot files clean)
- [ ] `npm run build:vercel` succeeds (no build errors)
- [ ] `pnpm tsx scripts/validate-deal-copilot.ts` shows `6/6 tests PASSED` (no drift)
- [ ] Fixture golden-path test output recorded (save baseline for regression detection)
- [ ] Beta feedback component integrated with backend submission endpoint (if applicable for this deploy)
- [ ] Ops team notified of deploy window; on-call engineer confirms monitoring ready
- [ ] Rollback plan documented (git commit hash to revert to)

**After Deploy** (first 30 minutes):

- [ ] Monitor console logs for `[deal-copilot/error]` or `[deal-copilot/render]` messages
- [ ] Run 3–5 test analyses through UI; verify scores and metrics rendered correctly
- [ ] Check Supabase opportunity saves are working (verify 1–2 records created)
- [ ] Confirm no increase in console errors on other routes (portfolio, projects, trades)

---

## Feedback Interpretation Guide

### Feedback Form: "Was This Analysis Useful?"

**If Yes (✓)**:
- User found deal score credible
- Pricing estimate aligned with expectations
- Recommendation matched user's intuition
- **Action**: Log metric; track trend (target >60%)

**If No (✗)**:
- User found score too optimistic or pessimistic
- Pricing estimate misaligned with market
- Recommendation seemed incorrect
- **Action**: Review optional notes; if pattern emerges (e.g., "always too optimistic"), escalate
- **Example Notes**:
  - "Score seemed 1 point too high" → Investment score model may need tuning
  - "Pricing was 20% underestimated" → Regional multipliers may be stale
  - "Recommendation didn't match my gut" → Weighting factors may need review

**If No Feedback Provided**:
- User either: (a) didn't care to submit, (b) didn't understand question, (c) rushed through
- **Action**: No action needed; not a blocker

---

## Success Criteria for Beta Completion

Beta is **READY FOR GA** when:

1. ✅ **Deterministic validation passing**: 6/6 test cases pass consistently across 3 consecutive deploys
2. ✅ **Zero critical incidents**: No rollbacks in 14-day beta period
3. ✅ **User feedback positive**: >60% "Yes" usefulness rating across >30 submissions
4. ✅ **Save reliability**: >98% opportunity save success rate
5. ✅ **Performance baseline**: Median analysis time <100ms, p95 <200ms
6. ✅ **No data corruption**: Zero invalid values (NaN/Infinity) in production save records
7. ✅ **Ops readiness**: Runbook tested; on-call team confirms support procedures clear

**If any criterion not met**: Extend beta 2 weeks, investigate root cause, update procedures.

---

## Sunset & Archive Plan

**If Deal Copilot Lite is Deprecated**:
1. Announce 30-day notice in #deal-copilot-beta
2. Migrate saved opportunities to portfolio (if applicable)
3. Archive route component (move to `/routes/_deprecated/`)
4. Preserve fixtures for historical analysis
5. Document lessons learned for future analysis tools

---

## Contact & Escalation

| Issue | Tier | Owner | SLA |
|-------|------|-------|-----|
| **Calculation drift** | P1 | Engineering | 1 hour |
| **Save failures (>10%)** | P1 | Database team | 1 hour |
| **Performance degradation (>10×)** | P1 | Engineering | 2 hours |
| **User UX confusion** | P2 | Product | 4 hours |
| **Feature request** | P3 | Product | 1 sprint |

**Slack channels**:
- `#deal-copilot-beta` — Announcements, status updates, feedback
- `#deal-copilot-oncall` — On-call coordination, incidents
- `#eng-platform` — Architecture/dependency questions

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-17  
**Next Review**: 2026-06-17 (post-beta)  
**Approval**: [Awaiting stakeholder sign-off]
