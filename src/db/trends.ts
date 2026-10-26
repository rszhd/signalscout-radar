/**
 * What the trends page and the MCP tools count. US-463, US-462.
 *
 * Every count covers the posts Radar read. The page keeps to the shown days
 * (`shownSince`): a chart counts posts, it never shows one, but the page
 * promises nothing older than 30 days. MCP counts over any span, the whole
 * history by default (owner, 2026-10-26). The counts follow where the worker
 * looks and how much of each run a source gets, so they compare within
 * themselves rather than claim demand.
 */
import { categorySlugs } from "../sort/categories.ts";
import type { Sql } from "./client.ts";
import { shownSince } from "./queries.ts";

/**
 * Fewer posts than this in a week and a tag's change is noise: 1 to 4 is
 * "+300%". The same floor the category tiles use before they show a trend.
 */
export const risingFloor = 5;

const shown = () => categorySlugs as string[];

/** Posted at or after `from` and before `until`; null leaves that side open. */
export interface Span {
  from: Date | null;
  until: Date | null;
}

/** What the page counts: the shown days up to now. */
export const shownSpan = (now = new Date()): Span => ({ from: shownSince(now), until: null });

const within = (sql: Sql, span: Span) => sql`
  ${span.from ? sql`and r.posted_at >= ${span.from}` : sql``}
  ${span.until ? sql`and r.posted_at < ${span.until}` : sql``}`;

export interface Count {
  slug: string;
  name: string;
  count: number;
}

export interface Rising {
  slug: string;
  name: string;
  week: number;
  previousWeek: number;
}

export interface Channel {
  platform: "reddit" | "x";
  /** The subreddit; null for X, which has none. */
  channel: string | null;
  count: number;
}

/** Shown tags of one kind, with their posts in the shown days, most first. */
async function tagCounts(sql: Sql, kind: "product" | "alt", limit: number, span: Span): Promise<Count[]> {
  const rows = await sql<{ slug: string; name: string; count: string }[]>`
    select t.slug, t.name, count(*)::text as count
    from tags t join requests r on t.slug = any (r.tags)
    where t.kind = ${kind} and t.shown_at is not null and t.category in ${sql(shown())}
      and r.removed_at is null ${within(sql, span)}
    group by t.slug, t.name
    order by count(*) desc, t.name
    limit ${limit}`;
  return rows.map((row) => ({ slug: row.slug, name: row.name, count: Number(row.count) }));
}

/**
 * The products people ask to leave: each `alt-<product>` tag. A post here is
 * a buyer for every competitor of that product.
 */
export function leavingProducts(sql: Sql, limit = 12, span = shownSpan()): Promise<Count[]> {
  return tagCounts(sql, "alt", limit, span);
}

/** What people ask for most, by product tag. */
export function topTags(sql: Sql, limit = 15, span = shownSpan()): Promise<Count[]> {
  return tagCounts(sql, "product", limit, span);
}

/** Requests per category in the span, most first. The slug is the category's. */
export async function topCategories(sql: Sql, span = shownSpan()): Promise<{ slug: string; count: number }[]> {
  const rows = await sql<{ slug: string; count: string }[]>`
    select category as slug, count(*)::text as count from requests r
    where removed_at is null and category in ${sql(shown())} ${within(sql, span)}
    group by category
    order by count(*) desc, category`;
  return rows.map((row) => ({ slug: row.slug, count: Number(row.count) }));
}

/**
 * Shown tags with more posts in the last 7 days than in the 7 before, by how
 * many more. By the difference, not the per cent, so a tag that went from 5
 * to 40 ranks above one that went from 1 to 6.
 */
export async function risingTags(sql: Sql, limit = 10, now = new Date()): Promise<Rising[]> {
  const rows = await sql<{ slug: string; name: string; week: string; previous: string }[]>`
    select t.slug, t.name,
      count(*) filter (where r.posted_at >= ${now}::timestamptz - interval '7 days')::text as week,
      count(*) filter (where r.posted_at < ${now}::timestamptz - interval '7 days')::text as previous
    from tags t join requests r on t.slug = any (r.tags)
    where t.shown_at is not null and t.category in ${sql(shown())}
      and r.removed_at is null and r.posted_at >= ${now}::timestamptz - interval '14 days'
      and r.posted_at < ${now}::timestamptz
    group by t.slug, t.name`;
  return rows
    .map((row) => ({ slug: row.slug, name: row.name, week: Number(row.week), previousWeek: Number(row.previous) }))
    .filter((row) => row.week >= risingFloor && row.week > row.previousWeek)
    .sort((a, b) => b.week - b.previousWeek - (a.week - a.previousWeek) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Where one tag's posts were found: each subreddit, and X as one place. */
export async function tagChannels(sql: Sql, slug: string, limit = 6, now = new Date()): Promise<Channel[]> {
  const rows = await sql<{ platform: "reddit" | "x"; channel: string | null; count: string }[]>`
    select platform, case when platform = 'x' then null else channel end as channel, count(*)::text as count
    from requests
    where removed_at is null and ${slug} = any (tags) and category in ${sql(shown())}
      and posted_at >= ${shownSince(now)}
    group by 1, 2
    order by count(*) desc, 2
    limit ${limit}`;
  return rows.map((row) => ({ platform: row.platform, channel: row.channel, count: Number(row.count) }));
}
