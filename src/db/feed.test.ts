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

async function insert(platform: string, id: string, postedAt: Date) {
  await sql`insert into requests (platform, external_id, url, excerpt, wants, category, posted_at, phrase)
            values (${platform}, ${id}, ${`https://example.com/${id}`}, 'Which one?', 'A laptop', 'computers', ${postedAt}, 'test')`;
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

  it("pages one platform alone", async () => {
    await insert("reddit", "r", hoursAgo(1));
    await insert("facebook", "f1", hoursAgo(2));
    await insert("facebook", "f2", hoursAgo(30));
    const rows = await requestsPage(sql, { limit: 10, platform: "facebook" }, now);
    expect(rows.map((row) => row.platform)).toEqual(["facebook", "facebook"]);
  });

  it("counts each platform's posts of the last 24 hours only", async () => {
    await insert("reddit", "r1", hoursAgo(1));
    await insert("reddit", "r2", hoursAgo(23));
    await insert("reddit", "r3", hoursAgo(25));
    await insert("facebook", "f1", hoursAgo(2));
    await insert("forum", "o1", hoursAgo(48));
    expect(await platformCountsLastDay(sql, now)).toEqual({ reddit: 2, facebook: 1 });
  });
});
