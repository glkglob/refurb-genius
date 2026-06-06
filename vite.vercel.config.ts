import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Vercel build config for TanStack Start + Nitro
export default defineConfig({
  build: {
    sourcemap: true, // Required for good Sentry stack traces
    chunkSizeWarningLimit: 1200, // Reduce noise on large vendor chunks
  },

  plugins: [
    tanstackStart({
      server: {
        entry: "./src/server.ts",
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    nitro({ preset: "vercel" }),

    // Sentry sourcemaps upload (only runs on Vercel build when auth token present)
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
      },
      disable: !process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        // Target only client-side static chunks — Nitro's server function
        // bundles in .vercel/output/functions/ have no source maps and
        // produce "could not determine source map reference" noise.
        assets: "./.vercel/output/**",
        ignore: ["**/node_modules/**"],
        filesToDeleteAfterUpload: "./.vercel/output/**/*.map",
      },
    }),
  ],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
