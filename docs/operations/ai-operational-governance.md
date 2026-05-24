# AI Operational Governance — Controlled-Beta Phase

## Overview

This document outlines operational procedures for monitoring, debugging, and improving AI provider reliability during the controlled-beta rollout. The focus is on safety, observability, and measured decision-making.

**Key Principle:** Deterministic financial outputs (pricing, ROI, scoring) remain authoritative. AI outputs are descriptive, advisory, and visual only.

---

## Monitoring Workflow

### Real-Time Metrics

AI provider health is monitored via diagnostic counters, available in the admin dashboard:

**Vision Analysis:**

- Success Rate: Target >80%
- Timeout Rate: Alert if >10%, escalate if >15%
- Parse Failure Rate: Alert if >5%
- Fallback Usage: Alert if >15%

**Redesign Generation:**

- Success Rate: Target >85%
- Timeout Rate: Alert if >15%, escalate if >20%
- Parse Failure Rate: Alert if >3%
- Fallback Usage: Alert if >20%

### Accessing Metrics

1. Navigate to `/admin`
2. Scroll to "AI Operations" section
3. View real-time provider health and recommendations
4. Metrics refresh every 30 seconds

### Interpreting Health Status

- **🟢 Healthy:** All metrics within normal ranges
- **🟡 Degraded:** One metric approaching threshold, but service operational
- **🔴 Critical:** One or more metrics exceeding escalation threshold

---

## Quality Feedback Capture

### Enabling User Feedback

Users and admins can mark AI outputs as accurate/useful during controlled beta:

**Vision Feedback Options:**

- ✓ Accurate
- ~ Partially accurate
- ✗ Inaccurate

**Redesign Feedback Options:**

- ✓ Useful
- ~ Generic
- ✗ Unrealistic

### Submitting Feedback

1. After viewing AI output (analysis or redesign concept)
2. Click "Feedback" button (if visible)
3. Select accuracy/usability rating
4. Add optional notes (e.g., "Room is actually a bedroom, not living room")
5. Submit

Feedback is persisted to `ai_quality_feedback` table for operational analysis.

### Reviewing Feedback Patterns

```typescript
// In admin console or operational scripts:
import { getFeedbackSummary } from "@/lib/ai-quality-feedback";

const summary = await getFeedbackSummary();
console.log(
  "Vision: accurate",
  summary.visionAccurate,
  "partial",
  summary.visionPartial,
  "inaccurate",
  summary.visionInaccurate,
);
console.log(
  "Redesign: useful",
  summary.redesignUseful,
  "generic",
  summary.redesignGeneric,
  "unrealistic",
  summary.redesignUnrealistic,
);
```

---

## Provider Failure Escalation

### Timeout Failures

**Detection:**

- Automatic timeout after 60s (Vision) or 30s (Redesign)
- Tracked in `vision_timeout` or `redesign_timeout` counter
- Triggers automatic fallback to mock provider

**Response:**

1. Check OpenAI API status page for outages
2. If healthy: monitor timeout rate over next 1 hour
3. If rate >15% (Vision) or >20% (Redesign): Escalate to ops
4. If rate remains high: Consider disabling OpenAI (set OPENAI_API_KEY="" and redeploy)

### Parse Failure Escalation

**Detection:**

- JSON response cannot be parsed (malformed or unexpected structure)
- Tracked in `vision_parse_failure` or `redesign_parse_failure` counter
- Indicates prompt drift or OpenAI model behavior change

**Response:**

1. Increment parse failure counter is automatic
2. If parse failure >5% (Vision) or >3% (Redesign): Investigate
3. Review Sentry breadcrumbs under `ai:gpt4o:analyze:fallback` or `ai:gpt4o:redesign:batch`
4. If widespread: May indicate OpenAI model update or API contract change
5. Escalate to engineering for prompt/validation review

### Rate Limiting (429)

**Detection:**

- OpenAI returns 429 status code
- Tracked in `vision_rate_limit` counter
- Automatic fallback to mock provider

**Response:**

1. Check OpenAI account usage and quota
2. If near quota: Upgrade account or reduce request volume
3. If quota sufficient: OpenAI may be rate-limiting this API key globally
4. Temporary mitigation: Add exponential backoff (future enhancement)
5. Long-term: Implement request queuing (future enhancement)

---

## Real-World Data Audit

### Running Audit

Audit identifies quality issues in production data:

```typescript
import { runFullAudit, formatAuditReport } from "@/lib/ai-quality-audit";

const audit = await runFullAudit();
console.log(formatAuditReport([...audit.visionFindings, ...audit.redesignFindings]));
```

### Common Issues Detected

**Vision Issues:**

- Generic photo names (test, sample, placeholder) indicating non-real data
- Very short photo names
- Patterns consistent with debugging or development data

**Redesign Issues:**

- High "unrealistic" feedback rate (>20%)
- High "generic" feedback rate (>30%)
- Low "useful" feedback rate (<50%)

### Acting on Audit Results

1. **Info-level:** Log only, no action required
2. **Warning-level:** Review flagged data, investigate patterns
3. **Critical-level:** Escalate to ops team immediately

---

## Confidence Score Monitoring

### Interpreting Confidence

Vision outputs include `confidence_score` (0-1) indicating model certainty:

- **0.85-1.0:** High confidence, generally reliable
- **0.70-0.85:** Moderate confidence, reasonable for advisory use
- **0.50-0.70:** Low confidence, should review manually
- **< 0.50:** Very low confidence, nearly always fallback

### Review Guidance

- Mark outputs with confidence <0.60 for manual review
- Pattern of low-confidence outputs may indicate poor photo quality or unrecognized room types
- Escalate if >30% of outputs have confidence <0.70

---

## Fallback Behavior

### When Fallback Activates

Fallback to mock providers occurs when:

1. OPENAI_API_KEY is missing or empty
2. OpenAI API call times out
3. OpenAI returns parse error
4. OpenAI returns rate limit (429)
5. OpenAI returns any API error

### User Experience During Fallback

- Vision: Shows "Other" room type with "Average" condition and "Medium" refurb level
- Redesign: Shows pre-defined static concepts (always available)
- **Important:** No error message shown; user experiences graceful degradation

### Detecting Fallback Usage

Check `vision_fallback_used` and `redesign_fallback_used` counters in admin dashboard.

If fallback rate exceeds thresholds:

1. Verify OpenAI API key is configured (check .env)
2. Check OpenAI API status page
3. Review Sentry for error patterns
4. Consider temporary disabling by removing OPENAI_API_KEY

---

## Rollback Procedures

### Immediate Rollback (Disable OpenAI)

**When:** If critical issues detected
**Action:** Remove or unset `OPENAI_API_KEY` in your deployment environment (Vercel, etc.) and redeploy.

**Effect:** All AI features immediately use mock providers.
**Recovery:** Re-enable the key in the environment and redeploy.

> **Warning:** Never commit `.env` files or secrets to the repository.

### Full Branch Rollback

**When:** If critical architectural issues
**Action:** Revert chore/monorepo-restructure branch

```bash
git revert -m 1 <merge-commit-hash>
git push
```

**Effect:** All Deal Copilot and AI features disabled
**Recovery:** Merge chore/monorepo-restructure again after fixes

---

## Accepted Temporary Risks

**Intentional controlled-beta compromises (do NOT solve with infra growth):**

1. **Browser-exposed OpenAI key:** API key is visible to client (network tab)
   - Mitigated by: Rate limits, quota limits on account, token expiration
   - Timeline: Replace with backend proxy before public release

2. **No provider retry/backoff:** Failed requests don't automatically retry
   - User can manually re-run analysis if desired
   - Mitigated by: Timeouts prevent hanging, diagnostic counters alert to issues

3. **No advanced cache invalidation:** Cache remains until session end or auth change
   - Mitigated by: analysisStore.get() always reflects latest provider cache

4. **No background orchestration:** All AI operations are synchronous
   - Mitigated by: Graceful loading states, user can abandon and retry

5. **No rate-limit buffering:** Rate limit (429) responses fall back immediately
   - Future enhancement: Request queuing before public launch

---

## Escalation Path

### Ops Team Escalation Criteria

Escalate to ops team if any of:

1. Vision timeout rate >15% for >1 hour
2. Vision parse failure rate >5% for >1 hour
3. Redesign timeout rate >20% for >1 hour
4. Redesign parse failure rate >3% for >1 hour
5. Audit detects critical-severity issues
6. User reports indicate hallucinations or misclassifications
7. Feedback summary shows <50% useful redesign concepts

### Escalation Process

1. Check admin dashboard `/admin` → AI Operations
2. Review health status and recommendations
3. If critical: Check Sentry for error breadcrumbs
4. Document issue and notification path
5. Create support ticket with diagnostics

---

## Observability Commands

### Check Diagnostic Counters

```typescript
import { getCounters, logCounterSnapshot } from "@/lib/provider-diagnostics";

logCounterSnapshot("current-session");
// Output: [provider-diagnostics] current-session: { vision_success: ..., vision_timeout: ..., ... }
```

### Check Provider Health

```typescript
import { analyzeProviderHealth, formatHealthReport } from "@/lib/provider-health-analysis";

const health = analyzeProviderHealth();
console.log(formatHealthReport(health));
```

### Run Quality Audit

```typescript
import { runFullAudit, formatAuditReport } from "@/lib/ai-quality-audit";

const audit = await runFullAudit();
console.log(formatAuditReport([...audit.visionFindings, ...audit.redesignFindings]));
```

---

## Support Guidelines for Beta Users

### Handling Analysis Issues

**User reports: "Room classification is wrong"**

1. Ask for photo (if consent given)
2. Check confidence_score in analysis
3. If confidence <0.7: Explain it's advisory, recommend manual review
4. Collect feedback via widget: "Feedback → Inaccurate"

**User reports: "Vision keeps timing out"**

1. Check admin dashboard for timeout rate
2. If timeout rate high: System-level issue, likely OpenAI outage
3. If isolated to user: Likely poor network or large image
4. Suggest retry or smaller photo

**User reports: "Redesign concept is generic"**

1. Collect feedback via widget: "Feedback → Generic"
2. Explain that concepts are context-dependent
3. If >30% generic feedback: Known issue, engineering will improve

---

## Next Operational Phases

### Phase 1 (Weeks 1-2): Observability & Feedback

- ✓ Deploy monitoring dashboard
- ✓ Enable quality feedback capture
- ✓ Run initial audit on real data
- Monitor metrics, collect user feedback

### Phase 2 (Weeks 3-4): Validation & Tuning

- Review feedback patterns
- Run audit weekly
- Adjust prompts if drift detected
- Maintain fallback confidence

### Phase 3 (Months 2-3): Confidence Building

- Expand to wider beta user group
- Monitor confidence scores
- Document common issues
- Build runbooks for support team

### Phase 4 (Month 4+): Public Release Readiness

- Backend proxy for API key (replace browser-exposed key)
- Request queuing / rate-limit buffering
- Advanced cache invalidation
- Background orchestration layer

---

## Key Contacts

- **Engineering Lead:** (TBD)
- **Product Manager:** (TBD)
- **Operations Lead:** (TBD)
- **Support Escalation:** (TBD)

---

_Last updated: 2026-05-17_
_Document version: 1.0 (Controlled-Beta Phase)_
