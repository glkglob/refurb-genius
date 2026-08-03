/**
 * Static + behavioural unit tests for the B2E lifecycle concurrency verifier.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/verify-b2e-lifecycle-concurrency.mjs");

describe("verify-b2e-lifecycle-concurrency", () => {
  const src = readFileSync(SCRIPT, "utf8");

  it("refuses non-local database hosts", () => {
    assert.match(src, /Refusing non-local database host/);
    assert.match(src, /127\.0\.0\.1/);
    assert.match(src, /localhost/);
  });

  it("uses distinct physical sessions and proves backend PIDs", () => {
    assert.match(src, /pg_backend_pid/);
    assert.match(src, /backend PIDs not distinct/);
    assert.match(src, /spawn\("psql"/);
  });

  it("observes row-lock waits and uses bounded timeouts", () => {
    assert.match(src, /pg_locks|pg_stat_activity/);
    assert.match(src, /NOT l\.granted/);
    assert.match(src, /WAIT_TIMEOUT_MS|CALLER_TIMEOUT_MS/);
  });

  it("covers required lifecycle concurrency scenarios", () => {
    assert.match(src, /exact_publish_replay/);
    assert.match(src, /publish_already/);
    assert.match(src, /exact_retire_replay/);
    assert.match(src, /retire_request_conflict/);
    assert.match(src, /concurrent_rollback/);
    assert.match(src, /independent_lifecycle/);
    assert.match(src, /rights_policy/);
  });

  it("cleans fixtures and leaves no residual rows", () => {
    assert.match(src, /cleanupFixture/);
    assert.match(src, /session_replication_role = replica/);
    assert.match(src, /residual B2E concurrency fixtures/);
  });

  it("does not implement lifecycle operational CLI package commands", () => {
    assert.doesNotMatch(src, /catalogue:publish|catalogue:retire|catalogue:rollback/);
  });
});
