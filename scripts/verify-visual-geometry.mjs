#!/usr/bin/env node
/**
 * RG-20260829-DOM-GEOMETRY-SCRIPT-1 — Playwright DOM geometry measurement.
 *
 * Standalone ESM harness that measures Dashboard and Projects at the Visual
 * Target Lock boards and asserts geometric invariants before human review.
 *
 * Does not mutate application CSS or components. Intended to run against a
 * live dev server after the visual CSS slice is authorised.
 *
 * Usage:
 *   node scripts/verify-visual-geometry.mjs [baseUrl]
 *   node scripts/verify-visual-geometry.mjs --base-url http://localhost:5173
 *   node scripts/verify-visual-geometry.mjs --storage-state ./auth-state.json
 *
 * Auth (first match wins):
 *   PLAYWRIGHT_STORAGE_STATE / --storage-state  (session bypass)
 *   ADMIN_EMAIL + ADMIN_PASSWORD
 *   E2E_EMAIL + E2E_PASSWORD
 *   TEST_USER_EMAIL + TEST_USER_PASSWORD
 *
 * Optional:
 *   --theme light|dark|both   filter locked boards (default: both)
 *   --json-only               print JSON report only
 *
 * Exit codes:
 *   0 PASS
 *   1 FAIL (one or more geometry assertions)
 *   2 harness / auth / configuration error
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SLICE = "RG-20260829-DOM-GEOMETRY-SCRIPT-1";
const THEME_STORAGE_KEY = "refurbgenius-theme";
const HORIZONTAL_TOLERANCE_PX = 1;
const DISPLAY_HEADING_MIN_FONT_PX = 18;
const XL_MIN_PX = 1280;

/** Visual Target Lock boards (viewport × theme pairings). */
const LOCKED_BOARDS = [
  { name: "desktop-1440x900-light", width: 1440, height: 900, theme: "light" },
  { name: "desktop-1440x900-dark", width: 1440, height: 900, theme: "dark" },
  { name: "mobile-390x844-light", width: 390, height: 844, theme: "light" },
  { name: "mobile-430x932-dark", width: 430, height: 932, theme: "dark" },
];

const ROUTES = [
  {
    name: "dashboard",
    path: "/dashboard",
    readySelector: "[data-testid='dashboard-home']",
  },
  {
    name: "projects",
    path: "/projects",
    readySelector: "[data-testid='projects-index-search'], [data-testid='projects-index-grid']",
  },
];

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    const full = join(ROOT, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split("\n")) {
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

function parseArgs(argv) {
  const args = {
    baseUrl: null,
    theme: "both",
    storageState: null,
    jsonOnly: false,
    help: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--json-only") args.jsonOnly = true;
    else if (a === "--base-url" || a === "--baseUrl") args.baseUrl = argv[++i];
    else if (a.startsWith("--base-url=")) args.baseUrl = a.slice("--base-url=".length);
    else if (a === "--theme") args.theme = argv[++i];
    else if (a.startsWith("--theme=")) args.theme = a.slice("--theme=".length);
    else if (a === "--storage-state") args.storageState = argv[++i];
    else if (a.startsWith("--storage-state=")) {
      args.storageState = a.slice("--storage-state=".length);
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    } else {
      rest.push(a);
    }
  }
  if (rest[0]) args.baseUrl = args.baseUrl ?? rest[0];
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/verify-visual-geometry.mjs [baseUrl] [options]

Measures Dashboard and Projects DOM geometry at Visual Target Lock boards:
  1440×900 light, 1440×900 dark, 390×844 light, 430×932 dark

Options:
  --base-url URL             Dev server origin (default http://localhost:5173)
  --theme light|dark|both    Filter locked boards (default both)
  --storage-state PATH       Playwright storageState JSON (auth bypass)
  --json-only                Print JSON report only
  -h, --help                 Show this help
`);
}

function credentialsFromEnv(env) {
  const email = env.ADMIN_EMAIL || env.E2E_EMAIL || env.TEST_USER_EMAIL;
  const password = env.ADMIN_PASSWORD || env.E2E_PASSWORD || env.TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

function selectBoards(themeFilter) {
  const filter = String(themeFilter || "both").toLowerCase();
  if (filter === "both") return LOCKED_BOARDS;
  if (filter === "light" || filter === "dark") {
    return LOCKED_BOARDS.filter((b) => b.theme === filter);
  }
  throw new Error(`Invalid --theme ${themeFilter}. Use light, dark, or both.`);
}

/**
 * In-page geometry collector. Must stay serialisable (no Node closures).
 * @param {{ tolerancePx: number, displayMinFontPx: number, xlMinPx: number }} opts
 */
function collectGeometry(opts) {
  const tolerancePx = opts.tolerancePx;
  const displayMinFontPx = opts.displayMinFontPx;
  const xlMinPx = opts.xlMinPx;

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    if (el.closest("[hidden], [aria-hidden='true']")) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return {
      x: round(r.x),
      y: round(r.y),
      width: round(r.width),
      height: round(r.height),
      left: round(r.left),
      right: round(r.right),
      top: round(r.top),
      bottom: round(r.bottom),
    };
  }

  function round(n) {
    return Math.round(n * 10) / 10;
  }

  function headingSnippet(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function isDisplayHeading(el) {
    const tag = el.tagName;
    if (!isVisible(el)) return false;
    if (tag === "H1") return true;
    if (tag === "H2") {
      const size = parseFloat(window.getComputedStyle(el).fontSize);
      return Number.isFinite(size) && size >= displayMinFontPx;
    }
    return false;
  }

  function serifCheck(el) {
    const style = window.getComputedStyle(el);
    const family = style.fontFamily || "";
    const inline = el.style?.fontFamily || "";
    const className = typeof el.className === "string" ? el.className : "";
    const rootSerif = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue("--font-serif")
      .trim();
    const ownSerif = style.getPropertyValue("--font-serif").trim();
    const serifVar = ownSerif || rootSerif;
    const familyHasCormorant = /cormorant\s*garamond/i.test(family);
    const varHasCormorant = /cormorant\s*garamond/i.test(serifVar);
    const mapsViaVar =
      /var\(\s*--font-serif\s*\)/i.test(inline) ||
      /\bfont-serif\b/.test(className) ||
      (serifVar.length > 0 &&
        family.replace(/\s+/g, " ").trim() === serifVar.replace(/\s+/g, " ").trim());
    const pass = familyHasCormorant || (Boolean(mapsViaVar) && varHasCormorant);
    return {
      pass,
      fontFamily: family,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontSerifVariable: serifVar || null,
      mapsViaFontSerif: Boolean(mapsViaVar),
      reason: pass
        ? familyHasCormorant
          ? "computed-font-family-contains-cormorant-garamond"
          : "css-variable-font-serif-maps-to-cormorant-garamond"
        : "display-heading-not-locked-serif",
    };
  }

  const innerWidth = window.innerWidth;
  const innerHeight = window.innerHeight;
  const bodyScrollWidth = document.body?.scrollWidth ?? 0;
  const docScrollWidth = document.documentElement.scrollWidth;
  const docClientWidth = document.documentElement.clientWidth;
  const containmentPass = bodyScrollWidth <= innerWidth + tolerancePx;

  const headings = Array.from(document.querySelectorAll("h1, h2"))
    .filter(isDisplayHeading)
    .map((el) => {
      const check = serifCheck(el);
      return {
        tag: el.tagName.toLowerCase(),
        text: headingSnippet(el),
        testId: el.getAttribute("data-testid"),
        ...check,
      };
    });

  const typographyPass = headings.length > 0 && headings.every((h) => h.pass);

  const rail = document.querySelector("[data-testid='deal-copilot-rail']");
  const railStyle = rail ? window.getComputedStyle(rail) : null;
  const railVisible = Boolean(rail) && isVisible(rail);
  const railRect = railVisible ? rectOf(rail) : null;
  const isDesktop = innerWidth >= xlMinPx;
  let railClipped = false;
  let railClipPx = 0;
  if (railVisible && railRect) {
    railClipPx = round(Math.max(0, railRect.right - (innerWidth + tolerancePx)));
    railClipped = railClipPx > 0;
  }
  // Rail clip invariant applies only when the rail is present on desktop.
  const railAsserted = isDesktop && railVisible;
  const railPass = !railAsserted || !railClipped;

  const grid = document.querySelector("[data-testid='projects-index-grid']");
  const cards = Array.from(document.querySelectorAll("[data-testid='project-continuation-card']"));
  const parent = grid && isVisible(grid) ? grid : null;
  const parentRect = parent ? rectOf(parent) : null;
  const cardMeasurements = cards.filter(isVisible).map((card) => {
    const container =
      card.closest("[data-testid='projects-index-grid']") || parent || card.parentElement;
    const containerRect = container ? rectOf(container) : null;
    const cardRect = rectOf(card);
    let overflowLeft = 0;
    let overflowRight = 0;
    if (containerRect) {
      overflowLeft = round(Math.max(0, containerRect.left - tolerancePx - cardRect.left));
      overflowRight = round(Math.max(0, cardRect.right - (containerRect.right + tolerancePx)));
    }
    const overflows = overflowLeft > 0 || overflowRight > 0;
    return {
      testId: card.getAttribute("data-testid"),
      projectId: card.getAttribute("data-project-id"),
      layout: card.getAttribute("data-layout"),
      cardRect,
      parentRect: containerRect,
      overflowLeftPx: overflowLeft,
      overflowRightPx: overflowRight,
      overflows,
    };
  });
  const cardsPresent = cardMeasurements.length > 0;
  const cardsPass = !cardsPresent || cardMeasurements.every((c) => !c.overflows);

  return {
    viewport: { innerWidth, innerHeight, isDesktop },
    computedTheme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    typography: {
      pass: typographyPass,
      headingCount: headings.length,
      headings,
    },
    containment: {
      pass: containmentPass,
      bodyScrollWidth,
      documentScrollWidth: docScrollWidth,
      documentClientWidth: docClientWidth,
      innerWidth,
      tolerancePx,
      overflowPx: round(Math.max(0, bodyScrollWidth - innerWidth)),
    },
    rail: {
      present: railVisible,
      asserted: railAsserted,
      pass: railPass,
      display: railStyle?.display ?? null,
      rect: railRect,
      innerWidth,
      clipped: railClipped,
      clipPx: railClipPx,
    },
    cards: {
      present: cardsPresent,
      pass: cardsPass,
      parentPresent: Boolean(parent),
      parentRect,
      count: cardMeasurements.length,
      items: cardMeasurements,
    },
  };
}

async function login(page, baseUrl, creds) {
  await page.goto(`${baseUrl}/auth?mode=signin`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForSelector("#email", { timeout: 20_000 });
  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);

  const tokenWait = page
    .waitForResponse((r) => r.url().includes("/auth/v1/token") && r.request().method() === "POST", {
      timeout: 30_000,
    })
    .catch(() => null);

  await page.locator('form button[type="submit"]').click();
  const tokenResp = await tokenWait;
  if (tokenResp && tokenResp.status() >= 400) {
    throw new Error(`Auth token request failed: ${tokenResp.status()}`);
  }

  const deadline = Date.now() + 30_000;
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

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='global-nav-dashboard']", { timeout: 20_000 });
}

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

async function waitForRouteReady(page, route) {
  await page.waitForSelector(route.readySelector, { timeout: 30_000 });
  await page
    .waitForFunction(
      () => {
        const text = document.body?.innerText || "";
        return !/Loading (?:your )?projects|Loading workflow/i.test(text);
      },
      { timeout: 20_000 },
    )
    .catch(() => {});
  await settle(page);
}

function evaluateCase(routeName, board, geo) {
  const failures = [];

  if (geo.typography.headingCount === 0) {
    failures.push(`${board.name} ${routeName}: no visible H1/H2 display headings`);
  }
  for (const heading of geo.typography.headings) {
    if (!heading.pass) {
      failures.push(
        `${board.name} ${routeName}: ${heading.tag} "${heading.text}" font-family is ` +
          `${JSON.stringify(heading.fontFamily)} (expected Cormorant Garamond or var(--font-serif))`,
      );
    }
  }

  if (!geo.containment.pass) {
    failures.push(
      `${board.name} ${routeName}: horizontal overflow ` +
        `(body.scrollWidth=${geo.containment.bodyScrollWidth} > ` +
        `innerWidth=${geo.containment.innerWidth} + ${HORIZONTAL_TOLERANCE_PX}px)`,
    );
  }

  if (geo.rail.asserted && geo.rail.clipped) {
    failures.push(
      `${board.name} ${routeName}: Deal Copilot rail clipped by viewport right edge ` +
        `(right=${geo.rail.rect?.right} innerWidth=${geo.rail.innerWidth} clipPx=${geo.rail.clipPx})`,
    );
  }

  if (geo.cards.present) {
    for (const card of geo.cards.items) {
      if (!card.overflows) continue;
      failures.push(
        `${board.name} ${routeName}: project card overflows parent grid ` +
          `(projectId=${card.projectId ?? "unknown"} ` +
          `overflowLeftPx=${card.overflowLeftPx} overflowRightPx=${card.overflowRightPx})`,
      );
    }
  }

  return failures;
}

function printHumanReport(report) {
  console.log(`\n=== ${SLICE} — Visual Geometry ===`);
  console.log(`baseUrl:  ${report.baseUrl}`);
  console.log(`started:  ${report.startedAt}`);
  console.log(`boards:   ${report.boards.map((b) => b.name).join(", ")}`);
  console.log(`routes:   ${report.routes.join(", ")}`);
  console.log("");

  for (const entry of report.results) {
    const mark = entry.pass ? "PASS" : "FAIL";
    console.log(`-- ${entry.board}  ${entry.route}  [${mark}]`);
    if (!entry.measurements) {
      for (const f of entry.failures) console.log(`   ✗ ${f}`);
      console.log("");
      continue;
    }
    const t = entry.measurements.typography;
    const headingSummary = t.headings
      .map((h) => `${h.tag}:"${h.text}" ${h.pass ? "ok" : "FAIL"} [${h.fontFamily}]`)
      .join("; ");
    console.log(
      `   typography:  ${t.pass ? "PASS" : "FAIL"} (${t.headingCount} display heading` +
        `${t.headingCount === 1 ? "" : "s"})${headingSummary ? ` — ${headingSummary}` : ""}`,
    );
    const c = entry.measurements.containment;
    console.log(
      `   containment: ${c.pass ? "PASS" : "FAIL"} body.scrollWidth=${c.bodyScrollWidth} ` +
        `innerWidth=${c.innerWidth} overflowPx=${c.overflowPx}`,
    );
    const r = entry.measurements.rail;
    const railState = r.present ? (r.clipped ? "CLIPPED" : "in-view") : "not present";
    console.log(
      `   rail:        ${r.pass ? "PASS" : "FAIL"} ${railState}` +
        `${r.rect ? ` right=${r.rect.right}/${r.innerWidth}` : ""}` +
        `${r.asserted ? "" : " (not asserted)"}`,
    );
    const cards = entry.measurements.cards;
    if (!cards.present) {
      console.log("   cards:       SKIP (no project cards in DOM)");
    } else {
      const overflowCount = cards.items.filter((i) => i.overflows).length;
      console.log(
        `   cards:       ${cards.pass ? "PASS" : "FAIL"} ${cards.count} card` +
          `${cards.count === 1 ? "" : "s"}, ${overflowCount} overflowing`,
      );
    }
    if (entry.failures.length) {
      for (const f of entry.failures) console.log(`   ✗ ${f}`);
    }
    console.log("");
  }

  console.log(`VERDICT: ${report.summary.pass ? "PASS" : "FAIL"}`);
  console.log(`failures: ${report.summary.failures.length}`);
  if (report.summary.failures.length) {
    for (const f of report.summary.failures) console.log(`  - ${f}`);
  }
  console.log(`report: ${report.reportPath}`);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 2;
    return;
  }
  if (args.help) {
    printHelp();
    return;
  }

  const env = loadEnv();
  const baseUrl = (args.baseUrl || env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  const boards = selectBoards(args.theme || env.THEME || "both");
  const storageStatePath =
    args.storageState || env.PLAYWRIGHT_STORAGE_STATE || env.STORAGE_STATE || null;
  const creds = credentialsFromEnv(env);

  if (!storageStatePath && !creds) {
    console.error(
      "Missing auth. Set PLAYWRIGHT_STORAGE_STATE or ADMIN_EMAIL/ADMIN_PASSWORD " +
        "(or E2E_* / TEST_USER_*).",
    );
    process.exitCode = 2;
    return;
  }
  if (storageStatePath && !existsSync(storageStatePath)) {
    console.error(`storageState not found: ${storageStatePath}`);
    process.exitCode = 2;
    return;
  }

  const outDir = join(ROOT, "reports", "verify-visual-geometry");
  mkdirSync(outDir, { recursive: true });
  const reportPath = join(outDir, "report.json");

  const report = {
    slice: SLICE,
    startedAt: new Date().toISOString(),
    baseUrl,
    boards,
    routes: ROUTES.map((r) => r.path),
    results: [],
    summary: { pass: true, failures: [] },
    reportPath,
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error(
      "Failed to launch Chromium. Install the browser with:\n" +
        "  pnpm exec playwright install chromium\n" +
        String(err instanceof Error ? err.message : err),
    );
    process.exitCode = 2;
    return;
  }

  try {
    let storageState = storageStatePath ?? undefined;
    if (!storageState) {
      const bootstrap = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: "light",
        deviceScaleFactor: 1,
      });
      const page = await bootstrap.newPage();
      await login(page, baseUrl, creds);
      storageState = await bootstrap.storageState();
      await bootstrap.close();
    }

    for (const board of boards) {
      const context = await browser.newContext({
        viewport: { width: board.width, height: board.height },
        colorScheme: board.theme,
        deviceScaleFactor: 1,
        storageState,
      });
      await context.addInitScript(
        ({ key, theme }) => {
          try {
            localStorage.setItem(key, theme);
          } catch {
            // Ignore quota / private-mode failures; colorScheme still applies.
          }
        },
        { key: THEME_STORAGE_KEY, theme: board.theme },
      );
      const page = await context.newPage();

      for (const route of ROUTES) {
        const entry = {
          board: board.name,
          route: route.path,
          theme: board.theme,
          viewport: { width: board.width, height: board.height },
          measurements: null,
          failures: [],
          pass: true,
        };
        try {
          await page.goto(`${baseUrl}${route.path}`, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
          });
          const path = new URL(page.url()).pathname;
          if (path.startsWith("/auth")) {
            throw new Error(`Redirected to ${path} — session is not authenticated`);
          }
          await waitForRouteReady(page, route);
          const geo = await page.evaluate(collectGeometry, {
            tolerancePx: HORIZONTAL_TOLERANCE_PX,
            displayMinFontPx: DISPLAY_HEADING_MIN_FONT_PX,
            xlMinPx: XL_MIN_PX,
          });
          entry.measurements = geo;
          entry.failures = evaluateCase(route.path, board, geo);
        } catch (err) {
          entry.failures = [
            `${board.name} ${route.path}: ${err instanceof Error ? err.message : String(err)}`,
          ];
        }
        entry.pass = entry.failures.length === 0;
        if (!entry.pass) {
          report.summary.pass = false;
          report.summary.failures.push(...entry.failures);
        }
        report.results.push(entry);
      }

      await context.close();
    }
  } catch (err) {
    report.summary.pass = false;
    report.summary.failures.push(String(err instanceof Error ? err.message : err));
    report.harnessError = true;
  } finally {
    if (browser) await browser.close();
    report.finishedAt = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  if (!args.jsonOnly) printHumanReport(report);
  console.log(JSON.stringify(args.jsonOnly ? report : report.summary, null, 2));

  if (report.harnessError) process.exitCode = 2;
  else process.exitCode = report.summary.pass ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 2;
});
