import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Vercel build config: TanStack Start + Nitro preset.
//
// NOTE: Do NOT add a `define` block for VITE_* environment variables here.
// Vite automatically injects all VITE_* vars from the build environment into
// import.meta.env at build time. Adding a manual `define` block would OVERRIDE
// that injection — and if the env var is not present at build time, Vite would
// inline the literal string "undefined", silently breaking the app at runtime.
//
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (and any other VITE_* vars)
// directly in the Vercel project's Environment Variables settings.
export default defineConfig({
  build: {
    // Required for Sentry to produce good stack traces in production.
    sourcemap: true,
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

    // ... existing plugins (tanstackStart, react, tailwind, etc.)
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
      },
      disable: !process.env.SENTRY_AUTH_TOKEN, // Only run during real builds
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
