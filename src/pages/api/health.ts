import type { APIRoute } from "astro";
import { db } from "@/lib/db";

/** For Docker's health check and Traefik: the process is up and the database answers. */
export const GET: APIRoute = async () => {
  try {
    await db()`select 1`;
    return new Response("ok", { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("database unreachable", { status: 503 });
  }
};
