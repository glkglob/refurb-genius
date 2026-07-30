import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "packages/ui/src/**/*.{test,spec}.{ts,tsx}",
      // Progressive estimate services (Vitest). Other packages/services tests may use node:test.
      "packages/services/src/uk-region/**/*.{test,spec}.{ts,tsx}",
      "packages/services/src/pricing/pricingEngine.test.ts",
    ],
    exclude: ["tests/invariants/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
    },
  },
});
