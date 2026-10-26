/**
 * /mcp over streamable HTTP, stateless: each POST gets its own server and
 * transport, and the answer is plain JSON rather than a stream, because no
 * tool here sends progress or runs long. US-462.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Sql } from "../db/client.ts";
import { createRadarServer } from "./server.ts";

/** Tool calls one IP may make in a UTC day: about 20 to 40 questions to an AI. */
export const callsPerDay = 200;

/** A JSON-RPC body this size is far past any call these tools take. */
const maxBodyBytes = 64 * 1024;

type Refusal = { status: number; message: string };

/**
 * The one check in front of every tool. Access is free and needs no sign-in
 * (owner, 2026-10-26), so today it only counts calls; a premium plan adds
 * its sign-in here, without changing a tool.
 */
export async function access(sql: Sql, ipHash: string, toolCalls: number, now: Date): Promise<Refusal | null> {
  if (toolCalls === 0) return null;
  const [row] = await sql<{ calls: number }[]>`
    insert into mcp_calls (ip_hash, day, calls) values (${ipHash}, ${now.toISOString().slice(0, 10)}, ${toolCalls})
    on conflict (ip_hash, day) do update set calls = mcp_calls.calls + excluded.calls
    returning calls`;
  if ((row?.calls ?? 0) > callsPerDay) {
    return { status: 429, message: `Radar allows ${callsPerDay} tool calls a day from one address. Try again tomorrow (UTC).` };
  }
  return null;
}

function rpcError(status: number, message: string, id: unknown = null): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function handleMcp(request: Request, { sql, ipHash, now = new Date() }: { sql: Sql; ipHash: string; now?: Date }): Promise<Response> {
  if (request.method !== "POST") {
    // Stateless: no stream to open with GET and no session to end with DELETE.
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  if (Number(request.headers.get("content-length") ?? 0) > maxBodyBytes) return rpcError(413, "Request too large");
  const text = await request.text();
  if (text.length > maxBodyBytes) return rpcError(413, "Request too large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return rpcError(400, "Parse error");
  }

  const messages = (Array.isArray(body) ? body : [body]) as { method?: unknown; id?: unknown }[];
  const toolCalls = messages.filter((message) => message?.method === "tools/call");
  const refused = await access(sql, ipHash, toolCalls.length, now);
  if (refused) return rpcError(refused.status, refused.message, toolCalls[0]?.id ?? null);

  const server = createRadarServer(sql, () => now);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, { parsedBody: body });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    await server.close();
  }
}
