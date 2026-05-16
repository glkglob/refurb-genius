import { nitro } from "nitro/vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel build path: keep Lovable's bundled TanStack/Vite plugins,
// disable the Cloudflare worker adapter, and let Nitro emit Vercel output.
export default defineConfig({
  cloudflare: false,
  plugins: [nitro({ preset: "vercel" })],
  tanstackStart: {
    server: { entry: "server" },
  },
});
