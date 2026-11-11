import type { APIRoute } from "astro";
import { addSubreddit, removeSubreddit } from "@/db/subreddits.ts";
import { bearerMatches } from "@/lib/bearer.ts";
import { db } from "@/lib/db";

/**
 * Adds or removes a subreddit Radar reads, from BuyerFinder's admin page
 * (US-568): `POST /api/subreddits` with `{"action": "add" | "remove", "name"}`
 * and `Authorization: Bearer <RADAR_NICHES_TOKEN>`. The worker reads the list
 * at the start of its next run. Without the token, a 404, as /api/niches.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!bearerMatches(request.headers.get("authorization"), process.env.RADAR_NICHES_TOKEN)) {
    return new Response("Not found", { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { action?: unknown; name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  if (body?.action === "add") {
    const { outcome, name: clean } = await addSubreddit(db(), name);
    return Response.json({ outcome, name: clean }, { status: outcome === "invalid" || outcome === "refused" ? 400 : 200 });
  }
  if (body?.action === "remove") {
    const removed = await removeSubreddit(db(), name);
    return Response.json({ outcome: removed ? "removed" : "missing", name }, { status: removed ? 200 : 404 });
  }
  return Response.json({ error: 'Send {"action": "add" | "remove", "name": "<subreddit>"}.' }, { status: 400 });
};
