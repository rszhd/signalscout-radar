import { categorySlugs } from "../sort/categories.ts";
import type { Sql } from "./client.ts";

export interface RequestRow {
  id: string;
  platform: "reddit" | "x";
  url: string;
  channel: string | null;
  title: string | null;
  excerpt: string;
  wants: string;
  category: string;
  postedAt: Date;
}

/** What one UTC day has spent so far, providers and models together. */
export async function spentToday(sql: Sql, now = new Date()): Promise<number> {
  const day = now.toISOString().slice(0, 10);
  const [row] = await sql<{ micros: string }[]>`
    select coalesce(sum(provider_micros + model_micros), 0)::text as micros
    from runs
    where started_at >= ${`${day}T00:00:00Z`}::timestamptz
      and started_at < ${`${day}T00:00:00Z`}::timestamptz + interval '1 day'`;
  return Number(row?.micros ?? 0);
}

/** The ids in this list the worker has already paid to read. */
export async function alreadySeen(
  sql: Sql,
  platform: string,
  externalIds: readonly string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await sql<{ external_id: string }[]>`
    select external_id from seen_posts
    where platform = ${platform} and external_id in ${sql(externalIds as string[])}`;
  return new Set(rows.map((row) => row.external_id));
}

export async function markSeen(sql: Sql, platform: string, externalIds: readonly string[]) {
  if (externalIds.length === 0) return;
  await sql`
    insert into seen_posts ${sql(externalIds.map((external_id) => ({ platform, external_id })))}
    on conflict do nothing`;
}

export async function saveRequest(
  sql: Sql,
  row: Omit<RequestRow, "id"> & { externalId: string; phrase: string },
) {
  await sql`
    insert into requests (platform, external_id, url, channel, title, excerpt, wants, category, posted_at, phrase)
    values (${row.platform}, ${row.externalId}, ${row.url}, ${row.channel}, ${row.title},
            ${row.excerpt}, ${row.wants}, ${row.category}, ${row.postedAt}, ${row.phrase})
    on conflict (platform, external_id) do nothing`;
}

/** Thirty days is what the page shows; older rows serve nobody. */
export async function forgetOld(sql: Sql, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await sql`delete from requests where posted_at < ${cutoff} and removed_at is null`;
  await sql`delete from seen_posts where seen_at < ${cutoff}`;
}

/** The categories the page may show; a hidden kind's rows stay stored (US-429). */
const shown = () => categorySlugs as string[];

const columns = (sql: Sql) => sql`
  id::text, platform, url, channel, title, excerpt, wants, category, posted_at as "postedAt"`;

export async function latestRequests(sql: Sql, limit = 50): Promise<RequestRow[]> {
  return sql<RequestRow[]>`
    select ${columns(sql)} from requests
    where removed_at is null and category in ${sql(shown())}
    order by posted_at desc limit ${limit}`;
}

export async function requestsIn(sql: Sql, category: string, limit = 100): Promise<RequestRow[]> {
  return sql<RequestRow[]>`
    select ${columns(sql)} from requests
    where removed_at is null and category = ${category} and category in ${sql(shown())}
    order by posted_at desc limit ${limit}`;
}

export interface CategoryCount {
  category: string;
  week: number;
  previousWeek: number;
}

/** Requests per category in the last 7 days, and in the 7 before. */
export async function categoryCounts(sql: Sql, now = new Date()): Promise<CategoryCount[]> {
  const rows = await sql<{ category: string; week: string; previous: string }[]>`
    select category,
      count(*) filter (where posted_at >= ${now}::timestamptz - interval '7 days')::text as week,
      count(*) filter (where posted_at < ${now}::timestamptz - interval '7 days'
                         and posted_at >= ${now}::timestamptz - interval '14 days')::text as previous
    from requests
    where removed_at is null and posted_at >= ${now}::timestamptz - interval '14 days'
      and category in ${sql(shown())}
    group by category`;
  return rows.map((row) => ({
    category: row.category,
    week: Number(row.week),
    previousWeek: Number(row.previous),
  }));
}

/** When the last run finished, for "Updated 12 min ago". */
export async function lastRunAt(sql: Sql): Promise<Date | null> {
  const [row] = await sql<{ at: Date | null }[]>`select max(finished_at) as at from runs`;
  return row?.at ?? null;
}

export interface PhraseReport {
  platform: string;
  phrase: string;
  runs: number;
  spentMicros: number;
  fetched: number;
  filtered: number;
  kept: number;
  errors: number;
  /** Requests kept per dollar spent on this phrase; null before it has cost anything. */
  keptPerDollar: number | null;
}

/** Every phrase over the last `days`, best value first. */
export async function phraseReport(sql: Sql, days = 7, now = new Date()): Promise<PhraseReport[]> {
  const rows = await sql<Record<string, string>[]>`
    select s.platform, s.phrase, count(*)::text as runs,
      sum(s.provider_micros + s.model_micros)::text as spent,
      sum(s.fetched)::text as fetched, sum(s.filtered)::text as filtered,
      sum(s.kept)::text as kept, sum(s.errors)::text as errors
    from phrase_stats s join runs r on r.id = s.run_id
    where r.started_at >= ${now}::timestamptz - make_interval(days => ${days})
    group by s.platform, s.phrase`;
  return rows
    .map((row) => {
      const spentMicros = Number(row.spent);
      const kept = Number(row.kept);
      return {
        platform: row.platform as string,
        phrase: row.phrase as string,
        runs: Number(row.runs),
        spentMicros,
        fetched: Number(row.fetched),
        filtered: Number(row.filtered),
        kept,
        errors: Number(row.errors),
        keptPerDollar: spentMicros > 0 ? kept / (spentMicros / 1e6) : null,
      };
    })
    .sort((a, b) => (b.keptPerDollar ?? -1) - (a.keptPerDollar ?? -1));
}
