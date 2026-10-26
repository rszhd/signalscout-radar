import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { ipSalt } from "@/lib/site.ts";
import { clientIp, hashIp } from "@/lib/subscribers.ts";
import { handleMcp } from "@/mcp/http.ts";

/** Radar's MCP server, for a person's own Claude or ChatGPT. US-462. */
export const ALL: APIRoute = ({ request, clientAddress }) => {
  const ip = clientIp(request.headers.get("x-forwarded-for"), clientAddress);
  return handleMcp(request, { sql: db(), ipHash: hashIp(ip, ipSalt()) });
};
