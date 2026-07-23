import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Upload client maps to Sentry only when build-time credentials are present.
// Without them we disable map emission entirely so nothing is deployed publicly.
const uploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

// Vercel build config for TanStack Start + Nitro
export default defineConfig({
  build: {
    // "hidden" generates .map files for Sentry without //# sourceMappingURL in
    // public JS (avoids advertising map URLs). When not uploading, emit no maps.
    sourcemap: uploadSourceMaps ? "hidden" : false,
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

    // Private Sentry upload: maps never stay in the public static deploy tree.
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
      },
      disable: !uploadSourceMaps,
      sourcemaps: {
        // Client static assets only — server/function bundles are not public.
        assets: ["./.vercel/output/static/**"],
        ignore: ["**/node_modules/**"],
        filesToDeleteAfterUpload: ["./.vercel/output/static/**/*.map"],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
