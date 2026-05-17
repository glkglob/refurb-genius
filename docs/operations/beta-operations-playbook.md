# Beta Operations Playbook

**Purpose:** Operational guide for running Refurb Genius during controlled beta testing.

**Audience:** Operations team, engineering on-call, support staff

---

## Quick Start: Daily Operational Checks

Run these every morning and before/after deploying changes:

### 1. Sentry Health Check (2 min)

- Navigate to Sentry dashboard
- Check **Issues** page for new errors (last 24h)
- Expected baseline: 0-2 errors/day (mostly transient network)
- **Alert threshold:** >5 errors, >1 error rate spike, or auth errors
- Action: Pin high-severity issues to engineering Slack

### 2. Infrastructure Health Check (2 min)

- [ ] Supabase status page: All green
- [ ] Vercel deployment: Latest successful build
- [ ] DNS resolution: `api.refurbgenius.app` resolves
- [ ] HTTPS cert: Valid (auto-renewed)

### 3. Critical Path Testing (5 min)

- [ ] Sign in with test account
- [ ] View dashboard
- [ ] Upload 1 test photo
- [ ] Run AI analysis on test project
- [ ] Export PDF report
- If any fails: Escalate immediately to engineering

---

## Monitoring Checklist

### Sentry Dashboard

**Daily Review (5 min):**

- New error patterns
- Error rate trend
- Most affected users/routes
- Timeout breadcrumbs

**Critical Metrics:**

- Auth errors: Should be 0 unless known issue
- Upload errors: <1% failure rate acceptable
- AI timeouts: Monitor if increasing
- PDF export errors: <2% failure rate acceptable
- Mobile crashes: Separate category, monitor iOS/Android split

**Action Triggers:**

- Auth error rate >2%: Page on-call immediately
- Upload success <95%: Investigate storage connectivity
- AI timeout >10% of analyses: Check OpenAI quota/status
- PDF export failures >5%: Memory pressure on iOS/Safari

### Log Patterns to Monitor

**In Sentry breadcrumbs, look for:**

- `[photos] upload timeout` - File upload stalled >60s
- `[pdf] export:error` - Report export failed (check stage + size)
- `[auth] session_check:complete hasSession:false` - Auth initialization issue
- `[ai] gpt4o:analyze:fallback` - Analysis failed, returned mock

---

## AI Analysis Monitoring

### Normal Behavior

- Batch analysis: 5-10s per photo (OpenAI varies)
- Success rate: 95%+ (some timeout/API errors acceptable)
- Timeout rate: <5%
- Fallback rate: <5%

### Alert Conditions

- Any photo takes >60s (timeout)
- Success rate drops below 90%
- Repeated 429 (rate limit) errors from OpenAI
- API key invalid errors

### Debug Steps

1. Check Sentry breadcrumb: `ai:gpt4o:batch:complete`
   - Look at `successCount`, `fallbackCount`, `avgPerPhotoMs`
2. If rate limited: Wait 5-10 minutes before retrying
3. If timeout: User can retry immediately (safe idempotent)
4. If API key invalid: Check VITE_OPENAI_API_KEY env var

---

## Upload Failure Monitoring

### Normal Behavior

- Upload success rate: >95%
- Concurrent uploads: Max 4 simultaneous
- Per-file timeout: 60s
- Partial success OK: 3 of 5 files success = acceptable UX

### Alert Conditions

- Success rate <95%
- Rollback errors (storage delete fails)
- Metadata insert failures (DB down?)
- Pattern of 100% failures for specific user

### Debug Steps

1. Check Sentry: `captureUploadError` with stage tag
2. Look at `stage`: validation | storage | metadata | rollback
3. If storage failure: Check Supabase Storage connectivity
4. If metadata failure: Check DB connection, disk space
5. If user-specific: Check user's storage quota

---

## PDF Export Monitoring

### Normal Behavior

- Export time: 5-20s typical (depends on page count)
- Timeout rate: <1%
- Memory errors: 0 (prevented by 100MB ceiling)
- Success rate: >98%

### Alert Conditions

- Timeout rate >5%
- Memory error (PDF too large) reported by user
- Export hangs (takes >60s)
- iOS-specific failures clustering

### Debug Steps

1. Check Sentry: `capturePdfError` breadcrumb
2. Look at `stage`: loading-libs | rendering-canvas | generating-pdf | error
3. If timeout during canvas rendering: Report is likely huge or network slow
4. If memory error: Report >100MB, user needs to split/simplify
5. iOS issue: Expected constraint (documented in validation report)

---

## Mobile & iOS Known Issues

### Expected Behaviors (Not Bugs)

- PDF export on iPad: May take 30+ seconds (canvas rendering expensive)
- Image grids: Lazy loading may cause visual jump when scrolling fast
- Touch targets: Buttons are 44px minimum (safe)
- Viewport: All breakpoints tested, safe on 375px (iPhone SE)

### Known Constraints (OS-Level)

- iOS Safari: PDF canvas has 512MB memory limit
  - Workaround: Large reports may fail; user sees clear error message
  - Not a platform bug; user can export on desktop
- Android: Large image grids (50+ photos) may scroll slowly
  - Acceptable for MVP; virtualization available in Phase 6

### Investigation Steps

1. If user reports iOS PDF failure: Check error message in Sentry
2. If size >100MB: Expected; explain 512MB OS limit
3. If network-related: Check breadcrumb for stage (usually loading-libs timeout)
4. Document iOS limitations for support team

---

## Recovery Procedures

### If Upload System Degraded

1. Verify Supabase Storage is online (status page)
2. Check storage bucket exists and RLS rules correct
3. Monitor error rate in Sentry
4. If >50% failure: Contact Supabase support or rollback to previous version

### If AI Analysis Slow/Timing Out

1. Check OpenAI API status page
2. Verify VITE_OPENAI_API_KEY is valid
3. Monitor breadcrumbs for 429 (rate limit) errors
4. If rate limited: Wait 5-10 min, no rollback needed (safe retry)
5. If auth error (401): Regenerate API key, redeploy

### If Auth System Failing

1. Check Supabase auth status page
2. Verify Supabase URL in environment is correct
3. Check Google OAuth app configuration
4. If persistent: Requires full rollback + debugging

### If PDF Export Universally Failing

1. Check html2canvas library is loading (not CDN issue)
2. Verify jspdf library import working (should be lazy-loaded)
3. Check for Sentry errors during export
4. If memory error: Likely user's report is huge; normal (not bug)

### Rollback Procedure

1. Identify last known-good Vercel deployment (commit hash)
2. Verify build succeeded at that commit
3. Run `npm run build:vercel` locally to confirm
4. Redeploy from Vercel dashboard (select prior deployment)
5. Verify critical path test passes
6. Post incident summary to engineering Slack

---

## User Support Workflow

### Beta Tester Onboarding

1. Provide account + test project
2. Set expectations: "bugs may occur, data may not persist"
3. Provide Slack channel for reporting issues
4. Share this doc's "Common Issues" section (below)

### Triage Process

1. **User reports issue** → Slack or email
2. **Gather info:**
   - Browser/OS/device
   - Exact steps to reproduce
   - Screenshot or error message
   - Time of occurrence (for Sentry search)
3. **Search Sentry:** Look for matching error in breadcrumbs
4. **Classify severity** (see below)
5. **Assign to engineering or document as known limitation**

### Common Issues (Support Talking Points)

- "My PDF won't export on iPad"
  - **Expected:** PDF canvas has OS memory limit; try on desktop or simplify report
- "Upload shows 'timeout' error"
  - **Try:** Retry upload (safe idempotent); check internet connection; try fewer files
- "Analysis shows 'Analysis unavailable' for some photos"
  - **Expected:** Some photos failed OpenAI timeout; retry analysis; confidence <50% = fallback
- "My photos disappeared"
  - **Check:** Did you logout? Photos are per-project, not synced across accounts
  - **If data loss:** Check Sentry for DB errors; escalate to engineering

### Bug Severity Classification

**P0 (Critical):** Page is broken, user loses data, security issue

- Examples: Auth fails completely, upload corrupts DB, PDF export crashes app
- Response: Drop everything, page on-call immediately
- Communication: "We've identified the issue and are working on fix"

**P1 (High):** Feature doesn't work, data inaccessible temporarily

- Examples: Upload timeout, analysis times out, PDF export fails on large reports
- Response: Investigate within 1 hour, provide status
- Communication: "Known issue, we're investigating"

**P2 (Medium):** Feature works but with friction, UX issue, performance

- Examples: PDF export slow, image loading laggy, button spacing tight on mobile
- Response: Investigate within business day, plan fix for next release
- Communication: "Noted for next update"

**P3 (Low):** Minor cosmetic, docs, or future optimization

- Examples: Typo in UI, icon color slightly off, memory could be better
- Response: Log for future cleanup
- Communication: Only if addressed

---

## Production Environment Checklist

**Before Launch to Real Users:**

### Credentials & Secrets

- [ ] Supabase URL is production (not staging)
- [ ] Supabase anon key is correct
- [ ] Sentry DSN set (production, not staging)
- [ ] OpenAI API key set (if enabling AI)
- [ ] Google OAuth credentials are production app
- [ ] No hardcoded test values in code

### Configuration

- [ ] Build mode: `PROD=true` (production)
- [ ] Feature flags sensible for beta (see feature-flags.ts)
- [ ] Rate limiting configured (if relevant)
- [ ] CORS origins include frontend domain
- [ ] Database SSL required (production default)

### Monitoring

- [ ] Sentry project created + DSN validated
- [ ] Sentry alerts configured (see dashboard config)
- [ ] Daily monitoring checklist scheduled
- [ ] On-call rotation assigned
- [ ] Incident playbook shared with team

### Security

- [ ] HTTPS enforced (automatic via Vercel)
- [ ] API keys never logged or exposed
- [ ] Sensitive env vars gated behind if(process.env.PROD)
- [ ] CSP headers correct (no inline scripts)
- [ ] Auth session timeout set appropriately

### Documentation

- [ ] Support team trained on common issues
- [ ] Rollback procedure tested and documented
- [ ] Emergency contacts listed and current
- [ ] Beta tester expectations documented

---

## On-Call Runbook

### When Paged (Error Rate Spike)

1. **Acknowledge alert** (2 min)
2. **Check Sentry dashboard:**
   - What error? (`error: {...}`)
   - How many users affected? (event count)
   - When started? (timeline)
3. **Determine severity:**
   - Auth failures: P0 (drop everything)
   - Upload failures: P1 (investigate now)
   - AI timeouts: P2 (monitor, may be transient)
   - PDF failures: P2 (may be OS limit, not bug)
4. **Quick check:**
   - Critical path test still works? → Likely not platform-critical
   - Sentry shows error in specific code path? → Search codebase
   - Error started with recent deploy? → Check git log
5. **Initial action:**
   - If unclear: escalate to senior engineer
   - If known limitation: document in Sentry and move on
   - If new bug: start debugging or rollback if urgent

### Escalation Matrix

- Auth completely broken: Ping product lead + CTO
- Data loss or corruption: Ping CTO + database lead
- Security issue: Ping CTO directly (no Slack)
- Unclear/cascading: Ping engineering lead for judgment call

---

## Metrics to Track (Post-Beta)

These inform Phase 7+ work:

- API success rates (by operation type)
- User session length distribution
- PDF export time percentiles (p50, p95, p99)
- AI analysis time per photo (avg, p95)
- Upload time per file
- Mobile vs desktop error rates
- Browser breakdown (Chrome, Safari, Firefox)
- Geographic distribution of latency issues

---

## Beta Testing Best Practices

### For Testers

- Report issues with exact steps to reproduce
- Screenshot or screen recording if complex
- Note device/browser/OS
- Check that issue isn't already known

### For Support

- Prioritize auth/data loss issues over UX polish
- Assume OS limits (iOS canvas memory) are expected
- Encourage retry before escalating network errors
- Collect data-rich bug reports (time, steps, context)

### For Engineering

- Read Sentry breadcrumbs before asking user for context
- Distinguish user-error from platform-bug
- Document known limitations so support doesn't treat them as bugs
- Batch similar issues together for root-cause fix

---

## Success Criteria for Beta

- **Stability:** Zero unplanned downtime, <1 critical incident
- **Reliability:** >95% success rate on critical paths (upload, analysis, export)
- **Support:** Support team can triage 80% of issues independently
- **Confidence:** Engineering team confident in production readiness after 2+ weeks
