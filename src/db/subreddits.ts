/**
 * The subreddits Radar reads (US-568): a table the owner changes from
 * BuyerFinder's admin page, and the numbers that page shows beside it.
 */
import { inIndianPlace } from "../sort/phrases.ts";
import type { Sql } from "./client.ts";

/** Reddit's own rule for a name, as the table's check holds it. */
export const subredditName = /^[A-Za-z0-9_]{2,21}$/;

/** "r/Aquariums", " aquariums " and a pasted link all come to "Aquariums". */
export function cleanSubredditName(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.|old\.)?reddit\.com/i, "")
    .replace(/^\/?r\//i, "")
    .replace(/\/.*$/, "")
    .trim();
}

export interface ListedSubreddit {
  name: string;
  addedAt: Date;
  addedBy: string;
}

export async function listSubreddits(sql: Sql): Promise<ListedSubreddit[]> {
  const rows = await sql<{ name: string; added_at: Date; added_by: string }[]>`
    select name, added_at, added_by from subreddits order by lower(name)`;
  return rows.map((row) => ({ name: row.name, addedAt: row.added_at, addedBy: row.added_by }));
}

export type AddOutcome = "added" | "exists" | "invalid" | "refused";

export async function addSubreddit(sql: Sql, input: string): Promise<{ outcome: AddOutcome; name: string }> {
  const name = cleanSubredditName(input);
  if (!subredditName.test(name)) return { outcome: "invalid", name };
  // Radar's sellers do not sell in India (owner, 2026-11-04).
  if (inIndianPlace(name)) return { outcome: "refused", name };
  const rows = await sql`
    insert into subreddits (name, added_by) values (${name}, 'admin')
    on conflict do nothing returning name`;
  return { outcome: rows.length > 0 ? "added" : "exists", name };
}

export async function removeSubreddit(sql: Sql, input: string): Promise<boolean> {
  const name = cleanSubredditName(input);
  const rows = await sql`delete from subreddits where lower(name) = lower(${name}) returning name`;
  return rows.length > 0;
}

/**
 * The names in the order a run reads them, the busiest spread across its
 * searches, so no combined search runs out of pages while another reads one.
 * The run cuts the list into searches of `size`, in order, so every group
 * here holds `size` names but the last. Sorted by weight, the names are dealt
 * to the groups back and forth (1 2 3 3 2 1 ...), passing a full group by.
 */
export function balancedOrder(entries: readonly { name: string; weight: number }[], size = 10): string[] {
  const groupCount = Math.ceil(entries.length / size);
  if (groupCount <= 1) return entries.map((entry) => entry.name);
  const sorted = [...entries].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
  const capacity = Array.from({ length: groupCount }, (_, index) =>
    index < groupCount - 1 ? size : entries.length - size * (groupCount - 1),
  );
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  const turn: number[] = [];
  for (let index = 0; index < groupCount; index += 1) turn.push(index);
  for (let index = groupCount - 1; index >= 0; index -= 1) turn.push(index);
  let step = 0;
  for (const entry of sorted) {
    let group = turn[step % turn.length] as number;
    while ((groups[group] as string[]).length >= (capacity[group] as number)) {
      step += 1;
      group = turn[step % turn.length] as number;
    }
    (groups[group] as string[]).push(entry.name);
    step += 1;
  }
  return groups.flat();
}

/**
 * The list in reading order. A subreddit's weight is its kept requests of the
 * last 7 days: a run's stats are per search of ten, not per subreddit, and a
 * busy subreddit keeps more. One with none yet, a new one, weighs the median.
 */
export async function readingOrder(sql: Sql, now = new Date()): Promise<string[]> {
  const rows = await sql<{ name: string; kept: string }[]>`
    select s.name, count(r.id)::text as kept
    from subreddits s
    left join requests r on r.platform = 'reddit' and lower(r.channel) = lower(s.name)
      and r.posted_at >= ${now}::timestamptz - interval '7 days'
    group by s.name`;
  const kept = rows.map((row) => Number(row.kept));
  const known = kept.filter((count) => count > 0).sort((a, b) => a - b);
  const median = known.length > 0 ? (known[Math.floor(known.length / 2)] as number) : 0;
  return balancedOrder(rows.map((row, index) => ({ name: row.name, weight: kept[index] || median })));
}

export interface SubredditCount {
  name: string;
  /** Kept requests in the span. */
  requests: number;
  /** Of them, the ones a small seller could answer. */
  fit: number;
  /** Of them, the ones the seller-fit question was asked of. */
  judged: number;
}

export interface SubredditStats {
  days: number;
  listed: (SubredditCount & { addedAt: string; addedBy: string })[];
  /** Subreddits outside the list, found by the search terms, most fit first. */
  candidates: SubredditCount[];
}

/** The admin page's two tables: the list with its week, and what to add. */
export async function subredditStats(sql: Sql, days = 7, now = new Date()): Promise<SubredditStats> {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const listed = await sql<{ name: string; added_at: Date; added_by: string; requests: string; fit: string; judged: string }[]>`
    select s.name, s.added_at, s.added_by,
      count(r.id)::text as requests,
      count(r.id) filter (where r.seller_fit)::text as fit,
      count(r.seller_fit)::text as judged
    from subreddits s
    left join requests r on r.platform = 'reddit' and lower(r.channel) = lower(s.name)
      and r.removed_at is null and r.posted_at >= ${from} and r.posted_at < ${now}
    group by s.name, s.added_at, s.added_by
    order by count(r.id) filter (where r.seller_fit) desc, lower(s.name)`;
  // Search terms only: a phrase that is not a subreddit read ("r/...").
  const candidates = await sql<{ name: string; requests: string; fit: string; judged: string }[]>`
    select min(r.channel) as name,
      count(*)::text as requests,
      count(*) filter (where r.seller_fit)::text as fit,
      count(r.seller_fit)::text as judged
    from requests r
    where r.platform = 'reddit' and r.channel is not null and r.removed_at is null
      and r.phrase not like 'r/%'
      and r.posted_at >= ${from} and r.posted_at < ${now}
      and lower(r.channel) not in (select lower(name) from subreddits)
    group by lower(r.channel)
    order by count(*) filter (where r.seller_fit) desc, count(*) desc, lower(r.channel)
    limit 50`;
  const count = (row: { name: string; requests: string; fit: string; judged: string }): SubredditCount => ({
    name: row.name,
    requests: Number(row.requests),
    fit: Number(row.fit),
    judged: Number(row.judged),
  });
  return {
    days,
    listed: listed.map((row) => ({ ...count(row), addedAt: row.added_at.toISOString(), addedBy: row.added_by })),
    candidates: candidates.map(count),
  };
}
