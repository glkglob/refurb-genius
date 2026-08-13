import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMobileCorsHeaders,
  isMobileApiAllowedOrigin,
  mobileCorsPreflightResponse,
  MOBILE_API_ALLOWED_HEADERS,
  MOBILE_API_ALLOWED_METHODS,
} from "./mobile-cors.server";

describe("mobile CORS", () => {
  it("allows capacitor://localhost", () => {
    expect(isMobileApiAllowedOrigin("capacitor://localhost")).toBe(true);
  });

  it("rejects foreign origins", () => {
    expect(isMobileApiAllowedOrigin("https://evil.example")).toBe(false);
    expect(isMobileApiAllowedOrigin("https://www.refurbgenius.info")).toBe(false);
    expect(isMobileApiAllowedOrigin(null)).toBe(false);
  });

  it("preflight for capacitor origin returns allowed methods/headers without credentials", () => {
    const req = new Request("https://www.refurbgenius.info/api/mobile/v1/session/ping", {
      method: "OPTIONS",
      headers: {
        Origin: "capacitor://localhost",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    const res = mobileCorsPreflightResponse(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe(MOBILE_API_ALLOWED_METHODS);
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe(MOBILE_API_ALLOWED_HEADERS);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(MOBILE_API_ALLOWED_HEADERS.toLowerCase()).toContain("authorization");
  });

  it("does not emit permissive CORS for foreign origins", () => {
    const req = new Request("https://www.refurbgenius.info/api/mobile/v1/session/ping", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });
    const headers = buildMobileCorsHeaders(req);
    expect(headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("never combines wildcard origin with credentials", () => {
    const src = readFileSync(join(__dirname, "mobile-cors.server.ts"), "utf8");
    expect(src).not.toMatch(/Access-Control-Allow-Origin["']?\s*:\s*["']\*/);
    expect(src).not.toMatch(/Allow-Credentials["']?\s*:\s*["']?true/i);
  });
});

describe("CSRF non-regression (mobile CORS isolation)", () => {
  it("start.ts still has no Capacitor CSRF exemption", () => {
    const start = readFileSync(join(__dirname, "../../start.ts"), "utf8");
    expect(start).not.toMatch(/capacitor/i);
    expect(start).toMatch(/createCsrfMiddleware/);
    expect(start).toMatch(/handlerType === "serverFn"/);
  });
});
