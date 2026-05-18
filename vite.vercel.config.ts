import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

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
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Don't hash entry file so HTML reference /assets/client.js matches the actual file
        entryFileNames: "assets/client.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
