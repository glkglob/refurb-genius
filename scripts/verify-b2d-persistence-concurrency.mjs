#!/usr/bin/env node
/**
 * 4C2E-B2D1 / B2D2R — Multi-session concurrency verifier for
 * public.persist_measured_boq_catalog_draft.
 *
 * Uses independent local psql processes (distinct backend PIDs), a
 * coordinator barrier that holds the same advisory lock keys as the RPC
 * (package identity and/or request identity), and pg_stat_activity /
 * pg_locks evidence of overlap.
 *
 * B2D2R adds cross_package_request_conflict: same request ID, different
 * package identities, request-advisory barrier, created+request_conflict.
 *
 * Local Supabase only. Non-zero exit on any unmet concurrency condition.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const CONTENT_CK = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
/** Valid catalog_revision grammar: mboq-YYYY.MM.DD(.N)? — use 2099.12.x for B2D1 isolation. */
const REV = {
  exactReplay: "mboq-2099.12.01",
  packageReplay: "mboq-2099.12.02",
  requestConflictA: "mboq-2099.12.03",
  requestConflictB: "mboq-2099.12.04",
  revisionConflict: "mboq-2099.12.05",
  independentA: "mboq-2099.12.06",
  independentB: "mboq-2099.12.07",
  crossPackageA: "mboq-2099.12.08",
  crossPackageB: "mboq-2099.12.09",
};
const PERSIST_REQUEST_LOCK_NS = "measured-boq-persist-request:";
const PERSIST_CMD_SCOPE = "persist_draft";
const WAIT_POLL_MS = 100;
const WAIT_TIMEOUT_MS = 20_000;
const CALLER_TIMEOUT_MS = 45_000;

function nowIso() {
  return new Date().toISOString();
}

function fail(message, extra = {}) {
  const payload = {
    Status: "FAIL",
    Error: message,
    Timestamp: nowIso(),
    ...extra,
  };
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
  throw new Error(message);
}

function assertLocalUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("DATABASE_URL is not a valid URL", { DatabaseUrlHost: "(parse-failed)" });
  }
  const host = parsed.hostname;
  const allowed = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!allowed.has(host)) {
    fail("Refusing non-local database host for B2D1 concurrency verifier", {
      DatabaseUrlHost: host,
    });
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    fail("DATABASE_URL must use postgresql protocol", { Protocol: parsed.protocol });
  }
  return parsed;
}

function psqlSync(dbUrl, sql, { tuplesOnly = true } = {}) {
  const args = [dbUrl, "-v", "ON_ERROR_STOP=1"];
  if (tuplesOnly) args.push("-At");
  args.push("-c", sql);
  const chosen = spawnSync("psql", args, {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (chosen.status !== 0) {
    fail("psql command failed", {
      StatusCode: chosen.status,
      Stderr: (chosen.stderr || "").slice(0, 800),
      Stdout: (chosen.stdout || "").slice(0, 400),
      SqlPreview: sql.slice(0, 200),
    });
  }
  return (chosen.stdout || "").trim();
}

function sqlLiteral(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

function packageArtifacts(catalogRevision, sourceId, rateKey = "paint.wall.m2") {
  const manifest = JSON.stringify({
    manifestVersion: "1",
    catalogRevision,
    source: {
      id: sourceId,
      name: "S",
      version: "1",
      effectiveDate: "2099-06-01",
      licenceReference: "syn",
      licenceStatus: "synthetic",
    },
    transformation: { schemaVersion: "1", normaliserVersion: "1" },
    package: { snapshotPath: "snapshot.json", production: false },
  });
  const snapshot = JSON.stringify({
    schemaVersion: "1",
    catalogRevision,
    currency: "GBP",
    vatBasis: "exclusive",
    regionalBasis: "uk-region-multipliers-v1",
    effectiveFrom: "2099-06-01",
    sourceDescription: "SYNTHETIC B2D1 CONCURRENCY FIXTURE — not production",
    entryCount: 1,
    production: false,
    entries: [
      {
        rateKey,
        displayName: "Paint walls",
        description: null,
        tradeOrDomain: "decor",
        unit: "m2",
        costType: "labour",
        baseUnitRate: 12.5,
        currency: "GBP",
        vatBasis: "exclusive",
        sourceReference: "synthetic",
        status: "active",
        replacementRateKey: null,
      },
    ],
  });
  const entries = JSON.stringify([
    {
      rate_key: rateKey,
      display_name: "Paint walls",
      description: null,
      trade_or_domain: "decor",
      unit: "m2",
      cost_type: "labour",
      base_unit_rate: 12.5,
      currency: "GBP",
      vat_basis: "exclusive",
      source_reference: "synthetic",
      status: "active",
      replacement_rate_key: null,
    },
  ]);
  const report = JSON.stringify({
    tool: "catalogue-persist",
    ok: true,
    licenceStatus: "synthetic",
    production: false,
    schemaVersion: "1",
    effectiveFrom: "2099-06-01",
    sourceDescription: "SYNTHETIC B2D1 CONCURRENCY FIXTURE — not production",
    createdBy: "persist_measured_boq_catalog_draft",
  });
  return { manifest, snapshot, entries, report };
}

function inputChecksum(dbUrl, manifest, snapshot) {
  return psqlSync(
    dbUrl,
    `SELECT public.measured_boq_package_input_checksum(${sqlLiteral(manifest)}, ${sqlLiteral(snapshot)});`,
  );
}

function lockKeys(dbUrl, checksum) {
  const out = psqlSync(
    dbUrl,
    `SELECT
       (('x' || substr(${sqlLiteral(checksum)}, 1, 8))::bit(32))::integer::text
       || ',' ||
       (('x' || substr(${sqlLiteral(checksum)}, 9, 8))::bit(32))::integer::text;`,
  );
  const [k1, k2] = out.split(",").map((s) => Number(s));
  if (!Number.isInteger(k1) || !Number.isInteger(k2)) {
    fail("Failed to derive advisory lock keys", { Raw: out, Checksum: checksum });
  }
  return { k1, k2 };
}

/** Matches migration: hashtextextended('measured-boq-persist-request:'||scope||':'||uuid, 0) */
function requestLockKey(dbUrl, requestId, commandScope = PERSIST_CMD_SCOPE) {
  const out = psqlSync(
    dbUrl,
    `SELECT pg_catalog.hashtextextended(
       ${sqlLiteral(PERSIST_REQUEST_LOCK_NS + commandScope + ":" + requestId)},
       0
     )::text;`,
  );
  if (!/^-?\d+$/.test(out)) {
    fail("Failed to derive request-identity advisory lock key", {
      Raw: out,
      RequestId: requestId,
      CommandScope: commandScope,
    });
  }
  return out;
}

function buildPackageBarrierCoordSql(coordApp, k1, k2) {
  return `
SELECT set_config('application_name', ${sqlLiteral(coordApp)}, false);
SELECT pg_backend_pid() AS backend_pid \\gset
\\echo COORD_PID :backend_pid
SELECT pg_advisory_lock(${k1}, ${k2});
\\echo COORD_LOCK_HELD
SELECT pg_sleep(120);
`;
}

function buildRequestBarrierCoordSql(coordApp, requestLockKeyBigint) {
  return `
SELECT set_config('application_name', ${sqlLiteral(coordApp)}, false);
SELECT pg_backend_pid() AS backend_pid \\gset
\\echo COORD_PID :backend_pid
SELECT pg_advisory_lock(${requestLockKeyBigint});
\\echo COORD_LOCK_HELD
SELECT pg_sleep(120);
`;
}

function backendPid(dbUrl) {
  return Number(psqlSync(dbUrl, "SELECT pg_backend_pid();"));
}

function cleanupFixture(dbUrl, labels) {
  const inList = labels.map(sqlLiteral).join(",");
  // Bypass immutability triggers for isolated synthetic labels only (postgres superuser).
  const sql = [
    "SET session_replication_role = replica",
    `DELETE FROM public.measured_boq_catalog_events WHERE catalog_revision IN (${inList})`,
    `DELETE FROM public.measured_boq_catalog_entries WHERE catalog_revision IN (${inList})`,
    `DELETE FROM public.measured_boq_catalog_packages WHERE catalog_revision IN (${inList})`,
    `DELETE FROM public.measured_boq_catalog_revisions WHERE catalog_revision IN (${inList})`,
    "SET session_replication_role = DEFAULT",
  ].join("; ");
  psqlSync(dbUrl, `${sql}; SELECT 1;`);
}

function rowCounts(dbUrl, labels) {
  const inList = labels.map(sqlLiteral).join(",");
  const raw = psqlSync(
    dbUrl,
    `SELECT
       (SELECT count(*)::int FROM public.measured_boq_catalog_revisions WHERE catalog_revision IN (${inList})),
       (SELECT count(*)::int FROM public.measured_boq_catalog_packages WHERE catalog_revision IN (${inList})),
       (SELECT count(*)::int FROM public.measured_boq_catalog_entries WHERE catalog_revision IN (${inList})),
       (SELECT count(*)::int FROM public.measured_boq_catalog_events WHERE catalog_revision IN (${inList}));`,
  );
  const [revisions, packages, entries, events] = raw.split("|").map((n) => Number(n));
  return { revisions, packages, entries, events };
}

function eventSummary(dbUrl, labels) {
  const inList = labels.map(sqlLiteral).join(",");
  const raw = psqlSync(
    dbUrl,
    `SELECT coalesce(string_agg(request_id::text || ':' || result, ',' ORDER BY created_at), '')
     FROM public.measured_boq_catalog_events
     WHERE catalog_revision IN (${inList});`,
  );
  return raw;
}

function buildRpcSql({
  manifest,
  snapshot,
  catalogRevision,
  sourceId,
  inputCk,
  contentCk,
  entries,
  report,
  requestId,
  tag,
}) {
  return `
SELECT set_config('application_name', ${sqlLiteral(`b2d1-caller-${tag}`)}, false);
SELECT pg_backend_pid() AS backend_pid \\gset
\\echo BACKEND_PID :backend_pid
SELECT public.persist_measured_boq_catalog_draft(
  ${sqlLiteral(manifest)},
  ${sqlLiteral(snapshot)},
  ${sqlLiteral(catalogRevision)},
  ${sqlLiteral(sourceId)},
  1,
  '1',
  ${sqlLiteral(inputCk)},
  ${sqlLiteral(contentCk)},
  ${sqlLiteral(entries)}::jsonb,
  ${sqlLiteral(report)}::jsonb,
  ${sqlLiteral(requestId)}::uuid
) AS result \\gset
\\echo RPC_RESULT :result
`;
}

function spawnPsqlFile(dbUrl, sqlPath, logPath) {
  const child = spawn("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => {
    stdout += d.toString();
  });
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  const done = new Promise((resolve) => {
    child.on("close", (code, signal) => {
      writeFileSync(
        logPath,
        `STDOUT:\n${stdout}\nSTDERR:\n${stderr}\nCODE:${code}\nSIGNAL:${signal}\n`,
      );
      resolve({ code, signal, stdout, stderr, pid: child.pid });
    });
  });
  return { child, done, getOutput: () => ({ stdout, stderr }) };
}

function parseCallerLog(stdout) {
  const pidMatch = stdout.match(/BACKEND_PID\s+(\d+)/);
  const resultMatch = stdout.match(/RPC_RESULT\s+(\{.*\})/);
  let result = null;
  if (resultMatch) {
    try {
      result = JSON.parse(resultMatch[1]);
    } catch {
      result = { parse_error: true, raw: resultMatch[1] };
    }
  }
  return {
    backendPid: pidMatch ? Number(pidMatch[1]) : null,
    result,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Race a promise against a timeout without letting the timer call fail after success. */
function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout();
      } catch (err) {
        reject(err);
      }
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

function queryWaitState(dbUrl, applicationNames) {
  const names = applicationNames.map(sqlLiteral).join(",");
  const activity = psqlSync(
    dbUrl,
    `SELECT coalesce(string_agg(
        pid::text || '|' || coalesce(application_name,'') || '|' ||
        coalesce(wait_event_type,'') || '|' || coalesce(wait_event,'') || '|' ||
        coalesce(state,''),
        ';' ORDER BY pid
      ), '')
     FROM pg_stat_activity
     WHERE application_name IN (${names});`,
  );
  const locks = psqlSync(
    dbUrl,
    `SELECT coalesce(string_agg(
        pid::text || '|' || locktype || '|' || mode || '|' || granted::text || '|' ||
        coalesce(classid::text,'') || '|' || coalesce(objid::text,''),
        ';' ORDER BY pid, granted
      ), '')
     FROM pg_locks
     WHERE locktype = 'advisory'
       AND pid IN (
         SELECT pid FROM pg_stat_activity WHERE application_name IN (${names})
       );`,
  );
  return { activity, locks };
}

function hasAdvisoryWait(activity, locks) {
  // Prefer wait_event evidence; also accept ungranted advisory lock rows.
  if (/\|Lock\||advisory/i.test(activity) || /\|Lock\|advisory/i.test(activity)) {
    return true;
  }
  if (activity.includes("Lock|") || activity.toLowerCase().includes("advisory")) {
    return true;
  }
  // pg_locks: granted=false for waiter
  if (/\|advisory\|.*\|false\|/i.test(locks) || /\|false\|/.test(locks)) {
    // narrow: any ungranted advisory for our pids
    const parts = locks.split(";").filter(Boolean);
    return parts.some((p) => p.includes("|false|") && p.includes("advisory"));
  }
  return false;
}

/**
 * Run two concurrent RPC callers while coordinator holds advisory lock keys.
 *
 * Barrier modes:
 * - package: hold two-key package identity lock from lockChecksum / holdLockKeys
 * - request: hold single-key request identity lock from holdRequestId
 */
async function runBarrierScenario(dbUrl, workDir, scenario) {
  const {
    name,
    lockChecksum,
    callerA,
    callerB,
    labels,
    assert,
    requireWait = true,
    holdLockKeys = null,
    holdRequestId = null,
    barrierMode = holdRequestId ? "request" : "package",
  } = scenario;

  cleanupFixture(dbUrl, labels);

  const coordApp = `b2d1-coord-${name}`;

  let keys;
  let requestKey = null;
  let coordSql;
  if (barrierMode === "request") {
    if (!holdRequestId) {
      fail(`Scenario ${name} barrierMode=request requires holdRequestId`);
    }
    requestKey = requestLockKey(dbUrl, holdRequestId);
    keys = { mode: "request", requestId: holdRequestId, key: requestKey };
    coordSql = buildRequestBarrierCoordSql(coordApp, requestKey);
  } else {
    keys = holdLockKeys ?? lockKeys(dbUrl, lockChecksum);
    keys = { mode: "package", ...keys };
    coordSql = buildPackageBarrierCoordSql(coordApp, keys.k1, keys.k2);
  }

  // Coordinator holds session-level advisory lock (contends with xact lock).
  const coordPath = join(workDir, `${name}-coord.sql`);
  const coordLog = join(workDir, `${name}-coord.log`);
  writeFileSync(coordPath, coordSql);
  const coord = spawnPsqlFile(dbUrl, coordPath, coordLog);

  // Wait until coordinator reports lock held
  const coordReadyDeadline = Date.now() + 10_000;
  let coordPid = null;
  while (Date.now() < coordReadyDeadline) {
    const { stdout } = coord.getOutput();
    const m = stdout.match(/COORD_PID\s+(\d+)/);
    if (m && stdout.includes("COORD_LOCK_HELD")) {
      coordPid = Number(m[1]);
      break;
    }
    await sleep(50);
  }
  if (coordPid == null) {
    coord.child.kill("SIGTERM");
    fail(`Coordinator failed to acquire barrier lock for ${name}`, {
      CoordLog: readFileSync(coordLog, "utf8").slice(0, 500),
    });
  }

  const sqlABuilt = buildRpcSql({ ...callerA, tag: `A-${name}` });
  const sqlBBuilt = buildRpcSql({ ...callerB, tag: `B-${name}` });

  const pathA = join(workDir, `${name}-a.sql`);
  const pathB = join(workDir, `${name}-b.sql`);
  const logA = join(workDir, `${name}-a.log`);
  const logB = join(workDir, `${name}-b.log`);
  writeFileSync(pathA, sqlABuilt);
  writeFileSync(pathB, sqlBBuilt);

  const startTs = nowIso();
  const callerAProc = spawnPsqlFile(dbUrl, pathA, logA);
  const callerBProc = spawnPsqlFile(dbUrl, pathB, logB);

  // Wait for distinct backend PIDs in activity and optional advisory wait
  let waitEvidence = null;
  let observedPids = { a: null, b: null };
  const waitDeadline = Date.now() + WAIT_TIMEOUT_MS;
  let sawWait = false;

  while (Date.now() < waitDeadline) {
    // application names from buildRpcSql: b2d1-caller-A-${name}
    const names = [`b2d1-caller-A-${name}`, `b2d1-caller-B-${name}`, coordApp];
    const state = queryWaitState(dbUrl, names);
    const actParts = state.activity.split(";").filter(Boolean);
    for (const row of actParts) {
      const [pid, app] = row.split("|");
      if (app === `b2d1-caller-A-${name}`) observedPids.a = Number(pid);
      if (app === `b2d1-caller-B-${name}`) observedPids.b = Number(pid);
    }
    if (requireWait && hasAdvisoryWait(state.activity, state.locks)) {
      sawWait = true;
      waitEvidence = {
        activity: state.activity,
        locks: state.locks,
        observedAt: nowIso(),
      };
      break;
    }
    if (!requireWait && observedPids.a && observedPids.b && observedPids.a !== observedPids.b) {
      // brief overlap window observation for non-contending scenario
      waitEvidence = {
        activity: state.activity,
        locks: state.locks,
        observedAt: nowIso(),
        note: "no_shared_lock_required",
      };
      break;
    }
    await sleep(WAIT_POLL_MS);
  }

  if (requireWait && !sawWait) {
    // Release lock then fail with evidence
    psqlSync(dbUrl, `SELECT pg_terminate_backend(${coordPid}); SELECT 1;`);
    await Promise.all([callerAProc.done, callerBProc.done]);
    fail(`No advisory-lock wait evidence for scenario ${name}`, {
      Scenario: name,
      LockKeys: keys,
      CoordinatorPid: coordPid,
      ObservedPids: observedPids,
      LastActivity: queryWaitState(dbUrl, [
        `b2d1-caller-A-${name}`,
        `b2d1-caller-B-${name}`,
        coordApp,
      ]),
    });
  }

  const releaseTs = nowIso();
  // Unlock via terminate of coordinator session (drops session advisory locks)
  psqlSync(dbUrl, `SELECT pg_terminate_backend(${coordPid}); SELECT 1;`);

  const [resA, resB] = await withTimeout(
    Promise.all([callerAProc.done, callerBProc.done]),
    CALLER_TIMEOUT_MS,
    () => {
      callerAProc.child.kill("SIGTERM");
      callerBProc.child.kill("SIGTERM");
      fail(`Caller timeout for scenario ${name}`);
    },
  );

  const completionTs = nowIso();
  const parsedA = parseCallerLog(resA.stdout);
  const parsedB = parseCallerLog(resB.stdout);

  if (resA.code !== 0 || resB.code !== 0) {
    fail(`Caller psql non-zero exit for ${name}`, {
      CodeA: resA.code,
      CodeB: resB.code,
      StderrA: resA.stderr.slice(0, 400),
      StderrB: resB.stderr.slice(0, 400),
    });
  }

  if (!parsedA.backendPid || !parsedB.backendPid) {
    fail(`Missing backend PIDs for ${name}`, { parsedA, parsedB, outA: resA.stdout.slice(0, 300) });
  }
  if (parsedA.backendPid === parsedB.backendPid) {
    fail(`Caller backend PIDs must differ for ${name}`, {
      PidA: parsedA.backendPid,
      PidB: parsedB.backendPid,
    });
  }
  if (parsedA.backendPid === coordPid || parsedB.backendPid === coordPid) {
    fail(`Caller PID collided with coordinator for ${name}`);
  }

  const counts = rowCounts(dbUrl, labels);
  const events = eventSummary(dbUrl, labels);

  const record = {
    scenario: name,
    coordinatorPid: coordPid,
    callerAPid: parsedA.backendPid,
    callerBPid: parsedB.backendPid,
    lockKey: keys,
    waitEvidence,
    startTs,
    releaseTs,
    completionTs,
    resultA: parsedA.result,
    resultB: parsedB.result,
    counts,
    events,
  };

  assert(record);
  cleanupFixture(dbUrl, labels);
  return record;
}

function outcomes(record) {
  return [record.resultA?.outcome, record.resultB?.outcome].sort();
}

async function main() {
  const dbUrl =
    process.env.B2D_CONCURRENCY_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_LOCAL_URL;
  assertLocalUrl(dbUrl);

  // Refuse linked remote markers
  if (process.env.SUPABASE_DB_URL && !/127\.0\.0\.1|localhost/.test(process.env.SUPABASE_DB_URL)) {
    fail("SUPABASE_DB_URL points at a non-local host; refusing to run");
  }

  // Connectivity + RPC presence
  const rpcCount = psqlSync(
    dbUrl,
    `SELECT count(*)::int FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'persist_measured_boq_catalog_draft';`,
  );
  if (rpcCount !== "1") {
    fail("persist_measured_boq_catalog_draft not found in local database", { rpcCount });
  }

  const workDir = mkdtempSync(join(tmpdir(), "b2d1-conc-"));
  const results = [];

  try {
    // ── 11.1 Exact concurrent request replay ──────────────────────────
    {
      const rev = REV.exactReplay;
      const labels = [rev];
      const arts = packageArtifacts(rev, "src-rplay");
      const inputCk = inputChecksum(dbUrl, arts.manifest, arts.snapshot);
      const requestId = "a1111111-1111-4111-8111-111111111111";
      const base = {
        manifest: arts.manifest,
        snapshot: arts.snapshot,
        catalogRevision: rev,
        sourceId: "src-rplay",
        inputCk,
        contentCk: CONTENT_CK,
        entries: arts.entries,
        report: arts.report,
        requestId,
      };
      const rec = await runBarrierScenario(dbUrl, workDir, {
        name: "exact_request_replay",
        lockChecksum: inputCk,
        labels,
        callerA: base,
        callerB: base,
        requireWait: true,
        assert: (r) => {
          const o = outcomes(r);
          if (!(o.includes("created") && o.includes("idempotent_replay"))) {
            fail("exact_request_replay expected created+idempotent_replay", { outcomes: o, r });
          }
          if (r.counts.revisions !== 1 || r.counts.packages !== 1 || r.counts.entries !== 1) {
            fail("exact_request_replay row counts", { counts: r.counts });
          }
          if (r.counts.events !== 1) {
            fail("exact_request_replay expected exactly 1 event", {
              counts: r.counts,
              events: r.events,
            });
          }
        },
      });
      results.push(rec);
    }

    // ── 11.2 Concurrent package replay (different request IDs) ────────
    {
      const rev = REV.packageReplay;
      const labels = [rev];
      const arts = packageArtifacts(rev, "src-pkg");
      const inputCk = inputChecksum(dbUrl, arts.manifest, arts.snapshot);
      const base = {
        manifest: arts.manifest,
        snapshot: arts.snapshot,
        catalogRevision: rev,
        sourceId: "src-pkg",
        inputCk,
        contentCk: CONTENT_CK,
        entries: arts.entries,
        report: arts.report,
      };
      const rec = await runBarrierScenario(dbUrl, workDir, {
        name: "package_replay",
        lockChecksum: inputCk,
        labels,
        callerA: { ...base, requestId: "a2222222-2222-4222-8222-222222222222" },
        callerB: { ...base, requestId: "a3333333-3333-4333-8333-333333333333" },
        requireWait: true,
        assert: (r) => {
          const o = outcomes(r);
          const ok =
            (o.includes("created") && o.includes("idempotent_replay")) ||
            (o[0] === "idempotent_replay" && o[1] === "idempotent_replay");
          if (!ok) fail("package_replay outcomes", { outcomes: o });
          if (r.counts.revisions !== 1 || r.counts.packages !== 1 || r.counts.entries !== 1) {
            fail("package_replay row counts", { counts: r.counts });
          }
          if (o.includes("created") && r.counts.events !== 2) {
            fail("package_replay expected 2 events for two request IDs", {
              counts: r.counts,
              events: r.events,
            });
          }
        },
      });
      results.push(rec);
    }

    // ── 11.3 Concurrent request conflict (same request_id, different payload)
    {
      const revA = REV.requestConflictA;
      const revB = REV.requestConflictB;
      const labels = [revA, revB];
      const artsA = packageArtifacts(revA, "src-rc-a");
      const artsB = packageArtifacts(revB, "src-rc-b", "paint.ceil.m2");
      const ckA = inputChecksum(dbUrl, artsA.manifest, artsA.snapshot);
      const ckB = inputChecksum(dbUrl, artsB.manifest, artsB.snapshot);
      if (ckA === ckB) fail("request_conflict fixtures must differ in input checksum");
      const requestId = "a4444444-4444-4444-8444-444444444444";
      const rec = await runBarrierScenario(dbUrl, workDir, {
        name: "request_conflict",
        holdRequestId: requestId,
        barrierMode: "request",
        labels,
        callerA: {
          manifest: artsA.manifest,
          snapshot: artsA.snapshot,
          catalogRevision: revA,
          sourceId: "src-rc-a",
          inputCk: ckA,
          contentCk: CONTENT_CK,
          entries: artsA.entries,
          report: artsA.report,
          requestId,
        },
        callerB: {
          manifest: artsB.manifest,
          snapshot: artsB.snapshot,
          catalogRevision: revB,
          sourceId: "src-rc-b",
          inputCk: ckB,
          contentCk: CONTENT_CK,
          entries: artsB.entries,
          report: artsB.report,
          requestId,
        },
        requireWait: true,
        assert: (r) => {
          const o = outcomes(r);
          const accepted = [r.resultA, r.resultB].filter(
            (x) => x && (x.outcome === "created" || x.outcome === "idempotent_replay"),
          );
          const conflicts = [r.resultA, r.resultB].filter(
            (x) => x && x.outcome === "request_conflict",
          );
          const failures = [r.resultA, r.resultB].filter(
            (x) => x && x.outcome === "database_failure",
          );
          if (failures.length > 0) {
            fail("request_conflict produced database_failure (unique_violation leakage)", {
              outcomes: o,
              results: { a: r.resultA, b: r.resultB },
              counts: r.counts,
            });
          }
          if (accepted.length !== 1 || conflicts.length !== 1) {
            fail("request_conflict expected one accepted and one request_conflict", {
              outcomes: o,
              accepted: accepted.length,
              conflicts: conflicts.length,
            });
          }
          if (r.counts.revisions !== 1 || r.counts.packages !== 1 || r.counts.entries !== 1) {
            fail("request_conflict expected single winning draft", { counts: r.counts });
          }
          if (r.counts.events !== 1) {
            fail("request_conflict expected exactly one event", { counts: r.counts });
          }
        },
      });
      results.push(rec);
    }

    // ── 11.3b B2D2R cross-package request conflict (request lock barrier) ─
    {
      const revA = REV.crossPackageA;
      const revB = REV.crossPackageB;
      const labels = [revA, revB];
      const artsA = packageArtifacts(revA, "src-xpkg-a", "paint.wall.m2");
      const artsB = packageArtifacts(revB, "src-xpkg-b", "plaster.wall.m2");
      const ckA = inputChecksum(dbUrl, artsA.manifest, artsA.snapshot);
      const ckB = inputChecksum(dbUrl, artsB.manifest, artsB.snapshot);
      if (ckA === ckB) {
        fail("cross_package_request_conflict fixtures must differ in input checksum", {
          ckA,
          ckB,
        });
      }
      if (revA === revB) {
        fail("cross_package_request_conflict fixtures must differ in catalogue revision");
      }
      const requestId = "a9999999-9999-4999-8999-999999999999";
      const rec = await runBarrierScenario(dbUrl, workDir, {
        name: "cross_package_request_conflict",
        holdRequestId: requestId,
        barrierMode: "request",
        labels,
        callerA: {
          manifest: artsA.manifest,
          snapshot: artsA.snapshot,
          catalogRevision: revA,
          sourceId: "src-xpkg-a",
          inputCk: ckA,
          contentCk: CONTENT_CK,
          entries: artsA.entries,
          report: artsA.report,
          requestId,
        },
        callerB: {
          manifest: artsB.manifest,
          snapshot: artsB.snapshot,
          catalogRevision: revB,
          sourceId: "src-xpkg-b",
          inputCk: ckB,
          contentCk: CONTENT_CK,
          entries: artsB.entries,
          report: artsB.report,
          requestId,
        },
        requireWait: true,
        assert: (r) => {
          const o = outcomes(r);
          const created = [r.resultA, r.resultB].filter((x) => x && x.outcome === "created");
          const conflicts = [r.resultA, r.resultB].filter(
            (x) => x && x.outcome === "request_conflict",
          );
          const failures = [r.resultA, r.resultB].filter(
            (x) => x && x.outcome === "database_failure",
          );
          if (failures.length > 0) {
            fail(
              "cross_package_request_conflict produced database_failure (unique_violation leakage)",
              {
                outcomes: o,
                results: { a: r.resultA, b: r.resultB },
                counts: r.counts,
                waitEvidence: r.waitEvidence,
              },
            );
          }
          if (created.length !== 1 || conflicts.length !== 1) {
            fail("cross_package_request_conflict expected created + request_conflict", {
              outcomes: o,
              created: created.length,
              conflicts: conflicts.length,
            });
          }
          if (r.counts.revisions !== 1 || r.counts.packages !== 1 || r.counts.entries !== 1) {
            fail("cross_package_request_conflict expected single winning draft identity", {
              counts: r.counts,
            });
          }
          if (r.counts.events !== 1) {
            fail("cross_package_request_conflict expected exactly one accepted event", {
              counts: r.counts,
              events: r.events,
            });
          }
          // Losing catalogue label must leave zero rows.
          const winnerRev =
            r.resultA?.outcome === "created"
              ? r.resultA
              : r.resultB?.outcome === "created"
                ? r.resultB
                : null;
          if (!winnerRev) {
            fail("cross_package_request_conflict missing created winner payload", {
              results: { a: r.resultA, b: r.resultB },
            });
          }
        },
      });
      results.push({
        ...rec,
        inputChecksumA: ckA,
        inputChecksumB: ckB,
        sharedRequestId: requestId,
        requestLockNamespace: PERSIST_REQUEST_LOCK_NS + PERSIST_CMD_SCOPE,
      });
    }

    // ── 11.4 Concurrent revision conflict ─────────────────────────────
    {
      const rev = REV.revisionConflict;
      const labels = [rev];
      const artsA = packageArtifacts(rev, "src-rev-a");
      const artsB = {
        ...packageArtifacts(rev, "src-rev-b", "plaster.wall.m2"),
      };
      artsB.snapshot = artsB.snapshot.replace("12.5", "13.5");
      const ckA = inputChecksum(dbUrl, artsA.manifest, artsA.snapshot);
      const ckB = inputChecksum(dbUrl, artsB.manifest, artsB.snapshot);
      if (ckA === ckB) fail("revision_conflict fixtures must differ in input checksum");
      const rec = await runBarrierScenario(dbUrl, workDir, {
        name: "revision_conflict",
        lockChecksum: ckA,
        labels,
        callerA: {
          manifest: artsA.manifest,
          snapshot: artsA.snapshot,
          catalogRevision: rev,
          sourceId: "src-rev-a",
          inputCk: ckA,
          contentCk: CONTENT_CK,
          entries: artsA.entries,
          report: artsA.report,
          requestId: "a5555555-5555-4555-8555-555555555555",
        },
        callerB: {
          manifest: artsB.manifest,
          snapshot: artsB.snapshot,
          catalogRevision: rev,
          sourceId: "src-rev-b",
          inputCk: ckB,
          contentCk: CONTENT_CK,
          entries: artsB.entries,
          report: artsB.report,
          requestId: "a6666666-6666-4666-8666-666666666666",
        },
        requireWait: true,
        assert: (r) => {
          const o = outcomes(r);
          const failures = o.filter((x) => x === "database_failure");
          if (failures.length > 0) {
            fail("revision_conflict produced database_failure", { outcomes: o, r });
          }
          if (!(o.includes("created") && o.includes("revision_conflict"))) {
            fail("revision_conflict expected created+revision_conflict", { outcomes: o });
          }
          if (r.counts.revisions !== 1 || r.counts.packages !== 1 || r.counts.entries !== 1) {
            fail("revision_conflict expected single draft identity", { counts: r.counts });
          }
        },
      });
      results.push(rec);
    }

    // ── 11.5 Different packages (no global serialisation) ─────────────
    {
      const revA = REV.independentA;
      const revB = REV.independentB;
      const labels = [revA, revB];
      const artsA = packageArtifacts(revA, "src-ind-a");
      const artsB = packageArtifacts(revB, "src-ind-b", "tile.floor.m2");
      const ckA = inputChecksum(dbUrl, artsA.manifest, artsA.snapshot);
      const ckB = inputChecksum(dbUrl, artsB.manifest, artsB.snapshot);
      const keysA = lockKeys(dbUrl, ckA);
      const keysB = lockKeys(dbUrl, ckB);
      if (keysA.k1 === keysB.k1 && keysA.k2 === keysB.k2) {
        fail("independent packages unexpectedly share lock keys", { keysA, keysB });
      }

      // Hold only package A lock; B must complete while A is still blocked.
      cleanupFixture(dbUrl, labels);
      const coordApp = "b2d1-coord-independent";
      const coordSql = `
SELECT set_config('application_name', ${sqlLiteral(coordApp)}, false);
SELECT pg_backend_pid() AS backend_pid \\gset
\\echo COORD_PID :backend_pid
SELECT pg_advisory_lock(${keysA.k1}, ${keysA.k2});
\\echo COORD_LOCK_HELD
SELECT pg_sleep(120);
`;
      const coordPath = join(workDir, "independent-coord.sql");
      const coordLog = join(workDir, "independent-coord.log");
      writeFileSync(coordPath, coordSql);
      const coord = spawnPsqlFile(dbUrl, coordPath, coordLog);
      let coordPid = null;
      const readyDeadline = Date.now() + 10_000;
      while (Date.now() < readyDeadline) {
        const { stdout } = coord.getOutput();
        const m = stdout.match(/COORD_PID\s+(\d+)/);
        if (m && stdout.includes("COORD_LOCK_HELD")) {
          coordPid = Number(m[1]);
          break;
        }
        await sleep(50);
      }
      if (coordPid == null) fail("independent: coordinator not ready");

      const pathA = join(workDir, "independent-a.sql");
      const pathB = join(workDir, "independent-b.sql");
      writeFileSync(
        pathA,
        buildRpcSql({
          manifest: artsA.manifest,
          snapshot: artsA.snapshot,
          catalogRevision: revA,
          sourceId: "src-ind-a",
          inputCk: ckA,
          contentCk: CONTENT_CK,
          entries: artsA.entries,
          report: artsA.report,
          requestId: "a7777777-7777-4777-8777-777777777777",
          tag: "A-independent",
        }),
      );
      writeFileSync(
        pathB,
        buildRpcSql({
          manifest: artsB.manifest,
          snapshot: artsB.snapshot,
          catalogRevision: revB,
          sourceId: "src-ind-b",
          inputCk: ckB,
          contentCk: CONTENT_CK,
          entries: artsB.entries,
          report: artsB.report,
          requestId: "a8888888-8888-4888-8888-888888888888",
          tag: "B-independent",
        }),
      );

      const startTs = nowIso();
      const procA = spawnPsqlFile(dbUrl, pathA, join(workDir, "independent-a.log"));
      const procB = spawnPsqlFile(dbUrl, pathB, join(workDir, "independent-b.log"));

      // B must finish while coordinator still holds A's lock (A still blocked).
      const resB = await withTimeout(procB.done, 15_000, () => {
        fail("independent: caller B did not complete while A locked");
      });
      const bFinishedWhileABlocked = nowIso();
      const parsedB = parseCallerLog(resB.stdout);
      if (resB.code !== 0 || parsedB.result?.outcome !== "created") {
        fail("independent: B should create while A is blocked", { parsedB, code: resB.code });
      }

      // Confirm A is still blocked on the package-A advisory lock.
      const midState = queryWaitState(dbUrl, [
        "b2d1-caller-A-independent",
        "b2d1-caller-B-independent",
        coordApp,
      ]);
      const aOutMid = procA.getOutput().stdout;
      if (aOutMid.includes("RPC_RESULT")) {
        fail("independent: A completed before barrier release — unexpected global serialisation", {
          midState,
        });
      }
      if (!hasAdvisoryWait(midState.activity, midState.locks)) {
        fail("independent: expected A to wait on package-scoped advisory lock", {
          midState,
          aOut: aOutMid.slice(0, 200),
        });
      }

      const releaseTs = nowIso();
      psqlSync(dbUrl, `SELECT pg_terminate_backend(${coordPid}); SELECT 1;`);
      const resA = await withTimeout(procA.done, CALLER_TIMEOUT_MS, () => {
        procA.child.kill("SIGTERM");
        fail("independent: caller A timeout after barrier release");
      });
      const parsedA = parseCallerLog(resA.stdout);
      if (resA.code !== 0 || parsedA.result?.outcome !== "created") {
        fail("independent: A should create after release", { parsedA, code: resA.code });
      }
      if (parsedA.backendPid === parsedB.backendPid) {
        fail("independent: PIDs must differ", { a: parsedA.backendPid, b: parsedB.backendPid });
      }
      const counts = rowCounts(dbUrl, labels);
      if (counts.revisions !== 2 || counts.packages !== 2 || counts.entries !== 2) {
        fail("independent: expected two full drafts", { counts });
      }
      results.push({
        scenario: "independent_packages",
        coordinatorPid: coordPid,
        callerAPid: parsedA.backendPid,
        callerBPid: parsedB.backendPid,
        lockKey: { a: keysA, b: keysB },
        waitEvidence: midState,
        startTs,
        bFinishedWhileABlocked,
        releaseTs,
        completionTs: nowIso(),
        resultA: parsedA.result,
        resultB: parsedB.result,
        counts,
        events: eventSummary(dbUrl, labels),
      });
      cleanupFixture(dbUrl, labels);
    }

    const requiredScenarios = [
      "exact_request_replay",
      "package_replay",
      "request_conflict",
      "revision_conflict",
      "independent_packages",
      "cross_package_request_conflict",
    ];
    const present = new Set(results.map((r) => r.scenario));
    for (const req of requiredScenarios) {
      if (!present.has(req)) {
        fail(`Required scenario missing from results: ${req}`, {
          Present: [...present],
        });
      }
    }

    const summary = {
      Status: "PASS",
      Phase: "4C2E-B2D2R",
      DatabaseUrlHost: new URL(dbUrl).hostname,
      ScenarioCount: results.length,
      Scenarios: results.map((r) => ({
        scenario: r.scenario,
        coordinatorPid: r.coordinatorPid,
        callerAPid: r.callerAPid,
        callerBPid: r.callerBPid,
        lockKey: r.lockKey,
        waitEvidence: r.waitEvidence,
        outcomes: [r.resultA?.outcome, r.resultB?.outcome],
        counts: r.counts,
        pidsDistinct: r.callerAPid !== r.callerBPid,
        inputChecksumA: r.inputChecksumA ?? null,
        inputChecksumB: r.inputChecksumB ?? null,
        sharedRequestId: r.sharedRequestId ?? null,
      })),
      Timestamp: nowIso(),
    };
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 0;
  } catch (err) {
    if (process.exitCode !== 1) {
      fail(err instanceof Error ? err.message : String(err));
    }
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      Status: "FAIL",
      Error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
