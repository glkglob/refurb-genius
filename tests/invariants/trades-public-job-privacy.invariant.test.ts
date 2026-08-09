/**
 * TRADES-PRIVACY-R1B — prevent public Trades reads from using full-row base SELECT.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("TRADES-PRIVACY-R1B public job privacy boundary", () => {
  it("public list path uses safe RPC not select(*) on trades_jobs", () => {
    const store = read("src/features/trades/infrastructure/repositories/tradesJobStore.ts");
    assert.match(store, /list_public_posted_trades_jobs/);
    assert.match(store, /get_public_posted_trades_job/);
    // listPostedTradesJobs must not select from base table
    const listFn = store.slice(
      store.indexOf("export async function listPostedTradesJobs"),
      store.indexOf("export async function getPublicPostedTradesJob"),
    );
    assert.doesNotMatch(listFn, /\.from\(["']trades_jobs["']\)/);
    assert.doesNotMatch(listFn, /\.select\(\s*["']\*["']\s*\)/);
  });

  it("My Interests does not embed trades_jobs relationship for full postcode", () => {
    const interest = read(
      "src/features/trades/infrastructure/repositories/tradesJobInterestStore.ts",
    );
    assert.doesNotMatch(interest, /trades_jobs\s*\(/);
    assert.match(interest, /listPostedTradesJobs/);
  });

  it("public list route does not render full postcode field", () => {
    const page = read("src/routes/trades.tsx");
    assert.match(page, /outwardPostcode/);
    assert.doesNotMatch(page, /job\.postcode/);
  });

  it("public detail uses resolveTradesJobForViewer", () => {
    const page = read("src/routes/trades_.$jobId.tsx");
    assert.match(page, /resolveTradesJobForViewer/);
    assert.match(page, /PublicJobDetailCard/);
    assert.match(page, /OwnerJobDetailCard/);
  });

  it("PublicTradesJob type excludes private fields", () => {
    const types = read("packages/types/src/tradesJob.types.ts");
    const publicBlock = types.slice(types.indexOf("export type PublicTradesJob"));
    assert.doesNotMatch(publicBlock, /propertyAddress/);
    assert.doesNotMatch(publicBlock, /userId/);
    // full postcode property name must not exist on public type
    assert.doesNotMatch(publicBlock, /^\s*postcode\s*:/m);
    assert.match(publicBlock, /outwardPostcode/);
  });

  it("listTradesJobs unrestricted helper is removed from public API", () => {
    const api = read("src/features/trades/index.ts");
    assert.doesNotMatch(api, /listTradesJobs/);
  });
});
