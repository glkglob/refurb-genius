/**
 * TRADES-T1 — Availability truth / trust-claim repair.
 *
 * Customer-facing Trades copy must not present unsupported verification,
 * marketplace supply, or appointment-sharing claims as current capability.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

/** Present-tense unsupported trust/supply claims (case-insensitive). */
const BANNED_PRESENT_TENSE = [
  /trusted local trades/i,
  /trusted tradespeople/i,
  /verified local tradespeople/i,
  /verified tradespeople(?!\s+are not)/i,
  /Get contacted by verified/i,
  /Browse verified trades/i,
  /Find verified local/i,
  /vetted,\s*rated,\s*and/i,
  /identity verification and provide proof/i,
  /insurance verified/i,
  /verified ratings once a job/i,
  /provides a neutral dispute support/i,
  /full address shared only after appointment/i,
  /live on the Trades Marketplace/i,
  /we'll connect you with trusted/i,
  /Trades Marketplace — coming soon/i,
  /Browse Marketplace/i,
] as const;

const CUSTOMER_FACING_FILES = [
  "src/routes/trades.tsx",
  "src/routes/trades_.$jobId.tsx",
  "src/routes/_authed/trades_.new.tsx",
  "src/routes/_authed/trades_.profile.tsx",
  "src/routes/_authed/marketplace.tsx",
  "src/routes/_authed/dashboard.tsx",
  "src/routes/_authed/projects.$id.index.tsx",
  "src/features/navigation/globalNav.ts",
  "src/components/PlatformNavButtons.tsx",
  "src/lib/pitchDeck.ts",
] as const;

describe("TRADES-T1 availability truth / trust claims", () => {
  it("customer-facing Trades surfaces omit banned present-tense trust claims", () => {
    const hits: string[] = [];
    for (const file of CUSTOMER_FACING_FILES) {
      const src = read(file);
      for (const re of BANNED_PRESENT_TENSE) {
        if (re.test(src)) {
          hits.push(`${file}: ${re}`);
        }
      }
    }
    assert.deepEqual(hits, [], `Unsupported claims remain:\n${hits.join("\n")}`);
  });

  it("/trades hero presents limited-beta job board, not marketplace-coming-soon", () => {
    const page = read("src/routes/trades.tsx");
    assert.match(page, /job board — limited beta/i);
    assert.doesNotMatch(page, /Trades Marketplace — coming soon/);
    assert.match(page, /still developing/i);
  });

  it("job post success uses job board wording", () => {
    const page = read("src/routes/_authed/trades_.new.tsx");
    assert.match(page, /published to the Trades job board/i);
    assert.doesNotMatch(page, /live on the Trades Marketplace/i);
  });

  it("marketplace empty state distinguishes pre-launch from filter miss", () => {
    const page = read("src/routes/_authed/marketplace.tsx");
    assert.match(page, /Provider directory still being developed/i);
    assert.match(page, /tradespeople\.length === 0/);
    assert.match(page, /Go to Trades job board|Browse Trades job board/i);
  });

  it("dashboard does not own trades jobs, interests, or job-board actions", () => {
    const page = read("src/routes/_authed/dashboard.tsx");
    assert.doesNotMatch(page, /Browse Trades Jobs/);
    assert.doesNotMatch(page, /Browse Marketplace/);
    assert.doesNotMatch(page, /My trades jobs/);
    assert.doesNotMatch(page, /listCurrentUserTradesJobs/);
    assert.doesNotMatch(page, /listCurrentUserInterestsWithJobs/);
    assert.doesNotMatch(page, /updateTradesJob/);
  });

  it("marketplace parent reaches My Jobs, My Interests, Post a Job, and the Trades board", () => {
    const page = read("src/routes/_authed/marketplace.tsx");
    assert.match(page, /My Jobs/);
    assert.match(page, /My Interests/);
    assert.match(page, /to="\/trades\/new"/);
    assert.match(page, /Post a Job/);
    assert.match(page, /to="\/trades"/);
    assert.match(page, /Trades job board/);
    assert.match(page, /listCurrentUserTradesJobs/);
    assert.match(page, /listCurrentUserInterestsWithJobs/);
    assert.match(page, /updateTradesJob/);
    assert.match(page, /to="\/trades\/\$jobId\/edit"/);
    assert.match(page, /status:\s*"closed"/);
    assert.doesNotMatch(page, /@\/core\/trades/);
    assert.doesNotMatch(page, /@\/core\/trades\/tradesJob\.selectors/);
    assert.match(page, /from "@\/features\/trades"/);
  });

  it("trades board offers a signed-in link to Marketplace management home", () => {
    const page = read("src/routes/trades.tsx");
    assert.match(page, /to="\/marketplace"/);
    assert.match(page, /My Jobs and My Interests/);
    assert.doesNotMatch(page, /to="\/dashboard"/);
  });

  it("canonical trades_marketplace nav is Marketplace at /marketplace", () => {
    const nav = read("src/features/navigation/globalNav.ts");
    assert.match(nav, /id:\s*"trades_marketplace"/);
    assert.match(nav, /label:\s*"Marketplace"/);
    assert.match(nav, /to:\s*"\/marketplace"/);
    assert.match(nav, /Marketplace, Trades job board, and related job tools/);
    assert.doesNotMatch(nav, /label:\s*"Trades"/);
    assert.doesNotMatch(nav, /Trades \/ Marketplace/);
    assert.match(
      nav,
      /MOBILE_PRIMARY_NAV_IDS = \[\s*"dashboard",\s*"projects",\s*"new_analysis",\s*"deal_copilot",\s*\] as const/,
    );
    assert.match(
      nav,
      /MOBILE_MORE_NAV_IDS = \[\s*"trades_marketplace",\s*"settings",\s*\] as const/,
    );
  });

  it("Sidebar renders canonical Marketplace label and destination verbatim", () => {
    const sidebar = read("src/components/Sidebar.tsx");
    assert.match(sidebar, /GLOBAL_NAV_ITEMS/);
    assert.match(sidebar, /to=\{item\.to\}/);
    assert.match(sidebar, /\{item\.label\}/);
    assert.doesNotMatch(sidebar, /SIDEBAR_VISIBLE_LABEL/);
    assert.doesNotMatch(sidebar, /item\.id === "trades_marketplace"/);
    const order = [
      "dashboard",
      "projects",
      "new_analysis",
      "deal_copilot",
      "trades_marketplace",
      "settings",
    ];
    const nav = read("src/features/navigation/globalNav.ts");
    let last = -1;
    for (const id of order) {
      const idx = nav.indexOf(`id: "${id}"`);
      assert.ok(idx > last, `Sidebar/global order missing or wrong for ${id}`);
      last = idx;
    }
    const mobileNav = read("src/components/MobileBottomNav.tsx");
    assert.match(mobileNav, /Home \| Projects \| New \| Deal Copilot \| More/);
  });

  it("marketplace My Jobs and My Interests use canonical @repo/core formatters", () => {
    const page = read("src/routes/_authed/marketplace.tsx");
    assert.match(page, /from "@repo\/core"/);
    assert.match(page, /formatBudgetRange/);
    assert.match(page, /formatShortDate/);
    assert.match(page, /formatCategoryLabel/);
    assert.match(page, /formatStatus/);
    assert.match(page, /from "@repo\/types"/);
    assert.match(page, /TradesJobStatus/);
    assert.doesNotMatch(page, /function presentBudget/);
    assert.doesNotMatch(page, /function presentDate/);
    assert.doesNotMatch(page, /function jobStatusLabel/);
    assert.doesNotMatch(page, /@\/core\/trades/);
    assert.doesNotMatch(page, /@\/core\/trades\/tradesJob\.selectors/);
    assert.doesNotMatch(page, /from "@\/lib\/utils"/);
  });

  it("does not alter privacy migration or public RPC wiring", () => {
    const store = read("src/features/trades/infrastructure/repositories/tradesJobStore.ts");
    assert.match(store, /list_public_posted_trades_jobs/);
    assert.match(store, /get_public_posted_trades_job/);
    const migration = read(
      "supabase/migrations/20260809101000_trades_public_job_privacy_boundary.sql",
    );
    assert.match(migration, /SECURITY DEFINER/);
    assert.match(migration, /outward/);
  });
});
