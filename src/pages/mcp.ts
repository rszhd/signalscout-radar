import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { ipSalt } from "@/lib/site.ts";
import { clientIp, hashIp } from "@/lib/subscribers.ts";
import { mcpEnabled } from "@/lib/visibility";
import { handleMcp } from "@/mcp/http.ts";

/** Radar's MCP server, for a person's own Claude or ChatGPT. US-462. Hidden for now (US-569). */
export const ALL: APIRoute = async ({ request, clientAddress }) => {
  if (!mcpEnabled) return new Response("Not found", { status: 404 });
  const ip = clientIp(request.headers.get("x-forwarded-for"), clientAddress);
  return handleMcp(request, { sql: db(), ipHash: hashIp(ip, ipSalt()) });
};
