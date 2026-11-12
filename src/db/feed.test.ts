import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../testing/database.ts";
import type { Sql } from "./client.ts";
import { platformCountsLastDay, requestsPage } from "./queries.ts";

let sql: Sql;
let drop: () => Promise<void>;
beforeEach(async () => {
  ({ sql, drop } = await createTestDatabase());
});
afterEach(async () => {
  await drop();
});

const now = new Date("2026-11-05T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

async function insert(platform: string, id: string, postedAt: Date, fit: boolean | null = true) {
  await sql`insert into requests (platform, external_id, url, excerpt, wants, category, posted_at, phrase, seller_fit)
            values (${platform}, ${id}, ${`https://example.com/${id}`}, 'Which one?', 'A laptop', 'computers', ${postedAt}, 'test', ${fit})`;
}

describe("home feed (owner, 2026-11-05)", () => {
  it("pages newest first, without a gap or a repeat when posts share a time", async () => {
    for (let index = 0; index < 5; index += 1) await insert("reddit", `r${index}`, hoursAgo(index < 3 ? 1 : index));
    const urls = (rows: { url: string }[]) => rows.map((row) => row.url.replace("https://example.com/", ""));

    const first = await requestsPage(sql, { limit: 2 }, now);
    const last = first.at(-1)!;
    const second = await requestsPage(sql, { limit: 2, before: { postedAt: last.postedAt, id: last.id } }, now);
    const third = await requestsPage(sql, { limit: 2, before: { postedAt: second.at(-1)!.postedAt, id: second.at(-1)!.id } }, now);

    const all = [...urls(first), ...urls(second), ...urls(third)];
    expect(all).toHaveLength(5);
    expect(new Set(all).size).toBe(5);
    expect(all.slice(3)).toEqual(["r3", "r4"]);
  });

  it("shows Reddit posts a small seller could answer, and hides the rest (US-569)", async () => {
    await insert("reddit", "fit", hoursAgo(1));
    await insert("reddit", "not-fit", hoursAgo(2), false);
    await insert("reddit", "not-judged", hoursAgo(3), null);
    await insert("facebook", "f1", hoursAgo(2));
    await insert("forum", "o1", hoursAgo(2));
    const rows = await requestsPage(sql, { limit: 10 }, now);
    expect(rows.map((row) => row.url.replace("https://example.com/", ""))).toEqual(["fit"]);
    expect(await requestsPage(sql, { limit: 10, platform: "facebook" }, now)).toEqual([]);
  });

  it("gives each card its shown tags, products first, never a hidden one", async () => {
    await sql`insert into tags (slug, name, category, kind, shown_at) values
      ('laptops', 'Laptops', 'computers', 'product', ${now}),
      ('alt-dell', 'Alternatives to Dell', 'computers', 'alt', ${now}),
      ('hidden-tag', 'Hidden', 'computers', 'product', null)`;
    await insert("reddit", "tagged", hoursAgo(1));
    await sql`update requests set tags = ${["alt-dell", "hidden-tag", "laptops"]} where external_id = 'tagged'`;
    await insert("reddit", "untagged", hoursAgo(2));

    const rows = await requestsPage(sql, { limit: 10 }, now);
    expect(rows.map((row) => row.tagList)).toEqual([
      [
        { slug: "laptops", name: "Laptops" },
        { slug: "alt-dell", name: "Alternatives to Dell" },
      ],
      [],
    ]);
  });

  it("counts the shown posts of the last 24 hours only", async () => {
    await insert("reddit", "r1", hoursAgo(1));
    await insert("reddit", "r2", hoursAgo(23));
    await insert("reddit", "r3", hoursAgo(25));
    await insert("reddit", "r4", hoursAgo(2), false);
    await insert("facebook", "f1", hoursAgo(2));
    await insert("forum", "o1", hoursAgo(48));
    expect(await platformCountsLastDay(sql, now)).toEqual({ reddit: 2 });
  });
});
