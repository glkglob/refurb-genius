/**
 * Phase 4–5 — data architecture registry integrity and narrow drift ratchets.
 * Does not modify schema, RLS, SQL, or production code.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  DATA_DOMAINS,
  DATA_FLOWS,
  DATA_REGISTRY_META,
  DB_FUNCTIONS,
  EVIDENCED_BUCKET_IDS,
  MIGRATION_FILENAMES,
  MIGRATION_POLICY,
  MIGRATION_TIMESTAMP_PATTERN,
  PERSISTENCE_SURFACES,
  PUBLIC_TABLE_NAMES,
  PUBLIC_TABLES,
  RECOGNIZED_TENANT_SCOPES,
  SECURITY_INVENTORY,
  SERVICE_OWNERSHIP,
  STORAGE_BUCKETS,
  TENANT_BOUNDARIES,
  summarizeDataRegistry,
} from "./config/data/index.ts";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function extractGeneratedTableNames(): string[] {
  const typesPath = join(ROOT, DATA_REGISTRY_META.schemaSourceOfTruth);
  const text = readFileSync(typesPath, "utf8");
  const block = text.match(/Tables:\s*\{([\s\S]*?)\n {4}Views:/);
  assert.ok(block, "could not parse Tables from database.types.ts");
  const names: string[] = [];
  for (const m of block[1]!.matchAll(/\n {6}([a-z_][a-z0-9_]*): \{/g)) {
    names.push(m[1]!);
  }
  return names.sort();
}

function listMigrationFiles(): string[] {
  const dir = join(ROOT, MIGRATION_POLICY.location);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

test("data registry meta is Phase 5 integrity mode", () => {
  assert.equal(DATA_REGISTRY_META.phase, 5);
  assert.equal(DATA_REGISTRY_META.orgTenancyPresent, false);
  assert.ok(existsSync(join(ROOT, DATA_REGISTRY_META.schemaSourceOfTruth)));
  assert.ok(existsSync(join(ROOT, DATA_REGISTRY_META.migrationsSourceOfTruth)));
});

test("PUBLIC_TABLES matches generated Database types exactly (new/stale fail)", () => {
  const generated = extractGeneratedTableNames();
  const registered = PUBLIC_TABLE_NAMES;
  const missingInRegistry = generated.filter((t) => !registered.includes(t));
  const staleInRegistry = registered.filter((t) => !generated.includes(t));

  assert.deepEqual(
    missingInRegistry,
    [],
    `New public table(s) in database.types.ts without registry metadata. ` +
      `Add to tests/invariants/config/data/database-inventory.ts and a DATA_DOMAIN:\n` +
      missingInRegistry.map((t) => `- ${t}`).join("\n"),
  );
  assert.deepEqual(
    staleInRegistry,
    [],
    `Stale registry table(s) no longer in database.types.ts. ` +
      `Remove from tests/invariants/config/data/database-inventory.ts and domain maps:\n` +
      staleInRegistry.map((t) => `- ${t}`).join("\n"),
  );
  assert.deepEqual(registered, generated);
});

test("every registered table has domain ownership and tenant metadata", () => {
  const domainIds = new Set(DATA_DOMAINS.map((d) => d.id));
  for (const table of PUBLIC_TABLES) {
    assert.ok(table.domainId, `${table.name}: missing domainId`);
    assert.ok(domainIds.has(table.domainId), `${table.name}: unknown domain ${table.domainId}`);
    assert.ok(table.owner, `${table.name}: missing owner`);
    assert.ok(table.purpose, `${table.name}: missing purpose`);
    assert.ok(
      (RECOGNIZED_TENANT_SCOPES as readonly string[]).includes(table.tenantScope),
      `${table.name}: invalid tenantScope ${table.tenantScope}`,
    );
    assert.notEqual(
      table.tenantScope,
      "organisation",
      `${table.name}: organisation tenant scope unsupported (orgTenancyPresent=false)`,
    );
    assert.ok(table.enforcementStatus, `${table.name}: missing enforcementStatus`);
  }
});

test("every domain has complete ownership fields and valid persistenceKind", () => {
  const kinds = new Set(["persistent", "derived", "ephemeral", "external", "system-owned"]);
  for (const domain of DATA_DOMAINS) {
    assert.ok(domain.owner, domain.id);
    assert.ok(domain.sourceOfTruth, domain.id);
    assert.ok(domain.persistenceLayer, domain.id);
    assert.ok(domain.tenantScope, domain.id);
    assert.ok(domain.maturity, domain.id);
    assert.ok(domain.enforcementStatus, domain.id);
    assert.ok(kinds.has(domain.persistenceKind), `${domain.id}: bad persistenceKind`);
    assert.notEqual(
      domain.tenantScope,
      "organisation",
      `${domain.id}: organisation scope unsupported`,
    );
    if (domain.enforcementStatus === "enforced") {
      assert.ok(
        domain.enforcementEvidence && domain.enforcementEvidence.length > 0,
        `${domain.id}: enforced domain requires enforcementEvidence`,
      );
      for (const e of domain.enforcementEvidence!) {
        assert.ok(existsSync(join(ROOT, e)), `${domain.id}: missing evidence ${e}`);
      }
    }
    if (domain.persistenceKind === "persistent") {
      assert.ok(
        domain.tables.length > 0 || (domain.storageBuckets && domain.storageBuckets.length > 0),
        `${domain.id}: persistent domain needs tables or storage`,
      );
    }
    if (domain.persistenceKind === "system-owned" || domain.persistenceKind === "external") {
      // may have empty tables (auth)
      assert.ok(domain.sourceOfTruth.length > 0, domain.id);
    }
  }
});

test("every table is covered by exactly one domain membership list", () => {
  const covered = new Map<string, string>();
  for (const domain of DATA_DOMAINS) {
    for (const t of domain.tables) {
      assert.ok(
        !covered.has(t),
        `table ${t} listed in multiple domains: ${covered.get(t)} and ${domain.id}`,
      );
      covered.set(t, domain.id);
    }
  }
  for (const table of PUBLIC_TABLES) {
    assert.equal(
      covered.get(table.name),
      table.domainId,
      `table ${table.name}: domain list vs domainId mismatch (${covered.get(table.name)} vs ${table.domainId})`,
    );
  }
  const uncovered = PUBLIC_TABLE_NAMES.filter((t) => !covered.has(t));
  assert.deepEqual(uncovered, [], `tables missing from DATA_DOMAINS: ${uncovered.join(", ")}`);
});

test("storage buckets match evidence and registry (drift ratchet)", () => {
  const registered = STORAGE_BUCKETS.map((b) => b.id).sort();
  const evidenced = [...EVIDENCED_BUCKET_IDS].sort();
  assert.deepEqual(
    registered,
    evidenced,
    "Registered buckets must match EVIDENCED_BUCKET_IDS (update both when adding buckets)",
  );
  for (const bucket of STORAGE_BUCKETS) {
    assert.ok(bucket.evidencePaths.length > 0, `${bucket.id}: missing evidencePaths`);
    for (const p of bucket.evidencePaths) {
      assert.ok(existsSync(join(ROOT, p)), `${bucket.id}: evidence missing ${p}`);
    }
    // at least one migration must mention bucket id
    const hasMig = bucket.evidencePaths.some((p) => p.includes("supabase/migrations"));
    assert.ok(hasMig, `${bucket.id}: need migration evidence path`);
  }
});

test("migration filename inventory matches disk (new migration fails until registered)", () => {
  const disk = listMigrationFiles();
  const registered = [...MIGRATION_FILENAMES].sort();
  const missing = disk.filter(
    (f) => !registered.includes(f as (typeof MIGRATION_FILENAMES)[number]),
  );
  const stale = registered.filter((f) => !disk.includes(f));
  assert.deepEqual(
    missing,
    [],
    `New migration file(s) not in MIGRATION_FILENAMES. Update tests/invariants/config/data/migrations.ts:\n` +
      missing.map((f) => `- ${f}`).join("\n"),
  );
  assert.deepEqual(
    stale,
    [],
    `Stale MIGRATION_FILENAMES entries not on disk. Remove from migrations.ts:\n` +
      stale.map((f) => `- ${f}`).join("\n"),
  );
  const unique = new Set(disk);
  assert.equal(unique.size, disk.length, "duplicate migration filenames on disk");
  for (const f of disk) {
    assert.match(f, MIGRATION_TIMESTAMP_PATTERN, `invalid migration filename format: ${f}`);
  }
});

test("DB functions inventory has security metadata (partial coverage allowed)", () => {
  for (const fn of DB_FUNCTIONS) {
    assert.ok(fn.securityRelevance, fn.name);
    assert.ok(fn.coverage === "complete" || fn.coverage === "partial", fn.name);
    assert.ok(fn.evidence.length > 0, fn.name);
  }
  assert.ok(
    DB_FUNCTIONS.some((f) => f.coverage === "partial"),
    "expected partial coverage note for migration-only fns",
  );
});

test("tenant boundaries keep organisation unsupported", () => {
  assert.ok(TENANT_BOUNDARIES.some((b) => b.id === "no-org-tenancy"));
  assert.equal(DATA_REGISTRY_META.orgTenancyPresent, false);
});

test("persistence authority flags: pure compute and caches are non-durable", () => {
  const derived = PERSISTENCE_SURFACES.find((p) => p.id === "derived-financial");
  assert.ok(derived);
  assert.equal(derived!.authority.ownsDurableState, false);
  assert.equal(derived!.authority.derivesValues, true);

  const cache = PERSISTENCE_SURFACES.find((p) => p.id === "client-memory-cache");
  assert.ok(cache);
  assert.equal(cache!.authority.ownsDurableState, false);

  const ai = PERSISTENCE_SURFACES.find((p) => p.id === "ai-ephemeral");
  assert.ok(ai);
  assert.equal(ai!.authority.ownsDurableState, false);
  assert.equal(ai!.authority.externalProviderIo, true);

  const pg = PERSISTENCE_SURFACES.find((p) => p.id === "supabase-postgres");
  assert.ok(pg);
  assert.equal(pg!.authority.ownsDurableState, true);

  const browser = PERSISTENCE_SURFACES.find((p) => p.id === "browser-client-stores");
  assert.ok(browser?.transitional);
});

test("service authority: financial engines do not own durable state", () => {
  for (const id of ["pricing", "roi", "deal-scoring"]) {
    const svc = SERVICE_OWNERSHIP.find((s) => s.id === id);
    assert.ok(svc, id);
    assert.equal(svc!.authority.ownsDurableState, false, id);
    assert.equal(svc!.authority.derivesValues, true, id);
    if (svc!.enforcementStatus === "enforced") {
      assert.ok(svc!.enforcementEvidence?.length, `${id} needs enforcementEvidence`);
    }
  }
  const ai = SERVICE_OWNERSHIP.find((s) => s.id === "ai-providers");
  assert.equal(ai!.authority.externalProviderIo, true);
  assert.equal(ai!.authority.ownsDurableState, false);
});

test("enforced security items cite existing evidence paths", () => {
  for (const item of SECURITY_INVENTORY) {
    if (item.enforcementStatus !== "enforced") continue;
    assert.ok(item.evidence.length > 0, item.id);
    for (const e of item.evidence) {
      assert.ok(existsSync(join(ROOT, e)), `${item.id}: missing evidence ${e}`);
    }
  }
});

test("data lineage flows cite existing evidence paths", () => {
  for (const flow of DATA_FLOWS) {
    assert.ok(flow.steps.length >= 3, flow.id);
    for (const e of flow.evidence) {
      assert.ok(existsSync(join(ROOT, e)), `flow ${flow.id}: missing evidence ${e}`);
    }
  }
});

test("service ownership paths exist", () => {
  for (const svc of SERVICE_OWNERSHIP) {
    for (const p of svc.paths) {
      assert.ok(existsSync(join(ROOT, p)), `service ${svc.id}: missing path ${p}`);
    }
  }
});

test("emits data architecture registry summary", () => {
  const diskCount = listMigrationFiles().length;
  const summary = summarizeDataRegistry(diskCount);
  console.log("\n" + summary + "\n");
  assert.match(summary, /Domains: \d+/);
  assert.match(summary, /Tables: 36/);
  assert.match(summary, /Storage buckets: 4/);
  assert.match(summary, /Org tenancy present: false/);
});
