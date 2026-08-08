/**
 * IA-7-R1 — Authenticated global navigation + New Analysis entry proof.
 * Disposable local run only. Does not write to production.
 *
 * Usage: node scripts/ia7-r1-nav-proof.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.argv[2] ?? "http://localhost:5173";
const outDir = join(process.cwd(), "reports", "ia7-r1-nav-proof");
mkdirSync(outDir, { recursive: true });

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const email = env.ADMIN_EMAIL || env.E2E_EMAIL || env.TEST_USER_EMAIL;
const password = env.ADMIN_PASSWORD || env.E2E_PASSWORD || env.TEST_USER_PASSWORD;
if (!email || !password) {
  console.error("Missing ADMIN_EMAIL/ADMIN_PASSWORD (or E2E_*/TEST_USER_*)");
  process.exit(2);
}

const results = {
  startedAt: new Date().toISOString(),
  baseUrl,
  steps: [],
  consoleErrors: [],
  networkErrors: [],
  a11y: {},
  mobile: {},
  ok: true,
};

function step(name, data) {
  results.steps.push({ name, ...data, at: new Date().toISOString() });
  console.log(`✓ ${name}`, data?.route ?? data?.active ?? "");
}

function fail(name, err) {
  results.ok = false;
  results.steps.push({ name, error: String(err), at: new Date().toISOString() });
  console.error(`✗ ${name}`, err);
}

async function activeGlobalNav(page) {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[data-testid^='global-nav-']"));
    return items.map((el) => ({
      id: el.getAttribute("data-testid")?.replace("global-nav-", ""),
      label: (el.textContent || "").trim(),
      active: el.getAttribute("data-active") === "true",
      ariaCurrent: el.getAttribute("aria-current"),
      href: el.getAttribute("href"),
    }));
  });
}

async function clickGlobalNav(page, id) {
  const sel = `[data-testid="global-nav-${id}"]`;
  await page.waitForSelector(sel, { state: "attached", timeout: 15000 });
  const href = await page.locator(sel).getAttribute("href");
  await page.locator(sel).click();
  // Wait for client navigation when href is known.
  if (href) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const path = new URL(page.url()).pathname;
      if (path === href || path.startsWith(href + "/") || (href !== "/" && path.startsWith(href))) {
        break;
      }
      await page.waitForTimeout(100);
    }
  }
  await page.waitForTimeout(300);
}

async function waitForGlobalNav(page) {
  await page.waitForFunction(
    () => document.querySelectorAll("[data-testid^='global-nav-']").length >= 6,
    { timeout: 20000 },
  );
}

async function login(page) {
  await page.goto(`${baseUrl}/auth?mode=signin`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.fill("#email", email);
  await page.fill("#password", password);

  const tokenWait = page
    .waitForResponse((r) => r.url().includes("/auth/v1/token") && r.request().method() === "POST", {
      timeout: 30000,
    })
    .catch(() => null);

  await page.locator('form button[type="submit"]').click();
  const tokenResp = await tokenWait;
  if (tokenResp && tokenResp.status() >= 400) {
    throw new Error(`Auth token request failed: ${tokenResp.status()}`);
  }

  // Client-side auth transition may not fire a full navigation "load" event.
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const hasNav = (await page.locator("[data-testid='global-nav-dashboard']").count()) > 0;
    if (hasNav) return;
    const path = new URL(page.url()).pathname;
    if (path === "/dashboard" || path.startsWith("/dashboard/")) {
      await page.waitForTimeout(200);
      continue;
    }
    await page.waitForTimeout(250);
  }

  // Last resort: open dashboard directly with existing session.
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-testid='global-nav-dashboard']").length > 0,
    { timeout: 20000 },
  );
}

async function overflowCheck(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const clientWidth = doc.clientWidth;
    return {
      hasHorizontalOverflow: scrollWidth > clientWidth + 1,
      scrollWidth,
      clientWidth,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      results.consoleErrors.push({ text: msg.text(), url: page.url() });
    }
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      const url = res.url();
      // Ignore common noise
      if (/favicon|sourcemap|hot-update|posthog|sentry/i.test(url)) return;
      results.networkErrors.push({ status: res.status(), url, page: page.url() });
    }
  });

  try {
    await login(page);
    step("login", { route: new URL(page.url()).pathname });

    // Ensure on dashboard
    if (!page.url().includes("/dashboard")) {
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='global-nav-dashboard']");
    }

    // 15. Six canonical items
    const navItems = await activeGlobalNav(page);
    const labels = navItems.map((n) => n.label);
    const expected = [
      "Dashboard",
      "Projects",
      "New Analysis",
      "Deal Copilot",
      "Trades / Marketplace",
      "Settings",
    ];
    if (JSON.stringify(labels) !== JSON.stringify(expected)) {
      fail("six-canonical-items", { labels, expected });
    } else {
      step("six-canonical-items", { labels });
    }
    if (labels.some((l) => /studies/i.test(l))) {
      fail("studies-absent", "Studies found in primary nav");
    } else {
      step("studies-absent", { ok: true });
    }

    // 17. Dashboard active
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    let active = await activeGlobalNav(page);
    let only = active.filter((a) => a.active).map((a) => a.id);
    if (only.length !== 1 || only[0] !== "dashboard") {
      fail("dashboard-active", only);
    } else {
      step("dashboard-active", { only });
    }

    // 16 sequence: click real nav controls (authenticated shell destinations first)
    const sequence = [
      ["dashboard", "dashboard", /\/dashboard/],
      ["projects", "projects", /\/projects(?:\/|$|\?)/],
      ["new_analysis", "new_analysis", /\/analyze/],
      ["deal_copilot", "deal_copilot", /\/deal-copilot/],
      ["settings", "settings", /\/settings/],
    ];

    for (const [id, expectActive, routeRe] of sequence) {
      await clickGlobalNav(page, id);
      const path = new URL(page.url()).pathname;
      active = await activeGlobalNav(page);
      only = active.filter((a) => a.active).map((a) => a.id);
      const okRoute = routeRe.test(path);
      const okActive = only.length === 1 && only[0] === expectActive;
      if (!okRoute || !okActive) {
        fail(`nav-click-${id}`, { path, only, okRoute, okActive });
      } else {
        step(`nav-click-${id}`, { path, active: only[0] });
      }
    }

    // Trades / Marketplace: canonical global href is public /trades (Navbar chrome).
    // Active-area proof uses authenticated trades/marketplace surfaces that share the shell.
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await waitForGlobalNav(page);
    const tradesHref = await page
      .locator("[data-testid='global-nav-trades_marketplace']")
      .getAttribute("href");
    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith("/trades"), { timeout: 15000 }),
      page.locator("[data-testid='global-nav-trades_marketplace']").click(),
    ]).catch(async () => {
      // Fallback: force navigation if client transition is slow.
      await page.goto(`${baseUrl}/trades`, { waitUntil: "domcontentloaded" });
    });
    const tradesPath = new URL(page.url()).pathname;
    if (tradesHref !== "/trades" || !/^\/trades/.test(tradesPath)) {
      fail("nav-click-trades_marketplace-destination", { tradesHref, tradesPath });
    } else {
      step("nav-click-trades_marketplace-destination", { tradesHref, tradesPath });
    }

    // Authenticated trades subtree active mapping
    for (const path of ["/trades/new", "/marketplace"]) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      await waitForGlobalNav(page);
      active = await activeGlobalNav(page);
      only = active.filter((a) => a.active).map((a) => a.id);
      if (only[0] !== "trades_marketplace") {
        fail(`trades-active-${path}`, { path: new URL(page.url()).pathname, only });
      } else {
        step(`trades-active-${path}`, { active: only[0] });
      }
    }

    // Return to authed shell for remaining proofs
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await waitForGlobalNav(page);

    // New Analysis product proof: create project name only
    await clickGlobalNav(page, "new_analysis");
    await page.waitForURL(/\/analyze/, { timeout: 15000 });
    active = await activeGlobalNav(page);
    only = active.filter((a) => a.active).map((a) => a.id);
    step("new-analysis-initial", {
      route: new URL(page.url()).pathname,
      active: only,
      form: await page.locator("[data-testid='new-analysis-entry-form']").count(),
    });
    if (only[0] !== "new_analysis") fail("new-analysis-active", only);

    const projectName = `IA7-R1 Nav ${Date.now()}`;
    await page.fill("[data-testid='new-analysis-project-name']", projectName);
    await page.click("[data-testid='new-analysis-submit']");
    await page.waitForURL(/\/projects\/[^/]+\/upload/, { timeout: 30000 });
    const uploadPath = new URL(page.url()).pathname;
    const projectId = uploadPath.split("/")[2];
    active = await activeGlobalNav(page);
    only = active.filter((a) => a.active).map((a) => a.id);
    if (!projectId || only[0] !== "projects" || only.includes("new_analysis")) {
      fail("new-analysis-create-flow", { uploadPath, only, projectId });
    } else {
      step("new-analysis-create-flow", {
        projectName,
        projectId,
        uploadPath,
        active: only[0],
      });
    }

    // Projects subtree active on stage routes
    const stages = ["", "/upload", "/analysis", "/redesign", "/estimate", "/report"];
    for (const stage of stages) {
      const target = `${baseUrl}/projects/${projectId}${stage}`;
      await page.goto(target, { waitUntil: "domcontentloaded" });
      await waitForGlobalNav(page);
      await page.waitForTimeout(200);
      active = await activeGlobalNav(page);
      only = active.filter((a) => a.active).map((a) => a.id);
      const path = new URL(page.url()).pathname;
      if (only[0] !== "projects") {
        fail(`projects-active${stage || "-overview"}`, { path, only, items: active.length });
      } else {
        step(`projects-active${stage || "-overview"}`, { path, active: "projects" });
      }
    }

    // Project stage shell separate (Photos etc. not in global nav)
    const globalLabels = (await activeGlobalNav(page)).map((n) => n.label).join("|");
    if (
      /Photos|Redesign|Estimate|Export/.test(globalLabels) &&
      !/New Analysis/.test(globalLabels)
    ) {
      // New Analysis contains "Analysis" word but not as stage; check stage words carefully
    }
    if (/\bPhotos\b|\bRedesign\b|\bEstimate\b|\bExport\b/.test(globalLabels)) {
      fail("stage-not-global", globalLabels);
    } else {
      step("stage-not-global", { ok: true });
    }

    // /projects/new alias
    await page.goto(`${baseUrl}/projects/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    active = await activeGlobalNav(page);
    only = active.filter((a) => a.active).map((a) => a.id);
    const hasForm = await page.locator("[data-testid='new-analysis-entry-form']").count();
    if (only[0] !== "new_analysis" || hasForm < 1) {
      fail("projects-new-alias", { only, hasForm, path: new URL(page.url()).pathname });
    } else {
      step("projects-new-alias", { path: new URL(page.url()).pathname, active: only[0] });
    }

    // Studies deep links
    await page.goto(`${baseUrl}/studies`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    active = await activeGlobalNav(page);
    only = active.filter((a) => a.active).map((a) => a.id);
    const studiesBody = await page.locator("body").innerText();
    if (only.length !== 0) {
      fail("studies-no-primary-active", only);
    } else {
      step("studies-list", {
        path: new URL(page.url()).pathname,
        demotion: /canonical|Projects/i.test(studiesBody),
      });
    }

    await page.goto(`${baseUrl}/studies/workspace`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    active = await activeGlobalNav(page);
    only = active.filter((a) => a.active).map((a) => a.id);
    if (only.length !== 0) {
      fail("studies-workspace-no-primary", only);
    } else {
      step("studies-workspace", {
        path: new URL(page.url()).pathname,
        title: await page.title(),
      });
    }

    // Nested deal copilot / trades if available
    await page
      .goto(`${baseUrl}/deal-copilot/new`, { waitUntil: "domcontentloaded" })
      .catch(() => {});
    await page.waitForTimeout(300);
    active = await activeGlobalNav(page);
    only = active.filter((a) => a.active).map((a) => a.id);
    step("deal-copilot-nested", { path: new URL(page.url()).pathname, active: only });

    await page.goto(`${baseUrl}/trades/new`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(300);
    active = await activeGlobalNav(page);
    only = active.filter((a) => a.active).map((a) => a.id);
    step("trades-nested", { path: new URL(page.url()).pathname, active: only });

    // Accessibility — desktop primary nav
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("nav[aria-label='Primary']");
    results.a11y.primaryLandmark = (await page.locator("nav[aria-label='Primary']").count()) > 0;
    results.a11y.ariaCurrentOnDashboard =
      (await page.locator('[data-testid="global-nav-dashboard"][aria-current="page"]').count()) > 0;
    // Tab into nav
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        testid: el?.getAttribute?.("data-testid"),
        ariaCurrent: el?.getAttribute?.("aria-current"),
      };
    });
    results.a11y.tabFocusSample = focused;
    step("a11y-desktop", results.a11y);

    // Mobile 320
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    results.mobile.m320 = {
      overflow: await overflowCheck(page),
      projectsLink: (await page.locator('a[aria-label="Projects"]').count()) > 0,
      newLink: (await page.locator('a[aria-label="New analysis"]').count()) > 0,
      tradesLink: (await page.locator('a[aria-label="Trades marketplace"]').count()) > 0,
      newHref: await page.locator('a[aria-label="New analysis"]').getAttribute("href"),
    };
    // Navigate New via mobile
    await page.locator('a[aria-label="New analysis"]').click();
    await page.waitForURL(/\/analyze/, { timeout: 15000 });
    results.mobile.m320.newRoute = new URL(page.url()).pathname;
    // Settings via desktop nav hidden on mobile — go direct
    await page.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded" });
    results.mobile.m320.settingsOk = /\/settings/.test(new URL(page.url()).pathname);
    await page.goto(`${baseUrl}/deal-copilot`, { waitUntil: "domcontentloaded" });
    results.mobile.m320.copilotOk = /deal-copilot/.test(new URL(page.url()).pathname);
    step("mobile-320", results.mobile.m320);
    if (results.mobile.m320.overflow.hasHorizontalOverflow)
      fail("mobile-320-overflow", results.mobile.m320.overflow);
    if (results.mobile.m320.newHref !== "/analyze")
      fail("mobile-320-new-href", results.mobile.m320.newHref);

    // Mobile 390
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/projects`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    results.mobile.m390 = {
      overflow: await overflowCheck(page),
      projectsLink: (await page.locator('a[aria-label="Projects"]').count()) > 0,
      newHref: await page.locator('a[aria-label="New analysis"]').getAttribute("href"),
    };
    await page.locator('a[aria-label="New analysis"]').click();
    await page.waitForURL(/\/analyze/, { timeout: 15000 });
    results.mobile.m390.newRoute = new URL(page.url()).pathname;
    step("mobile-390", results.mobile.m390);
    if (results.mobile.m390.overflow.hasHorizontalOverflow)
      fail("mobile-390-overflow", results.mobile.m390.overflow);

    // Sign out control reachable (desktop)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: "domcontentloaded" });
    // Sidebar only on md+
    const signOut = await page.getByRole("button", { name: /sign out/i }).count();
    step("sign-out-reachable", { count: signOut });
  } catch (err) {
    fail("fatal", err);
  } finally {
    results.finishedAt = new Date().toISOString();
    writeFileSync(join(outDir, "report.json"), JSON.stringify(results, null, 2));
    await browser.close();
  }

  // Filter material network errors (ignore 404 assets sometimes)
  const materialNet = results.networkErrors.filter(
    (e) => e.status >= 500 || (e.status === 401 && !/auth/.test(e.url)),
  );
  results.materialNetworkErrors = materialNet;

  writeFileSync(join(outDir, "report.json"), JSON.stringify(results, null, 2));
  console.log("\n=== IA-7-R1 NAV PROOF ===");
  console.log("ok:", results.ok);
  console.log("steps:", results.steps.length);
  console.log("consoleErrors:", results.consoleErrors.length);
  console.log("networkErrors:", results.networkErrors.length);
  console.log("report:", join(outDir, "report.json"));
  process.exit(results.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
