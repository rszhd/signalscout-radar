import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../testing/database.ts";
import type { Sql } from "./client.ts";
import { leavingProducts, risingTags, shownSpan, tagChannels, topCategories, topTags } from "./trends.ts";

const now = new Date("2026-10-26T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
let sql: Sql;
let drop: () => Promise<void>;
let nextId = 0;

beforeEach(async () => {
  ({ sql, drop } = await createTestDatabase());
  await sql`insert into tags (slug, name, category, kind, shown_at) values
    ('laptops', 'Laptops', 'computers', 'product', ${now}),
    ('monitors', 'Monitors', 'computers', 'product', ${now}),
    ('alt-hubspot', 'Alternatives to HubSpot', 'sales-crm', 'alt', ${now}),
    ('alt-hidden', 'Alternatives to Hidden', 'sales-crm', 'alt', null)`;
});
afterEach(async () => {
  await drop();
});

async function posts(
  count: number,
  { tags, category = "computers", at = daysAgo(1), platform = "reddit", channel = "SuggestALaptop", removed = false }: {
    tags: string[];
    category?: string;
    at?: Date;
    platform?: string;
    channel?: string | null;
    removed?: boolean;
  },
) {
  for (let i = 0; i < count; i += 1) {
    nextId += 1;
    await sql`insert into requests (platform, external_id, url, channel, excerpt, wants, category, posted_at, phrase, tags, removed_at)
              values (${platform}, ${`p${nextId}`}, ${`https://r/${nextId}`}, ${channel}, 'Which one?', 'One',
                      ${category}, ${at}, 'test', ${tags}, ${removed ? now : null})`;
  }
}

describe("trends", () => {
  it("counts only shown tags, live posts and the last 30 days", async () => {
    await posts(3, { tags: ["laptops"] });
    await posts(2, { tags: ["laptops"], at: daysAgo(40) });
    await posts(2, { tags: ["laptops"], removed: true });
    await posts(1, { tags: ["monitors"] });
    await posts(4, { tags: ["alt-hubspot"], category: "sales-crm" });
    await posts(9, { tags: ["alt-hidden"], category: "sales-crm" });

    expect(await topTags(sql, 15, shownSpan(now))).toEqual([
      { slug: "laptops", name: "Laptops", count: 3 },
      { slug: "monitors", name: "Monitors", count: 1 },
    ]);
    expect(await leavingProducts(sql, 12, shownSpan(now))).toEqual([{ slug: "alt-hubspot", name: "Alternatives to HubSpot", count: 4 }]);
    expect(await topCategories(sql, shownSpan(now))).toEqual([
      { slug: "sales-crm", count: 13 },
      { slug: "computers", count: 4 },
    ]);
  });

  it("counts the whole history when the span is open, and between dates when it is not", async () => {
    await posts(3, { tags: ["laptops"] });
    await posts(2, { tags: ["laptops"], at: daysAgo(40) });

    expect(await topTags(sql, 15, { from: null, until: null })).toEqual([{ slug: "laptops", name: "Laptops", count: 5 }]);
    expect(await topCategories(sql, { from: daysAgo(50), until: daysAgo(30) })).toEqual([{ slug: "computers", count: 2 }]);
  });

  it("ranks rising tags by how many more, and leaves out small or falling ones", async () => {
    await posts(12, { tags: ["laptops"], at: daysAgo(2) });
    await posts(6, { tags: ["laptops"], at: daysAgo(9) });
    await posts(5, { tags: ["monitors"], at: daysAgo(2) });
    await posts(1, { tags: ["monitors"], at: daysAgo(9) });
    // Four this week from none is under the floor; falling is left out too.
    await posts(4, { tags: ["alt-hubspot"], category: "sales-crm", at: daysAgo(2) });

    expect(await risingTags(sql, 10, now)).toEqual([
      { slug: "laptops", name: "Laptops", week: 12, previousWeek: 6 },
      { slug: "monitors", name: "Monitors", week: 5, previousWeek: 1 },
    ]);
  });

  it("names where a tag's posts were found, with X as one place", async () => {
    await posts(3, { tags: ["laptops"], channel: "SuggestALaptop" });
    await posts(1, { tags: ["laptops"], channel: "BuyItForLife" });
    await posts(2, { tags: ["laptops"], platform: "x", channel: "is there an app" });

    expect(await tagChannels(sql, "laptops", 6, now)).toEqual([
      { platform: "reddit", channel: "SuggestALaptop", count: 3 },
      { platform: "x", channel: null, count: 2 },
      { platform: "reddit", channel: "BuyItForLife", count: 1 },
    ]);
  });
});
