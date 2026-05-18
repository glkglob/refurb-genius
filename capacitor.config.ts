import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.refurbgenius.app",
  appName: "Refurb Genius",
  webDir: "dist/client",
  ios: {
    scheme: "dark",
  },
  server: {
    // For local development: connect to localhost:3000 running the Nitro server
    // For production: the bundled assets in dist/client serve as the app
    // url: 'http://localhost:3000', // Uncomment for local dev with running backend
  },
};

export default config;
