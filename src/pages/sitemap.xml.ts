import type { APIRoute } from "astro";
import { categoryCounts } from "@/db/queries.ts";
import { db } from "@/lib/db";

/** The home page, the about page, and every category with a request this week. */
export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString().replace(/\/$/, "") ?? "https://radar.signalscout.run";
  const counts = await categoryCounts(db());
  const paths = ["/", "/about", ...counts.filter((c) => c.week > 0).map((c) => `/c/${c.category}`)];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${base}${path}</loc><changefreq>hourly</changefreq></url>`),
    "</urlset>",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
};
