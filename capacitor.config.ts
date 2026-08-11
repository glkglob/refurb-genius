import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.refurbgenius.app",
  appName: "Refurb Genius",
  // iOS SPA shell output from `pnpm build:ios` (vite.ios.config.ts).
  // Isolated from web SSR/Vercel client output under dist/client.
  webDir: "dist/ios/client",
  ios: {
    scheme: "dark",
  },
  // No server.url: local bundle only. Do not point Capacitor at Production
  // (avoids remote createServerFn shortcut / Option A rejection).
};

export default config;
