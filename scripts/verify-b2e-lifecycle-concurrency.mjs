#!/usr/bin/env node
/**
 * 4C2E-B2E — Multi-session concurrency verifier for catalogue lifecycle RPCs.
 *
 * Uses independent local psql processes (distinct backend PIDs), row-lock
 * waits via pg_locks / pg_stat_activity, and bounded timeouts.
 *
 * Local Supabase only. Non-zero exit on any unmet concurrency condition.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const CONTENT_CK = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WAIT_POLL_MS = 100;
const WAIT_TIMEOUT_MS = 20_000;
const CALLER_TIMEOUT_MS = 45_000;

const LABELS = {
  publishReplay: "mboq-2099.11.01",
  publishAlready: "mboq-2099.11.02",
  retireReplay: "mboq-2099.11.03",
  retireConflict: "mboq-2099.11.04",
  rollbackTarget: "mboq-2099.11.05",
  rollbackPrior: "mboq-2099.11.06",
  independentA: "mboq-2099.11.07",
  independentB: "mboq-2099.11.08",
  rightsUnverified: "mboq-2099.11.09",
};

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
    fail("Refusing non-local database host for B2E lifecycle concurrency verifier", {
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

function packageArtifacts(catalogRevision, sourceId, licenceStatus = "synthetic") {
  const manifest = JSON.stringify({
    manifestVersion: "1",
    catalogRevision,
    source: {
      id: sourceId,
      name: "S",
      version: "1",
      effectiveDate: "2099-11-01",
      licenceReference: licenceStatus === "synthetic" ? "syn" : "ru",
      licenceStatus,
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
    effectiveFrom: "2099-11-01",
    sourceDescription: `SYNTHETIC B2E CONCURRENCY FIXTURE ${catalogRevision}`,
    entryCount: 1,
    production: false,
    entries: [
      {
        rateKey: "paint.wall.m2",
        displayName: "Paint walls",
        description: null,
        tradeOrDomain: "decor",
        unit: "m2",
        costType: "labour",
        baseUnitRate: 12.5,
        currency: "GBP",
        vatBasis: "exclusive",
        sourceReference: licenceStatus === "synthetic" ? "synthetic" : "ru",
        status: "active",
        replacementRateKey: null,
      },
    ],
  });
  const entries = JSON.stringify([
    {
      rate_key: "paint.wall.m2",
      display_name: "Paint walls",
      description: null,
      trade_or_domain: "decor",
      unit: "m2",
      cost_type: "labour",
      base_unit_rate: 12.5,
      currency: "GBP",
      vat_basis: "exclusive",
      source_reference: licenceStatus === "synthetic" ? "synthetic" : "ru",
      status: "active",
      replacement_rate_key: null,
    },
  ]);
  const report = JSON.stringify({
    tool: "catalogue-persist",
    ok: true,
    licenceStatus,
    production: false,
    schemaVersion: "1",
    effectiveFrom: "2099-11-01",
    sourceDescription: `SYNTHETIC B2E CONCURRENCY FIXTURE ${catalogRevision}`,
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

function cleanupFixture(dbUrl, labels) {
  const inList = labels.map(sqlLiteral).join(",");
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

function persistDraft(dbUrl, catalogRevision, sourceId, requestId, licenceStatus = "synthetic") {
  const arts = packageArtifacts(catalogRevision, sourceId, licenceStatus);
  const ck = inputChecksum(dbUrl, arts.manifest, arts.snapshot);
  const out = psqlSync(
    dbUrl,
    `SELECT public.persist_measured_boq_catalog_draft(
      ${sqlLiteral(arts.manifest)},
      ${sqlLiteral(arts.snapshot)},
      ${sqlLiteral(catalogRevision)},
      ${sqlLiteral(sourceId)},
      1,
      '1',
      ${sqlLiteral(ck)},
      ${sqlLiteral(CONTENT_CK)},
      ${sqlLiteral(arts.entries)}::jsonb,
      ${sqlLiteral(arts.report)}::jsonb,
      ${sqlLiteral(requestId)}::uuid
    )::text;`,
  );
  const parsed = JSON.parse(out);
  if (parsed.outcome !== "created" && parsed.outcome !== "idempotent_replay") {
    fail("persistDraft failed", { CatalogRevision: catalogRevision, Result: parsed });
  }
  return parsed;
}

function publishSync(dbUrl, revisionId, requestId) {
  const out = psqlSync(
    dbUrl,
    `SELECT public.publish_measured_boq_catalog_revision(
      ${sqlLiteral(revisionId)}::uuid,
      'draft',
      ${sqlLiteral(requestId)}::uuid
    )::text;`,
  );
  return JSON.parse(out);
}

function revisionIdFor(dbUrl, label) {
  return psqlSync(
    dbUrl,
    `SELECT id::text FROM public.measured_boq_catalog_revisions WHERE catalog_revision = ${sqlLiteral(label)};`,
  );
}

function statusFor(dbUrl, label) {
  return psqlSync(
    dbUrl,
    `SELECT status FROM public.measured_boq_catalog_revisions WHERE catalog_revision = ${sqlLiteral(label)};`,
  );
}

function eventCount(dbUrl, labels, eventType = null) {
  const inList = labels.map(sqlLiteral).join(",");
  const typeFilter = eventType ? ` AND event_type = ${sqlLiteral(eventType)}` : "";
  return Number(
    psqlSync(
      dbUrl,
      `SELECT count(*)::int FROM public.measured_boq_catalog_events
       WHERE catalog_revision IN (${inList})${typeFilter};`,
    ),
  );
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

async function waitForLockWait(dbUrl, applicationNames, timeoutMs = WAIT_TIMEOUT_MS) {
  const names = applicationNames.map(sqlLiteral).join(",");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const waiting = psqlSync(
      dbUrl,
      `SELECT count(*)::int
       FROM pg_catalog.pg_stat_activity a
       JOIN pg_catalog.pg_locks l ON l.pid = a.pid
       WHERE a.application_name IN (${names})
         AND NOT l.granted
         AND l.locktype = 'relation';`,
    );
    if (Number(waiting) > 0) return true;
    // Also accept transactionid / tuple waits common for FOR UPDATE
    const anyWait = psqlSync(
      dbUrl,
      `SELECT count(*)::int
       FROM pg_catalog.pg_stat_activity a
       JOIN pg_catalog.pg_locks l ON l.pid = a.pid
       WHERE a.application_name IN (${names})
         AND NOT l.granted;`,
    );
    if (Number(anyWait) > 0) return true;
    await sleep(WAIT_POLL_MS);
  }
  return false;
}

function buildLifecycleSql({ fn, args, tag }) {
  // args is array of SQL expressions already literalised
  return `
BEGIN;
SELECT set_config('application_name', ${sqlLiteral(`b2e-caller-${tag}`)}, false);
SELECT pg_backend_pid() AS backend_pid \\gset
\\echo BACKEND_PID :backend_pid
SELECT ${fn}(
  ${args.join(",\n  ")}
) AS result \\gset
\\echo RPC_RESULT :result
COMMIT;
`;
}

async function runContendedPair({
  dbUrl,
  workDir,
  name,
  holderSql,
  callerA,
  callerB,
  requireWait = true,
}) {
  const holderPath = join(workDir, `${name}-holder.sql`);
  const aPath = join(workDir, `${name}-a.sql`);
  const bPath = join(workDir, `${name}-b.sql`);
  writeFileSync(holderPath, holderSql);
  writeFileSync(aPath, callerA.sql);
  writeFileSync(bPath, callerB.sql);

  const holder = spawnPsqlFile(dbUrl, holderPath, join(workDir, `${name}-holder.log`));
  await sleep(300);

  const a = spawnPsqlFile(dbUrl, aPath, join(workDir, `${name}-a.log`));
  const b = spawnPsqlFile(dbUrl, bPath, join(workDir, `${name}-b.log`));

  // Give callers time to block on the held lock.
  await sleep(400);
  let sawWait = false;
  if (requireWait) {
    sawWait = await waitForLockWait(dbUrl, [
      `b2e-caller-${callerA.tag}`,
      `b2e-caller-${callerB.tag}`,
    ]);
  }

  // Release holder by terminating it (rollback open TX).
  try {
    holder.child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  await holder.done.catch(() => {});

  const [resA, resB] = await Promise.all([
    withTimeout(a.done, CALLER_TIMEOUT_MS, () => {
      try {
        a.child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      fail(`${name}: caller A timed out`);
    }),
    withTimeout(b.done, CALLER_TIMEOUT_MS, () => {
      try {
        b.child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      fail(`${name}: caller B timed out`);
    }),
  ]);

  const parsedA = parseCallerLog(resA.stdout);
  const parsedB = parseCallerLog(resB.stdout);

  if (!parsedA.backendPid || !parsedB.backendPid) {
    fail(`${name}: missing backend PIDs`, {
      A: parsedA,
      B: parsedB,
      stdoutA: resA.stdout.slice(0, 400),
      stdoutB: resB.stdout.slice(0, 400),
    });
  }
  if (parsedA.backendPid === parsedB.backendPid) {
    fail(`${name}: backend PIDs not distinct`, {
      Pid: parsedA.backendPid,
    });
  }
  if (requireWait && !sawWait) {
    fail(`${name}: expected advisory/row lock wait was not observed`, {
      PidA: parsedA.backendPid,
      PidB: parsedB.backendPid,
    });
  }
  if (!parsedA.result || !parsedB.result) {
    fail(`${name}: missing RPC results`, { parsedA, parsedB });
  }

  return {
    sawWait,
    a: parsedA,
    b: parsedB,
    outcomes: [parsedA.result.outcome, parsedB.result.outcome].sort(),
  };
}

function holderLockRevisionSql(revisionId) {
  return `
BEGIN;
SELECT set_config('application_name', 'b2e-holder', false);
SELECT id FROM public.measured_boq_catalog_revisions
WHERE id = ${sqlLiteral(revisionId)}::uuid
FOR UPDATE;
SELECT pg_sleep(30);
COMMIT;
`;
}

function holderLockTwoSql(id1, id2) {
  const first = id1 < id2 ? id1 : id2;
  const second = id1 < id2 ? id2 : id1;
  return `
BEGIN;
SELECT set_config('application_name', 'b2e-holder', false);
SELECT id FROM public.measured_boq_catalog_revisions
WHERE id = ${sqlLiteral(first)}::uuid
FOR UPDATE;
SELECT id FROM public.measured_boq_catalog_revisions
WHERE id = ${sqlLiteral(second)}::uuid
FOR UPDATE;
SELECT pg_sleep(30);
COMMIT;
`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || DEFAULT_LOCAL_URL;
  assertLocalUrl(dbUrl);

  const allLabels = Object.values(LABELS);
  const workDir = mkdtempSync(join(tmpdir(), "b2e-lifecycle-"));
  const report = {
    Status: "PASS",
    Timestamp: nowIso(),
    Scenarios: {},
  };

  try {
    cleanupFixture(dbUrl, allLabels);

    // ── Seed drafts ────────────────────────────────────────────────
    const seeds = [
      [LABELS.publishReplay, "src-pr", "e1111111-1111-4111-8111-111111111101"],
      [LABELS.publishAlready, "src-pa", "e1111111-1111-4111-8111-111111111102"],
      [LABELS.retireReplay, "src-rr", "e1111111-1111-4111-8111-111111111103"],
      [LABELS.retireConflict, "src-rc", "e1111111-1111-4111-8111-111111111104"],
      [LABELS.rollbackTarget, "src-rt", "e1111111-1111-4111-8111-111111111105"],
      [LABELS.rollbackPrior, "src-rp", "e1111111-1111-4111-8111-111111111106"],
      [LABELS.independentA, "src-ia", "e1111111-1111-4111-8111-111111111107"],
      [LABELS.independentB, "src-ib", "e1111111-1111-4111-8111-111111111108"],
      [
        LABELS.rightsUnverified,
        "src-ru",
        "e1111111-1111-4111-8111-111111111109",
        "rights_unverified",
      ],
    ];
    for (const [label, src, req, licence] of seeds) {
      persistDraft(dbUrl, label, src, req, licence || "synthetic");
    }

    const ids = Object.fromEntries(allLabels.map((label) => [label, revisionIdFor(dbUrl, label)]));

    // Pre-publish those needed as published (fixed unique request IDs).
    const seedPublishRequests = {
      [LABELS.retireReplay]: "e2111111-1111-4111-8111-111111111201",
      [LABELS.retireConflict]: "e2111111-1111-4111-8111-111111111202",
      [LABELS.rollbackTarget]: "e2111111-1111-4111-8111-111111111203",
      [LABELS.rollbackPrior]: "e2111111-1111-4111-8111-111111111204",
      [LABELS.independentA]: "e2111111-1111-4111-8111-111111111205",
      [LABELS.independentB]: "e2111111-1111-4111-8111-111111111206",
    };
    for (const [label, req] of Object.entries(seedPublishRequests)) {
      const res = publishSync(dbUrl, ids[label], req);
      if (res.outcome !== "published") {
        fail("seed publish failed", { label, res });
      }
    }

    // 1) Concurrent exact publish replay
    {
      const rev = ids[LABELS.publishReplay];
      const req = "f1111111-1111-4111-8111-111111111201";
      const held = await runContendedPair({
        dbUrl,
        workDir,
        name: "exact_publish_replay",
        holderSql: holderLockRevisionSql(rev),
        callerA: {
          tag: "pub-replay-a",
          sql: buildLifecycleSql({
            fn: "public.publish_measured_boq_catalog_revision",
            args: [`${sqlLiteral(rev)}::uuid`, sqlLiteral("draft"), `${sqlLiteral(req)}::uuid`],
            tag: "pub-replay-a",
          }),
        },
        callerB: {
          tag: "pub-replay-b",
          sql: buildLifecycleSql({
            fn: "public.publish_measured_boq_catalog_revision",
            args: [`${sqlLiteral(rev)}::uuid`, sqlLiteral("draft"), `${sqlLiteral(req)}::uuid`],
            tag: "pub-replay-b",
          }),
        },
      });
      const set = new Set(held.outcomes);
      if (!(set.has("published") && set.has("idempotent_replay"))) {
        fail("exact_publish_replay unexpected outcomes", { outcomes: held.outcomes });
      }
      if (statusFor(dbUrl, LABELS.publishReplay) !== "published") {
        fail("exact_publish_replay final status not published");
      }
      if (eventCount(dbUrl, [LABELS.publishReplay], "publication") !== 1) {
        fail("exact_publish_replay expected one publication event");
      }
      report.Scenarios.exact_publish_replay = {
        outcomes: held.outcomes,
        pids: [held.a.backendPid, held.b.backendPid],
        sawWait: held.sawWait,
      };
    }

    // 2) Concurrent publish different request IDs → published + already_published
    {
      const rev = ids[LABELS.publishAlready];
      const held = await runContendedPair({
        dbUrl,
        workDir,
        name: "publish_already",
        holderSql: holderLockRevisionSql(rev),
        callerA: {
          tag: "pub-already-a",
          sql: buildLifecycleSql({
            fn: "public.publish_measured_boq_catalog_revision",
            args: [
              `${sqlLiteral(rev)}::uuid`,
              sqlLiteral("draft"),
              `'f1111111-1111-4111-8111-111111111202'::uuid`,
            ],
            tag: "pub-already-a",
          }),
        },
        callerB: {
          tag: "pub-already-b",
          sql: buildLifecycleSql({
            fn: "public.publish_measured_boq_catalog_revision",
            args: [
              `${sqlLiteral(rev)}::uuid`,
              sqlLiteral("draft"),
              `'f1111111-1111-4111-8111-111111111203'::uuid`,
            ],
            tag: "pub-already-b",
          }),
        },
      });
      const set = new Set(held.outcomes);
      if (!(set.has("published") && set.has("already_published"))) {
        fail("publish_already unexpected outcomes", { outcomes: held.outcomes });
      }
      report.Scenarios.publish_already = {
        outcomes: held.outcomes,
        pids: [held.a.backendPid, held.b.backendPid],
        sawWait: held.sawWait,
      };
    }

    // 3) Concurrent exact retire replay
    {
      const rev = ids[LABELS.retireReplay];
      const req = "f1111111-1111-4111-8111-111111111204";
      const held = await runContendedPair({
        dbUrl,
        workDir,
        name: "exact_retire_replay",
        holderSql: holderLockRevisionSql(rev),
        callerA: {
          tag: "ret-replay-a",
          sql: buildLifecycleSql({
            fn: "public.retire_measured_boq_catalog_revision",
            args: [
              `${sqlLiteral(rev)}::uuid`,
              sqlLiteral("published"),
              sqlLiteral("concurrent retire"),
              `${sqlLiteral(req)}::uuid`,
            ],
            tag: "ret-replay-a",
          }),
        },
        callerB: {
          tag: "ret-replay-b",
          sql: buildLifecycleSql({
            fn: "public.retire_measured_boq_catalog_revision",
            args: [
              `${sqlLiteral(rev)}::uuid`,
              sqlLiteral("published"),
              sqlLiteral("concurrent retire"),
              `${sqlLiteral(req)}::uuid`,
            ],
            tag: "ret-replay-b",
          }),
        },
      });
      const set = new Set(held.outcomes);
      if (!(set.has("retired") && set.has("idempotent_replay"))) {
        fail("exact_retire_replay unexpected outcomes", { outcomes: held.outcomes });
      }
      report.Scenarios.exact_retire_replay = {
        outcomes: held.outcomes,
        pids: [held.a.backendPid, held.b.backendPid],
        sawWait: held.sawWait,
      };
    }

    // 4) Concurrent retire request conflict (same request, different reason)
    {
      const rev = ids[LABELS.retireConflict];
      const req = "f1111111-1111-4111-8111-111111111205";
      const held = await runContendedPair({
        dbUrl,
        workDir,
        name: "retire_request_conflict",
        holderSql: holderLockRevisionSql(rev),
        callerA: {
          tag: "ret-conf-a",
          sql: buildLifecycleSql({
            fn: "public.retire_measured_boq_catalog_revision",
            args: [
              `${sqlLiteral(rev)}::uuid`,
              sqlLiteral("published"),
              sqlLiteral("reason-a"),
              `${sqlLiteral(req)}::uuid`,
            ],
            tag: "ret-conf-a",
          }),
        },
        callerB: {
          tag: "ret-conf-b",
          sql: buildLifecycleSql({
            fn: "public.retire_measured_boq_catalog_revision",
            args: [
              `${sqlLiteral(rev)}::uuid`,
              sqlLiteral("published"),
              sqlLiteral("reason-b"),
              `${sqlLiteral(req)}::uuid`,
            ],
            tag: "ret-conf-b",
          }),
        },
      });
      const set = new Set(held.outcomes);
      if (!(set.has("retired") && set.has("request_conflict"))) {
        fail("retire_request_conflict unexpected outcomes", { outcomes: held.outcomes });
      }
      if (statusFor(dbUrl, LABELS.retireConflict) !== "retired") {
        fail("retire_request_conflict final status not retired");
      }
      report.Scenarios.retire_request_conflict = {
        outcomes: held.outcomes,
        pids: [held.a.backendPid, held.b.backendPid],
        sawWait: held.sawWait,
      };
    }

    // 5) Concurrent rollback (same target/prior, same request → one success + replay)
    {
      const target = ids[LABELS.rollbackTarget];
      const prior = ids[LABELS.rollbackPrior];
      const req = "f1111111-1111-4111-8111-111111111206";
      const held = await runContendedPair({
        dbUrl,
        workDir,
        name: "concurrent_rollback",
        holderSql: holderLockTwoSql(target, prior),
        callerA: {
          tag: "rb-a",
          sql: buildLifecycleSql({
            fn: "public.rollback_measured_boq_catalog_publication",
            args: [
              `${sqlLiteral(target)}::uuid`,
              `${sqlLiteral(prior)}::uuid`,
              sqlLiteral("published"),
              sqlLiteral("rollback concurrent"),
              `${sqlLiteral(req)}::uuid`,
            ],
            tag: "rb-a",
          }),
        },
        callerB: {
          tag: "rb-b",
          sql: buildLifecycleSql({
            fn: "public.rollback_measured_boq_catalog_publication",
            args: [
              // reversed argument order — lock order must still be ascending UUID
              `${sqlLiteral(target)}::uuid`,
              `${sqlLiteral(prior)}::uuid`,
              sqlLiteral("published"),
              sqlLiteral("rollback concurrent"),
              `${sqlLiteral(req)}::uuid`,
            ],
            tag: "rb-b",
          }),
        },
      });
      const set = new Set(held.outcomes);
      if (!(set.has("rollback_recorded") && set.has("idempotent_replay"))) {
        fail("concurrent_rollback unexpected outcomes", { outcomes: held.outcomes });
      }
      if (statusFor(dbUrl, LABELS.rollbackTarget) !== "retired") {
        fail("concurrent_rollback target not retired");
      }
      if (statusFor(dbUrl, LABELS.rollbackPrior) !== "published") {
        fail("concurrent_rollback prior not published");
      }
      report.Scenarios.concurrent_rollback = {
        outcomes: held.outcomes,
        pids: [held.a.backendPid, held.b.backendPid],
        sawWait: held.sawWait,
      };
    }

    // 6) Independent lifecycle operations (no global serialization required)
    {
      const a = ids[LABELS.independentA];
      const b = ids[LABELS.independentB];
      // no holder — just concurrent retire of unrelated revisions
      const aPath = join(workDir, "ind-a.sql");
      const bPath = join(workDir, "ind-b.sql");
      writeFileSync(
        aPath,
        buildLifecycleSql({
          fn: "public.retire_measured_boq_catalog_revision",
          args: [
            `${sqlLiteral(a)}::uuid`,
            sqlLiteral("published"),
            sqlLiteral("independent A"),
            `'f1111111-1111-4111-8111-111111111207'::uuid`,
          ],
          tag: "ind-a",
        }),
      );
      writeFileSync(
        bPath,
        buildLifecycleSql({
          fn: "public.retire_measured_boq_catalog_revision",
          args: [
            `${sqlLiteral(b)}::uuid`,
            sqlLiteral("published"),
            sqlLiteral("independent B"),
            `'f1111111-1111-4111-8111-111111111208'::uuid`,
          ],
          tag: "ind-b",
        }),
      );
      const ca = spawnPsqlFile(dbUrl, aPath, join(workDir, "ind-a.log"));
      const cb = spawnPsqlFile(dbUrl, bPath, join(workDir, "ind-b.log"));
      const [ra, rb] = await Promise.all([ca.done, cb.done]);
      const pa = parseCallerLog(ra.stdout);
      const pb = parseCallerLog(rb.stdout);
      if (!pa.backendPid || !pb.backendPid || pa.backendPid === pb.backendPid) {
        fail("independent_lifecycle PID proof failed", { pa, pb });
      }
      if (pa.result?.outcome !== "retired" || pb.result?.outcome !== "retired") {
        fail("independent_lifecycle unexpected outcomes", {
          a: pa.result,
          b: pb.result,
        });
      }
      report.Scenarios.independent_lifecycle = {
        outcomes: [pa.result.outcome, pb.result.outcome],
        pids: [pa.backendPid, pb.backendPid],
      };
    }

    // 7) Rights-unverified concurrent policy — no successful publish
    {
      const rev = ids[LABELS.rightsUnverified];
      const held = await runContendedPair({
        dbUrl,
        workDir,
        name: "rights_policy",
        holderSql: holderLockRevisionSql(rev),
        callerA: {
          tag: "rights-a",
          sql: buildLifecycleSql({
            fn: "public.publish_measured_boq_catalog_revision",
            args: [
              `${sqlLiteral(rev)}::uuid`,
              sqlLiteral("draft"),
              `'f1111111-1111-4111-8111-111111111209'::uuid`,
            ],
            tag: "rights-a",
          }),
        },
        callerB: {
          tag: "rights-b",
          sql: buildLifecycleSql({
            fn: "public.publish_measured_boq_catalog_revision",
            args: [
              `${sqlLiteral(rev)}::uuid`,
              sqlLiteral("draft"),
              `'f1111111-1111-4111-8111-11111111120a'::uuid`,
            ],
            tag: "rights-b",
          }),
        },
      });
      if (held.outcomes.some((o) => o === "published" || o === "already_published")) {
        fail("rights_policy unexpectedly published", { outcomes: held.outcomes });
      }
      if (!held.outcomes.every((o) => o === "rights_not_publishable")) {
        fail("rights_policy expected rights_not_publishable", { outcomes: held.outcomes });
      }
      if (statusFor(dbUrl, LABELS.rightsUnverified) !== "draft") {
        fail("rights_policy status mutated");
      }
      report.Scenarios.rights_policy = {
        outcomes: held.outcomes,
        pids: [held.a.backendPid, held.b.backendPid],
        sawWait: held.sawWait,
      };
    }

    cleanupFixture(dbUrl, allLabels);
    const residual = Number(
      psqlSync(
        dbUrl,
        `SELECT count(*)::int FROM public.measured_boq_catalog_revisions
         WHERE catalog_revision LIKE 'mboq-2099.11.%';`,
      ),
    );
    if (residual !== 0) {
      fail("cleanup left residual B2E concurrency fixtures", { residual });
    }

    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    try {
      cleanupFixture(dbUrl, allLabels);
    } catch {
      /* ignore cleanup errors after fail */
    }
    if (process.exitCode !== 1) {
      fail(err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
