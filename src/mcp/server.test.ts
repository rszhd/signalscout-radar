import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "../db/client.ts";
import { createTestDatabase } from "../testing/database.ts";
import { callsPerDay, handleMcp } from "./http.ts";
import { asReader } from "./server.ts";

const now = new Date("2026-10-26T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
let sql: Sql;
let drop: () => Promise<void>;

beforeEach(async () => {
  ({ sql, drop } = await createTestDatabase());
  await sql`insert into tags (slug, name, category, kind, shown_at) values
    ('standing-desks', 'Standing desks', 'home-office', 'product', ${now}),
    ('alt-hubspot', 'Alternatives to HubSpot', 'sales-crm', 'alt', ${now})`;
  await sql`insert into requests (platform, external_id, url, channel, excerpt, wants, category, posted_at, phrase, tags, removed_at) values
    ('reddit', 'a', 'https://reddit.com/a', 'OfficeChairs', 'Which standing desk under $400?', 'A standing desk under $400', 'home-office', ${daysAgo(1)}, 'r/OfficeChairs', ${["standing-desks"]}, null),
    ('x', 'b', 'https://x.com/i/status/b', 'what app do you', 'Leaving HubSpot, what CRM 100%?', 'A cheaper CRM', 'sales-crm', ${daysAgo(2)}, 'what app do you', ${["alt-hubspot"]}, null),
    ('reddit', 'c', 'https://reddit.com/c', 'OfficeChairs', 'Old standing desk post', 'A standing desk', 'home-office', ${daysAgo(40)}, 'r/OfficeChairs', ${["standing-desks"]}, null),
    ('reddit', 'd', 'https://reddit.com/d', 'OfficeChairs', 'Removed standing desk post', 'A standing desk', 'home-office', ${daysAgo(1)}, 'r/OfficeChairs', ${["standing-desks"]}, ${now})`;
});
afterEach(async () => {
  await drop();
});

let nextId = 0;
async function rpc(method: string, params: Record<string, unknown> = {}, ipHash = "ip-1") {
  nextId += 1;
  const request = new Request("http://localhost/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId, method, params }),
  });
  const response = await handleMcp(request, { sql, ipHash, now });
  return { status: response.status, body: (await response.json()) as { result?: any; error?: { message: string } } };
}

async function call(name: string, args: Record<string, unknown> = {}, ipHash?: string) {
  const { status, body } = await rpc("tools/call", { name, arguments: args }, ipHash);
  expect(status).toBe(200);
  return { ...body.result, data: JSON.parse(body.result.content[0].text) };
}

describe("MCP", () => {
  it("answers initialize and lists the six read-only tools, each described", async () => {
    const init = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(init.body.result.serverInfo.name).toBe("buyerfinder-radar");
    expect(init.body.result.instructions).toContain("every request Radar has kept");

    const { body } = await rpc("tools/list");
    const tools = body.result.tools as { name: string; description: string; annotations: { readOnlyHint: boolean } }[];
    expect(tools.map((tool) => tool.name).sort()).toEqual(["count_requests", "get_request", "list_categories", "list_tags", "search_requests", "trends"]);
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(40);
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });

  it("searches every live request, old ones too, with no author and X without a subreddit", async () => {
    const all = await call("search_requests", {});
    expect(all.data.map((row: { url: string }) => row.url)).toEqual(["https://reddit.com/a", "https://x.com/i/status/b", "https://reddit.com/c"]);
    expect(Object.keys(all.data[0]).sort()).toEqual(
      ["category", "excerpt", "id", "platform", "posted_at", "subreddit", "tags", "title", "url", "wants"].sort(),
    );
    expect(all.data[0].subreddit).toBe("OfficeChairs");
    expect(all.data[1].subreddit).toBeNull();

    expect((await call("search_requests", { query: "standing desk" })).data).toHaveLength(2);
    expect((await call("search_requests", { tag: "alt-hubspot" })).data[0].url).toBe("https://x.com/i/status/b");
    expect((await call("search_requests", { platform: "x", category: "home-office" })).data).toEqual([]);
    // "%" is a character to find, not "anything".
    expect((await call("search_requests", { query: "%%" })).data).toEqual([]);
    expect((await call("search_requests", { query: "100%" })).data).toHaveLength(1);
    // Paging back: everything before the oldest row of the last page.
    const older = await call("search_requests", { until: all.data[1].posted_at });
    expect(older.data.map((row: { url: string }) => row.url)).toEqual(["https://reddit.com/c"]);
  });

  it("gets one request, old ones too, and refuses a removed one", async () => {
    const ids = Object.fromEntries(
      (await sql<{ external_id: string; id: string }[]>`select external_id, id::text from requests`).map((row) => [row.external_id, row.id]),
    );
    expect((await call("get_request", { id: ids.c })).data.url).toBe("https://reddit.com/c");
    expect((await call("get_request", { id: ids.d })).isError).toBe(true);
  });

  it("counts requests in total, per period and per group", async () => {
    expect((await call("count_requests", { query: "standing desk" })).data).toEqual([{ count: 2 }]);
    expect((await call("count_requests", { by: "month" })).data).toEqual([
      { group: "2026-09-01", count: 1 },
      { group: "2026-10-01", count: 2 },
    ]);
    expect((await call("count_requests", { by: "tag" })).data).toEqual([
      { group: "standing-desks", count: 2 },
      { group: "alt-hubspot", count: 1 },
    ]);
  });

  it("lists categories and tags with counts, and serves the trends", async () => {
    const categories = (await call("list_categories")).data as { slug: string; requests: number }[];
    expect(categories.find((row) => row.slug === "home-office")?.requests).toBe(2);
    const recent = (await call("list_categories", { since: daysAgo(30).toISOString() })).data as typeof categories;
    expect(recent.find((row) => row.slug === "home-office")?.requests).toBe(1);
    expect((await call("list_tags", { category: "sales-crm" })).data).toEqual([
      { slug: "alt-hubspot", name: "Alternatives to HubSpot", category: "sales-crm", kind: "alt", requests: 1, page: "https://radar.buyerfinder.run/t/alt-hubspot" },
    ]);
    expect((await call("trends", { view: "leaving" })).data).toEqual([{ slug: "alt-hubspot", name: "Alternatives to HubSpot", count: 1 }]);
  });

  it("refuses a bad argument without running a query", async () => {
    const { body } = await rpc("tools/call", { name: "search_requests", arguments: { limit: 500 } });
    expect(body.result?.isError ?? Boolean(body.error)).toBe(true);
  });

  it("stops one address after the day's calls, and not another", async () => {
    await sql`insert into mcp_calls (ip_hash, day, calls) values ('busy', '2026-10-26', ${callsPerDay})`;
    const refused = await rpc("tools/call", { name: "list_categories", arguments: {} }, "busy");
    expect(refused.status).toBe(429);
    expect(refused.body.error?.message).toContain(`${callsPerDay} tool calls a day`);
    // Listing the tools is not a call.
    expect((await rpc("tools/list", {}, "busy")).status).toBe(200);
    expect((await rpc("tools/call", { name: "list_categories", arguments: {} }, "quiet")).status).toBe(200);
  });

  it("reads as a role that cannot see subscribers or write", async () => {
    await expect(asReader(sql, (tx) => tx`select email from subscribers`)).rejects.toThrow(/permission denied/);
    await expect(asReader(sql, (tx) => tx`select phrase from requests`)).rejects.toThrow(/permission denied/);
    await expect(asReader(sql, (tx) => tx`update requests set wants = 'x'`)).rejects.toThrow(/read-only/);
  });

  it("answers GET with 405, since there is no stream to open", async () => {
    const response = await handleMcp(new Request("http://localhost/mcp"), { sql, ipHash: "ip-1", now });
    expect(response.status).toBe(405);
  });
});
