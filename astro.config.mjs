import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://radar.signalscout.run",
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
