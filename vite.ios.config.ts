import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// iOS-only SPA shell build for Capacitor (Option B / IOS-READINESS-2A).
// Isolated from local `vite.config.ts` and Production `vite.vercel.config.ts`.
// Emits a genuine prerendered application shell (index.html) under dist/ios/client.
export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        // Resolved relative to srcDirectory (default "src"), not repo root.
        // "./src/server.ts" would silently fall back to the package default entry.
        entry: "./server.ts",
      },
      // Tests under src/routes must never be candidate production routes.
      router: {
        routeFileIgnorePattern: "\\.(test|spec)\\.(ts|tsx)$",
      },
      // Supported TanStack Start SPA mode — prerenders the root shell only.
      // outputPath "/index" → dist/ios/client/index.html (Capacitor webDir entry).
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index",
        },
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
    // Keep iOS SPA output out of the web SSR/Vercel dist tree.
    outDir: "dist/ios",
    // No public source maps for packaged mobile assets.
    sourcemap: false,
    emptyOutDir: true,
  },
});
