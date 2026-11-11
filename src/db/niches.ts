/**
 * Niches by the posts a small seller could answer (US-561), for BuyerFinder's
 * admin page, never Radar's public one: the ranking is BuyerFinder's sales
 * plan.
 *
 * A niche is a product tag, shown or still hidden: a hidden tag is only one
 * with few posts, and the admin wants to see it grow. `judged` counts posts
 * the seller-fit question was asked of; posts sorted before it have null and
 * are in `posts` only, so `fit / judged` is the share, not `fit / posts`.
 */
import { categorySlugs } from "../sort/categories.ts";
import type { Sql } from "./client.ts";

export interface Niche {
  slug: string;
  name: string;
  category: string;
  shown: boolean;
  posts: number;
  judged: number;
  fit: number;
  /** Fit posts in the last 7 days of the span. */
  fitWeek: number;
}

/** Product tags with their posts in the `days` before `now`, most fit posts first. */
export async function nicheCounts(sql: Sql, days: number, now = new Date()): Promise<Niche[]> {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await sql<
    { slug: string; name: string; category: string; shown: boolean; posts: string; judged: string; fit: string; fit_week: string }[]
  >`
    select t.slug, t.name, t.category, t.shown_at is not null as shown,
      count(*)::text as posts,
      count(r.seller_fit)::text as judged,
      count(*) filter (where r.seller_fit)::text as fit,
      count(*) filter (where r.seller_fit and r.posted_at >= ${week})::text as fit_week
    from tags t join requests r on t.slug = any (r.tags)
    where t.kind = 'product' and t.category in ${sql(categorySlugs as string[])}
      and r.removed_at is null and r.posted_at >= ${from} and r.posted_at < ${now}
    group by t.slug, t.name, t.category, t.shown_at
    order by count(*) filter (where r.seller_fit) desc, count(*) desc, t.name`;
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    category: row.category,
    shown: row.shown,
    posts: Number(row.posts),
    judged: Number(row.judged),
    fit: Number(row.fit),
    fitWeek: Number(row.fit_week),
  }));
}
