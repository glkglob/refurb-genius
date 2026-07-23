#!/usr/bin/env node
/**
 * Point this repo at .githooks/ for pre-commit secret + env protection.
 * Safe to run repeatedly (idempotent). Skips in CI.
 */
import { execSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

if (process.env.CI === "true" || process.env.VERCEL === "1") {
  process.exit(0);
}

const root = process.cwd();
const hooksPath = ".githooks";
const preCommit = join(root, hooksPath, "pre-commit");

if (!existsSync(preCommit)) {
  console.warn("[install-git-hooks] .githooks/pre-commit missing — skip");
  process.exit(0);
}

try {
  chmodSync(preCommit, 0o755);
  execSync(`git config core.hooksPath ${hooksPath}`, {
    cwd: root,
    stdio: "ignore",
  });
  console.log(`[install-git-hooks] core.hooksPath → ${hooksPath}`);
} catch (err) {
  console.warn(
    "[install-git-hooks] could not configure hooks:",
    err instanceof Error ? err.message : err,
  );
}
