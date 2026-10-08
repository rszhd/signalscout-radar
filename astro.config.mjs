import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://radar.signalscout.run",
  // Every page reads the database, so every page renders on request.
  output: "server",
  adapter: node({ mode: "standalone" }),
  security: {
    // Done in src/middleware.ts instead, so a mail app's one-click
    // unsubscribe is not refused (US-456).
    checkOrigin: false,
    // Traefik ends HTTPS and forwards plain HTTP. Trusting its
    // X-Forwarded-Proto for our own host makes the request URL https, so a
    // form's origin matches it (BuyerFinder's first deploy, US-434).
    allowedDomains: [{ hostname: "radar.signalscout.run", protocol: "https" }, { hostname: "localhost" }, { hostname: "127.0.0.1" }],
  },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
