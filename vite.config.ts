import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

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
  define: {
    // Expose NEXT_PUBLIC_* env vars to client-side code (Vite only exposes VITE_* by default)
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Manual chunk splitting: keep large PDF libraries and vendors in separate bundles
        // so they lazy-load only when needed (e.g., when user clicks "Export PDF").
        // This reduces main bundle size and improves initial startup performance.
        manualChunks(id: string) {
          // PDF export dependencies — loaded only on-demand via dynamic import
          if (id.includes("node_modules/jspdf")) {
            return "pdf-jspdf";
          }
          if (id.includes("node_modules/html2canvas")) {
            return "pdf-html2canvas";
          }

          // Select.js (large UI library) — split to avoid bloating main bundle
          if (id.includes("node_modules/select")) {
            return "vendor-select";
          }

          // React and ReactDOM core — high reuse, deserves dedicated chunk
          if (id.includes("node_modules/react") && !id.includes("react-dom")) {
            return "react-core";
          }
          if (id.includes("node_modules/react-dom")) {
            return "react-dom";
          }

          // TanStack router and query — commonly accessed, warrant separate chunks
          if (id.includes("node_modules/@tanstack/react-router")) {
            return "tanstack-router";
          }
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "tanstack-query";
          }

          // Other node_modules bundled into generic vendor chunk
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
