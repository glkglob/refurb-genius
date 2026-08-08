/**
 * IA-8-R1 — DropdownMenu / Select / Popover content keep semantic opaque surface classes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function readComponent(name: string): string {
  return readFileSync(join(here, name), "utf8");
}

describe("IA-8-R1 opaque overlay surface classes", () => {
  it.each([
    ["dropdown-menu.tsx", "DropdownMenuContent"],
    ["select.tsx", "SelectContent"],
    ["popover.tsx", "PopoverContent"],
    ["context-menu.tsx", "ContextMenuContent"],
  ] as const)("%s content uses bg-popover + text-popover-foreground", (file) => {
    const src = readComponent(file);
    expect(src).toMatch(/\bbg-popover\b/);
    expect(src).toMatch(/\btext-popover-foreground\b/);
    expect(src).not.toMatch(/\bbg-white\b/);
    expect(src).not.toMatch(/\bbg-transparent\b/);
  });
});
