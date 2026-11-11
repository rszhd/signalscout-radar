import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bearerMatches } from "../lib/bearer.ts";
import { createTestDatabase } from "../testing/database.ts";
import type { Sql } from "./client.ts";
import { nicheCounts } from "./niches.ts";

const now = new Date("2026-11-11T00:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
let sql: Sql;
let drop: () => Promise<void>;
let nextId = 0;

beforeEach(async () => {
  ({ sql, drop } = await createTestDatabase());
  await sql`insert into tags (slug, name, category, kind, shown_at) values
    ('dog-harnesses', 'Dog harnesses', 'pets', 'product', ${now}),
    ('phones', 'Phones', 'phones', 'product', ${now}),
    ('espresso-grinders', 'Espresso grinders', 'home-kitchen', 'product', null),
    ('alt-bose', 'Alternatives to Bose', 'audio', 'alt', ${now})`;
});
afterEach(async () => {
  await drop();
});

async function posts(
  count: number,
  { tags, fit, at = daysAgo(1), removed = false }: { tags: string[]; fit: boolean | null; at?: Date; removed?: boolean },
) {
  for (let i = 0; i < count; i += 1) {
    nextId += 1;
    await sql`insert into requests (platform, external_id, url, excerpt, wants, category, posted_at, phrase, tags, seller_fit, removed_at)
              values ('reddit', ${`p${nextId}`}, ${`https://r/${nextId}`}, 'Which one?', 'One', 'pets',
                      ${at}, 'test', ${tags}, ${fit}, ${removed ? now : null})`;
  }
}

describe("nicheCounts", () => {
  it("ranks product tags by fit posts, counts hidden tags, and leaves out old, removed and alt posts", async () => {
    await posts(3, { tags: ["dog-harnesses"], fit: true });
    await posts(1, { tags: ["dog-harnesses"], fit: true, at: daysAgo(10) });
    await posts(2, { tags: ["dog-harnesses"], fit: null });
    await posts(9, { tags: ["phones"], fit: false });
    await posts(1, { tags: ["phones"], fit: true });
    await posts(2, { tags: ["espresso-grinders"], fit: true });
    await posts(5, { tags: ["dog-harnesses"], fit: true, at: daysAgo(40) });
    await posts(5, { tags: ["dog-harnesses"], fit: true, removed: true });
    await posts(4, { tags: ["alt-bose"], fit: true });

    const niches = await nicheCounts(sql, 30, now);

    expect(niches.map((n) => n.slug)).toEqual(["dog-harnesses", "espresso-grinders", "phones"]);
    expect(niches[0]).toEqual({
      slug: "dog-harnesses",
      name: "Dog harnesses",
      category: "pets",
      shown: true,
      posts: 6,
      judged: 4,
      fit: 4,
      fitWeek: 3,
    });
    expect(niches[1]?.shown).toBe(false);
    expect(niches[2]).toMatchObject({ posts: 10, judged: 10, fit: 1 });
  });
});

describe("bearerMatches", () => {
  it("matches only the exact token, and nothing when the token is unset", () => {
    expect(bearerMatches("Bearer abc", "abc")).toBe(true);
    expect(bearerMatches("Bearer abd", "abc")).toBe(false);
    expect(bearerMatches("abc", "abc")).toBe(false);
    expect(bearerMatches(null, "abc")).toBe(false);
    expect(bearerMatches("Bearer ", undefined)).toBe(false);
    expect(bearerMatches("Bearer ", "")).toBe(false);
  });
});
