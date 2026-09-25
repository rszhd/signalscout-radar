/**
 * Turning rows into what a page shows. Plain values only, because a React
 * island receives its props as JSON.
 */
import type { CategoryCount, RequestRow } from "@/db/queries.ts";
import { categoryBySlug, offeredCategories } from "@/sort/categories.ts";

export type Platform = "reddit" | "x";

export const platforms: Record<Platform, { name: string; icon: string }> = {
  reddit: { name: "Reddit", icon: "/brands/reddit.png" },
  x: { name: "X", icon: "/brands/x.png" },
};

export interface Card {
  id: string;
  platform: Platform;
  url: string;
  channel: string | null;
  title: string | null;
  excerpt: string;
  wants: string;
  category: string;
  categoryName: string;
  age: string;
}

export function formatAge(from: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export function toCard(row: RequestRow, now = new Date()): Card {
  return {
    id: row.id,
    platform: row.platform,
    url: row.url,
    channel: row.channel,
    title: row.title,
    excerpt: row.excerpt,
    wants: row.wants,
    category: row.category,
    categoryName: categoryBySlug(row.category)?.name ?? row.category,
    age: formatAge(row.postedAt, now),
  };
}

export interface CategoryTile {
  slug: string;
  name: string;
  kind: "software" | "services" | "goods";
  week: number;
  /** Per cent against the week before; null while the week before is too small to compare. */
  trend: number | null;
}

/** Every category with a request this week, busiest first. */
export function toTiles(counts: readonly CategoryCount[]): CategoryTile[] {
  const byCategory = new Map(counts.map((count) => [count.category, count]));
  return offeredCategories
    .map((category) => {
      const count = byCategory.get(category.slug);
      const week = count?.week ?? 0;
      const previous = count?.previousWeek ?? 0;
      return {
        slug: category.slug,
        name: category.name,
        kind: category.kind,
        week,
        trend: previous >= 5 ? Math.round(((week - previous) / previous) * 100) : null,
      };
    })
    .filter((tile) => tile.week > 0)
    .sort((a, b) => b.week - a.week);
}

/** Where a person asks for a post to come down. */
export const contactUrl =
  process.env.RADAR_CONTACT ?? "https://github.com/rszhd/signalscout-radar/issues/new";
