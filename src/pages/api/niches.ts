import type { APIRoute } from "astro";
import { nicheCounts } from "@/db/niches.ts";
import { bearerMatches } from "@/lib/bearer.ts";
import { db } from "@/lib/db";

/**
 * The niche ranking for BuyerFinder's admin page (US-561):
 * `GET /api/niches?days=30` with `Authorization: Bearer <RADAR_NICHES_TOKEN>`.
 *
 * A 404 without the token, and when the token is unset, so the public site
 * does not show the route is there.
 */
export const GET: APIRoute = async ({ request, url }) => {
  if (!bearerMatches(request.headers.get("authorization"), process.env.RADAR_NICHES_TOKEN)) {
    return new Response("Not found", { status: 404 });
  }
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
  const now = new Date();
  return Response.json(
    { days, until: now.toISOString(), niches: await nicheCounts(db(), days, now) },
    { headers: { "Cache-Control": "no-store" } },
  );
};
