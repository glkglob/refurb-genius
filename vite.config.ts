import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// Local development config.
// Production (Vercel) builds use vite.vercel.config.ts via `pnpm build:vercel`.
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
  ],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  build: {
    // Local `vite build` is not the production deploy path (use build:vercel).
    // Disable maps so accidental previews never ship original source.
    // `vite dev` still provides full dev source maps independently.
    sourcemap: false,
  },
});
