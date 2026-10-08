/**
 * The `tags` table: the listed tags from src/sort/tags.ts, and the ones the
 * model proposed. US-456.
 */
import { categorySlugs } from "../sort/categories.ts";
import { listedTagRows, proposalShownAt } from "../sort/tags.ts";
import type { Sql } from "./client.ts";
import type { RequestRow } from "./queries.ts";

export interface TagRow {
  slug: string;
  name: string;
  category: string;
  kind: "product" | "alt";
}

/**
 * Write the listed tags into the table, shown. A name changed in the list
 * changes here; a tag taken out of the list stays, so a subscription to it
 * does not point at nothing.
 */
export async function syncListedTags(sql: Sql): Promise<void> {
  if (listedTagRows.length === 0) return;
  await sql`
    insert into tags ${sql(listedTagRows.map((tag) => ({ ...tag, shown_at: new Date() })))}
    on conflict (slug) do update set name = excluded.name, category = excluded.category,
      shown_at = coalesce(tags.shown_at, excluded.shown_at)`;
}

/** Store what the model proposed, hidden. A slug already there keeps its row. */
export async function proposeTags(sql: Sql, proposals: readonly TagRow[]): Promise<void> {
  if (proposals.length === 0) return;
  await sql`
    insert into tags ${sql(proposals.map((tag) => ({ slug: tag.slug, name: tag.name, category: tag.category, kind: tag.kind })))}
    on conflict (slug) do nothing`;
}

/**
 * Show every hidden tag that live posts now carry often enough. Returns the
 * slugs shown, for the run's log.
 */
export async function showBusyProposals(sql: Sql): Promise<string[]> {
  const rows = await sql<{ slug: string }[]>`
    update tags set shown_at = now()
    where shown_at is null and slug in (
      select unnest(tags) as slug from requests where removed_at is null
      group by 1 having count(*) >= ${proposalShownAt})
    returning slug`;
  return rows.map((row) => row.slug);
}

/** Hidden tags no live post carries any more: proposals that never caught on. */
export async function forgetIdleProposals(sql: Sql): Promise<void> {
  await sql`
    delete from tags t where t.shown_at is null
      and not exists (select 1 from requests r where r.removed_at is null and t.slug = any (r.tags))`;
}

/** Every tag the sort may choose from, shown or not, so a proposal is reused. */
export async function allTags(sql: Sql): Promise<TagRow[]> {
  return sql<TagRow[]>`select slug, name, category, kind from tags order by category, slug`;
}

export interface TagCount extends TagRow {
  week: number;
}

/** The shown tags in the offered categories, with their posts of the last 7 days. */
export async function shownTags(sql: Sql, now = new Date()): Promise<TagCount[]> {
  const rows = await sql<(TagRow & { week: string })[]>`
    select t.slug, t.name, t.category, t.kind,
      (select count(*) from requests r
        where r.removed_at is null and t.slug = any (r.tags)
          and r.posted_at >= ${now}::timestamptz - interval '7 days')::text as week
    from tags t
    where t.shown_at is not null and t.category in ${sql(categorySlugs as string[])}
    order by t.category, t.name`;
  return rows.map((row) => ({ ...row, week: Number(row.week) }));
}

export async function shownTag(sql: Sql, slug: string): Promise<TagRow | undefined> {
  const [row] = await sql<TagRow[]>`
    select slug, name, category, kind from tags
    where slug = ${slug} and shown_at is not null and category in ${sql(categorySlugs as string[])}`;
  return row;
}

/** Of these slugs, the ones a person may subscribe to. */
export async function onlyShown(sql: Sql, slugs: readonly string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const rows = await sql<{ slug: string }[]>`
    select slug from tags
    where slug in ${sql(slugs as string[])} and shown_at is not null
      and category in ${sql(categorySlugs as string[])}`;
  return rows.map((row) => row.slug);
}

export async function requestsTagged(sql: Sql, slug: string, limit = 100): Promise<RequestRow[]> {
  return sql<RequestRow[]>`
    select id::text, platform, url, channel, title, excerpt, wants, category, posted_at as "postedAt"
    from requests
    where removed_at is null and ${slug} = any (tags) and category in ${sql(categorySlugs as string[])}
    order by posted_at desc limit ${limit}`;
}
