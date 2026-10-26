/**
 * Radar's MCP server: the tools a person's own Claude or ChatGPT calls to
 * read the stored product requests. US-462.
 *
 * Tools, not SQL. Each tool is one query written here, run in a read-only
 * transaction as `radar_reader` (migration 004), which can select the shown
 * columns of `requests` and `tags` and nothing else. No author is returned,
 * because none is stored. Every query keeps to the shown days, the same 30
 * the page shows; older rows stay for a premium plan to open later.
 *
 * The model runs on the caller's side, so a call costs one query here.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Sql } from "../db/client.ts";
import { shownDays, shownSince } from "../db/queries.ts";
import { leavingProducts, risingFloor, risingTags, topCategories, topTags } from "../db/trends.ts";
import { siteUrl } from "../lib/links.ts";
import { categoryBySlug, categorySlugs, offeredCategories } from "../sort/categories.ts";

/** The most rows one call returns, so a caller pages through a few at a time. */
export const maxRows = 25;

const instructions = `BuyerFinder Radar collects public posts from Reddit and X where someone asks which product to buy or use, or whom to hire, and sorts them by category and tag. Each request has an excerpt, a one-line "wants" summary, and a link to the original post. Only the last ${shownDays} days are available. Counts reflect the subreddits and X searches Radar reads, not the whole market. Call list_categories or list_tags first to learn the slugs that the other tools filter by. Link people to the post's url so they can answer it there.`;

interface RequestOut {
  id: string;
  platform: "reddit" | "x";
  url: string;
  subreddit: string | null;
  title: string | null;
  excerpt: string;
  wants: string;
  category: string;
  tags: string[];
  posted_at: string;
}

/** Run `work` read-only, as the role that can read only what is shown. */
export async function asReader<T>(sql: Sql, work: (sql: Sql) => Promise<T>): Promise<T> {
  return (await sql.begin("read only", async (tx) => {
    await tx`set local role radar_reader`;
    // A transaction is a Sql for every query these tools make.
    return work(tx as unknown as Sql);
  })) as T;
}

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 1) }] });

/** `%` and `_` typed by a caller match themselves, not any text. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function toOut(row: Omit<RequestOut, "posted_at"> & { posted_at: Date }): RequestOut {
  return { ...row, posted_at: row.posted_at.toISOString() };
}

const requestColumns = (sql: Sql) => sql`
  id::text, platform, url, case when platform = 'reddit' then channel end as subreddit,
  title, excerpt, wants, category, tags, posted_at`;

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function createRadarServer(sql: Sql, now: () => Date = () => new Date()): McpServer {
  const server = new McpServer({ name: "buyerfinder-radar", version: "1.0.0" }, { instructions });
  const categorySlug = z.enum(categorySlugs);

  server.registerTool(
    "search_requests",
    {
      title: "Search product requests",
      description: `Find posts where people ask what to buy or whom to hire, newest first. Filters combine. "query" matches words in the post and its summary. Dates are ISO 8601 and cannot reach past the last ${shownDays} days. Returns up to ${maxRows} requests, each with id, platform, url, subreddit (null for X), title, excerpt, wants, category, tags and posted_at.`,
      inputSchema: {
        query: z.string().min(2).max(100).describe("Words to find, e.g. \"standing desk\"").optional(),
        category: categorySlug.describe("A category slug from list_categories").optional(),
        tag: z.string().max(60).describe("A tag slug from list_tags, e.g. \"standing-desks\" or \"alt-hubspot\"").optional(),
        platform: z.enum(["reddit", "x"]).optional(),
        since: z.iso.datetime({ offset: true }).describe("Posted at or after this time").optional(),
        until: z.iso.datetime({ offset: true }).describe("Posted before this time").optional(),
        limit: z.number().int().min(1).max(maxRows).default(10),
      },
      annotations: readOnly,
    },
    async ({ query, category, tag, platform, since, until, limit }) => {
      const floor = shownSince(now());
      const from = since && new Date(since) > floor ? new Date(since) : floor;
      const rows = await asReader(sql, (tx) => tx<(Omit<RequestOut, "posted_at"> & { posted_at: Date })[]>`
        select ${requestColumns(tx)} from requests
        where removed_at is null and category in ${tx(categorySlugs as string[])} and posted_at >= ${from}
          ${until ? tx`and posted_at < ${new Date(until)}` : tx``}
          ${category ? tx`and category = ${category}` : tx``}
          ${tag ? tx`and ${tag} = any (tags)` : tx``}
          ${platform ? tx`and platform = ${platform}` : tx``}
          ${query ? tx`and (excerpt ilike ${likePattern(query)} or wants ilike ${likePattern(query)} or title ilike ${likePattern(query)})` : tx``}
        order by posted_at desc
        limit ${limit}`);
      return json(rows.map(toOut));
    },
  );

  server.registerTool(
    "get_request",
    {
      title: "Get one request",
      description: "One request by the id search_requests returned, with its link to the original post.",
      inputSchema: { id: z.string().regex(/^\d{1,18}$/).describe("The request's id") },
      annotations: readOnly,
    },
    async ({ id }) => {
      const [row] = await asReader(sql, (tx) => tx<(Omit<RequestOut, "posted_at"> & { posted_at: Date })[]>`
        select ${requestColumns(tx)} from requests
        where id = ${id} and removed_at is null and category in ${tx(categorySlugs as string[])}
          and posted_at >= ${shownSince(now())}`);
      if (!row) return { ...json({ error: `No request ${id} in the last ${shownDays} days.` }), isError: true };
      return json(toOut(row));
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description: `Every category with its slug, name, kind (software, services or goods), what it covers, and its number of requests in the last ${shownDays} days.`,
      annotations: readOnly,
    },
    async () => {
      const counts = new Map((await asReader(sql, (tx) => topCategories(tx, now()))).map((row) => [row.slug, row.count]));
      return json(
        offeredCategories.map((category) => ({
          slug: category.slug,
          name: category.name,
          kind: category.kind,
          covers: category.covers,
          requests: counts.get(category.slug) ?? 0,
          page: `${siteUrl}/c/${category.slug}`,
        })),
      );
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "List tags",
      description: `Tags finer than a category, each with its slug, name, category, kind and number of requests in the last ${shownDays} days. Kind "product" is a thing someone sells, like "standing-desks"; kind "alt" is a product people want to leave, like "alt-hubspot". Only tags with at least one request are listed.`,
      inputSchema: { category: categorySlug.describe("Only this category's tags").optional() },
      annotations: readOnly,
    },
    async ({ category }) => {
      const rows = await asReader(sql, (tx) => tx<{ slug: string; name: string; category: string; kind: string; requests: string }[]>`
        select t.slug, t.name, t.category, t.kind, count(*)::text as requests
        from tags t join requests r on t.slug = any (r.tags)
        where t.shown_at is not null and t.category in ${tx(categorySlugs as string[])}
          ${category ? tx`and t.category = ${category}` : tx``}
          and r.removed_at is null and r.posted_at >= ${shownSince(now())}
        group by t.slug, t.name, t.category, t.kind
        order by t.category, count(*) desc, t.name`);
      return json(rows.map((row) => ({ ...row, requests: Number(row.requests), page: `${siteUrl}/t/${row.slug}` })));
    },
  );

  server.registerTool(
    "trends",
    {
      title: "Trends",
      description: `Counts behind the trends page. "rising": tags with more requests in the last 7 days than the 7 before (at least ${risingFloor} this week), by how many more. "leaving": products people ask for an alternative to. "top_tags": the most requested tags. "categories": requests per category. All within the last ${shownDays} days.`,
      inputSchema: {
        view: z.enum(["rising", "leaving", "top_tags", "categories"]),
        limit: z.number().int().min(1).max(maxRows).default(10),
      },
      annotations: readOnly,
    },
    async ({ view, limit }) => {
      const at = now();
      const rows = await asReader(sql, async (tx) => {
        if (view === "rising") return risingTags(tx, limit, at);
        if (view === "leaving") return leavingProducts(tx, limit, at);
        if (view === "top_tags") return topTags(tx, limit, at);
        return (await topCategories(tx, at))
          .slice(0, limit)
          .map((row) => ({ ...row, name: categoryBySlug(row.slug)?.name ?? row.slug }));
      });
      return json(rows);
    },
  );

  return server;
}
