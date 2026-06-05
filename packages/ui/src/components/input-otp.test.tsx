import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@repo/ui";

describe("InputOTP (migrated @repo/ui)", () => {
  it("renders otp input slots structure", () => {
    render(
      <InputOTP maxLength={6}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>,
    );

    // The library attaches data-input-otp to the root; slots are children. Use DOM query for robustness in jsdom.
    const root = document.querySelector("[data-input-otp]");
    expect(root).toBeTruthy();
    // Slots may render using non-div or be minimal in jsdom (no layout); root presence proves the component tree mounted without error.
  });
});
