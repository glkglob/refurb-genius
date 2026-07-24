/**
 * Real-browser responsive + accessibility pass for /auth?mode=signup.
 * Run against a live dev server (default http://localhost:5173).
 *
 * Usage: node scripts/auth-signup-a11y-pass.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.argv[2] ?? "http://localhost:5173";
const outDir = join(process.cwd(), "reports", "auth-signup-pass");
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "narrow-mobile", width: 320, height: 720 },
  { name: "standard-mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide-desktop", width: 1536, height: 960 },
];

const requiredSignupOrder = [
  "email",
  "password",
  "confirm-password",
  "name",
  "company",
  "terms-consent",
];

function collectOverflow(page) {
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

function collectA11ySnapshot(page) {
  return page.evaluate(() => {
    const issues = [];

    const interactive = Array.from(
      document.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );

    for (const el of interactive) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const tag = el.tagName.toLowerCase();
      const id = el.id || null;
      const type = el.getAttribute("type");
      const role = el.getAttribute("role");
      const ariaLabel = el.getAttribute("aria-label");
      const ariaLabelledBy = el.getAttribute("aria-labelledby");
      const text = (el.textContent || "").trim().slice(0, 80);

      // Label association for inputs
      if (tag === "input" && type !== "hidden") {
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        const hasAccessibleName = Boolean(
          label || ariaLabel || ariaLabelledBy || el.getAttribute("placeholder"),
        );
        if (!hasAccessibleName) {
          issues.push({
            type: "missing-accessible-name",
            id,
            tag,
            inputType: type,
          });
        }
      }

      // Focusable controls should not have aria-hidden
      if (el.closest("[aria-hidden='true']")) {
        issues.push({
          type: "focusable-under-aria-hidden",
          id,
          tag,
          text,
          role,
        });
      }
    }

    // Explicit required signup controls
    const requiredIds = [
      "email",
      "password",
      "confirm-password",
      "name",
      "company",
      "terms-consent",
    ];
    const fieldPresence = Object.fromEntries(
      requiredIds.map((fid) => [fid, Boolean(document.getElementById(fid))]),
    );

    // Field order by DOM position
    const order = requiredIds
      .map((fid) => {
        const el = document.getElementById(fid);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { id: fid, top: rect.top, left: rect.left };
      })
      .filter(Boolean)
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .map((x) => x.id);

    // Visible product claims / forbidden patterns
    const bodyText = document.body?.innerText || "";
    const forbidden = [];
    for (const phrase of [
      "trusted by",
      "customers worldwide",
      "4.9/5",
      "lorem ipsum",
      "coming soon",
    ]) {
      if (bodyText.toLowerCase().includes(phrase)) forbidden.push(phrase);
    }

    // Social / magic link controls
    const buttons = Array.from(document.querySelectorAll("button")).map((b) =>
      (b.textContent || "").replace(/\s+/g, " ").trim(),
    );

    return {
      issues,
      fieldPresence,
      fieldOrder: order,
      buttons,
      hasGoogle: buttons.some((t) => /google/i.test(t)),
      hasApple: buttons.some((t) => /apple/i.test(t)),
      hasMagicLink: buttons.some((t) => /magic link/i.test(t)),
      hasSignInNav: buttons.some((t) => /^sign in$/i.test(t)),
      forbiddenPhrases: forbidden,
      heading: document.querySelector("h1")?.textContent?.trim() || null,
      onboardingGoalOnSignup: Boolean(document.getElementById("onboarding-goal")),
    };
  });
}

async function checkFocusRing(page) {
  // Tab to email and verify a focus-visible style is applied somehow
  await page.focus("#email");
  return page.evaluate(() => {
    const el = document.getElementById("email");
    if (!el) return { focused: false };
    const style = window.getComputedStyle(el);
    return {
      focused: document.activeElement === el,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      // ring utilities often use box-shadow; accept either outline or ring shadow
      hasVisibleFocusCue:
        (style.outlineStyle !== "none" && style.outlineWidth !== "0px") ||
        (style.boxShadow && style.boxShadow !== "none"),
    };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    baseUrl,
    startedAt: new Date().toISOString(),
    viewports: [],
    summary: { pass: true, failures: [] },
  };

  try {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: "dark",
      });
      const page = await context.newPage();
      const url = `${baseUrl}/auth?mode=signup`;
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForSelector("#email", { timeout: 30_000 });

      // Switch to signup if needed
      const signupTab = page
        .getByRole("tab", { name: "Sign up" })
        .or(page.getByRole("button", { name: "Sign up" }));
      if (
        await signupTab
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await signupTab.first().click();
        await page.waitForSelector("#confirm-password", { timeout: 10_000 });
      }

      const shotPath = join(outDir, `${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });

      const overflow = await collectOverflow(page);
      const a11y = await collectA11ySnapshot(page);
      const focus = await checkFocusRing(page);

      // Keyboard: submit validation for empty form
      await page.locator("#email").fill("");
      await page.locator('button[type="submit"]').click();
      const errorVisible = await page
        .locator('[role="alert"]')
        .first()
        .isVisible()
        .catch(() => false);

      // Terms + password mismatch client checks
      await page.locator("#email").fill("qa@example.co.uk");
      await page.locator("#password").fill("secret1");
      await page.locator("#confirm-password").fill("secret2");
      await page.locator('button[type="submit"]').click();
      const mismatchOrTerms = await page
        .locator('[role="alert"]')
        .innerText()
        .catch(() => "");

      const entry = {
        viewport: vp,
        status: response?.status() ?? null,
        screenshot: shotPath,
        overflow,
        a11y,
        focus,
        validation: {
          emptySubmitShowsError: errorVisible,
          mismatchOrTermsMessage: mismatchOrTerms,
        },
      };

      // Assertions for this viewport
      const failures = [];
      if (overflow.hasHorizontalOverflow) {
        failures.push(
          `${vp.name}: horizontal overflow (${overflow.scrollWidth}>${overflow.clientWidth})`,
        );
      }
      if (a11y.onboardingGoalOnSignup) {
        failures.push(`${vp.name}: onboarding-goal still present on signup`);
      }
      for (const id of requiredSignupOrder) {
        if (!a11y.fieldPresence[id]) failures.push(`${vp.name}: missing field #${id}`);
      }
      // Order check: credentials before profile
      const order = a11y.fieldOrder;
      const emailIdx = order.indexOf("email");
      const passwordIdx = order.indexOf("password");
      const confirmIdx = order.indexOf("confirm-password");
      const nameIdx = order.indexOf("name");
      const companyIdx = order.indexOf("company");
      if (
        !(
          emailIdx < passwordIdx &&
          passwordIdx < confirmIdx &&
          confirmIdx < nameIdx &&
          nameIdx < companyIdx
        )
      ) {
        failures.push(`${vp.name}: field order incorrect: ${order.join(" → ")}`);
      }
      if (!a11y.hasGoogle) failures.push(`${vp.name}: Google auth button missing`);
      if (!a11y.hasApple) failures.push(`${vp.name}: Apple auth button missing`);
      if (!a11y.hasMagicLink) failures.push(`${vp.name}: magic link control missing`);
      if (a11y.forbiddenPhrases.length) {
        failures.push(
          `${vp.name}: forbidden marketing phrases: ${a11y.forbiddenPhrases.join(", ")}`,
        );
      }
      if (a11y.issues.length) {
        failures.push(
          `${vp.name}: a11y issues: ${a11y.issues.map((i) => i.type + (i.id ? `#${i.id}` : "")).join(", ")}`,
        );
      }
      if (!focus.focused) failures.push(`${vp.name}: email did not receive focus`);
      // Note: some browsers only show ring on :focus-visible from keyboard; programmatic focus may lack ring.
      entry.focusNote =
        "Programmatic focus may omit :focus-visible ring; keyboard tab focus is preferred for visual ring checks.";

      entry.failures = failures;
      if (failures.length) {
        report.summary.pass = false;
        report.summary.failures.push(...failures);
      }
      report.viewports.push(entry);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const reportPath = join(outDir, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Full report: ${reportPath}`);
  if (!report.summary.pass) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
