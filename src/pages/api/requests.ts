import type { APIRoute } from "astro";
import { requestsPage } from "@/db/queries.ts";
import { db } from "@/lib/db";
import { type Platform, toCard } from "@/lib/present";

const platforms = new Set<Platform>(["reddit", "facebook", "forum"]);

/**
 * The home feed's next posts (owner, 2026-11-05: "load more" by 10).
 * `?platform=facebook&before=<posted_at ISO>&id=<id>&limit=10`.
 */
export const GET: APIRoute = async ({ url }) => {
  const platform = url.searchParams.get("platform") ?? "";
  const beforeAt = url.searchParams.get("before");
  const beforeId = url.searchParams.get("id") ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 10, 1), 30);
  if (platform && !platforms.has(platform as Platform)) return new Response("unknown platform", { status: 400 });
  const at = beforeAt ? new Date(beforeAt) : undefined;
  if (at && (Number.isNaN(at.getTime()) || !/^\d+$/.test(beforeId))) return new Response("bad cursor", { status: 400 });

  const now = new Date();
  const rows = await requestsPage(
    db(),
    { limit, ...(platform ? { platform: platform as Platform } : {}), ...(at ? { before: { postedAt: at, id: beforeId } } : {}) },
    now,
  );
  return Response.json(
    rows.map((row) => toCard(row, now)),
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
};
