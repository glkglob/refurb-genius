import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveTradeMessageRecipient } from "./resolveTradeMessageRecipient";

const OWNER = "user-owner";
const OTHER = "user-other";
const TP_PROFILE = "tp-profile-1";

describe("resolveTradeMessageRecipient", () => {
  it("requester/owner sends to quote.tradesperson_id (profile id)", () => {
    expect(
      resolveTradeMessageRecipient({
        currentUserId: OWNER,
        quoteUserId: OWNER,
        quoteTradespersonId: TP_PROFILE,
      }),
    ).toBe(TP_PROFILE);
  });

  it("non-requester sends to quote.user_id", () => {
    expect(
      resolveTradeMessageRecipient({
        currentUserId: OTHER,
        quoteUserId: OWNER,
        quoteTradespersonId: TP_PROFILE,
      }),
    ).toBe(OWNER);
  });

  it("preserves exact field values without transformation", () => {
    const result = resolveTradeMessageRecipient({
      currentUserId: "  user-a  ",
      quoteUserId: "user-b",
      quoteTradespersonId: "tp-raw",
    });
    expect(result).toBe("user-b");
  });

  it("does not reject self-recipient when formula produces it", () => {
    // If current user matches quote user and tradesperson id equals user id,
    // current product formula still returns that id.
    expect(
      resolveTradeMessageRecipient({
        currentUserId: OWNER,
        quoteUserId: OWNER,
        quoteTradespersonId: OWNER,
      }),
    ).toBe(OWNER);
  });

  it("module source has no IO or framework dependency", () => {
    const src = readFileSync(
      join(process.cwd(), "src/features/marketplace/presentation/resolveTradeMessageRecipient.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["']react["']/);
    expect(src).not.toMatch(/@tanstack\/react-query/);
    expect(src).not.toMatch(/supabase|@\/platform\/supabase|@\/lib\/auth/);
    expect(src).not.toMatch(/fetch\s*\(|await\s+/);
  });
});
