import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../testing/database.ts";
import type { Sql } from "./client.ts";
import {
  addSubreddit,
  balancedOrder,
  cleanSubredditName,
  listSubreddits,
  readingOrder,
  removeSubreddit,
  subredditStats,
} from "./subreddits.ts";

const now = new Date("2026-11-11T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
let sql: Sql;
let drop: () => Promise<void>;
let nextId = 0;

beforeEach(async () => {
  ({ sql, drop } = await createTestDatabase());
  // Each test starts from a list of its own, not the survey's 29.
  await sql`delete from subreddits`;
});
afterEach(async () => {
  await drop();
});

async function post(channel: string, { phrase, fit = null, at = daysAgo(1) }: { phrase: string; fit?: boolean | null; at?: Date }) {
  nextId += 1;
  await sql`insert into requests (platform, external_id, url, channel, excerpt, wants, category, posted_at, phrase, seller_fit)
            values ('reddit', ${`p${nextId}`}, ${`https://r/${nextId}`}, ${channel}, 'Which one?', 'One', 'pets',
                    ${at}, ${phrase}, ${fit})`;
}

describe("the migration", () => {
  it("starts with the survey's 29", async () => {
    const { sql: fresh, drop: dropFresh } = await createTestDatabase();
    const list = await listSubreddits(fresh);
    await dropFresh();
    expect(list).toHaveLength(29);
    expect(list.every((row) => row.addedBy === "survey")).toBe(true);
  });
});

describe("adding and removing", () => {
  it("cleans the name, refuses a bad one or an Indian place, and knows one in another case", async () => {
    expect(cleanSubredditName(" r/Aquariums ")).toBe("Aquariums");
    expect(cleanSubredditName("https://www.reddit.com/r/knitting/comments/abc/")).toBe("knitting");
    expect(await addSubreddit(sql, "r/Aquariums")).toEqual({ outcome: "added", name: "Aquariums" });
    expect(await addSubreddit(sql, "aquariums")).toEqual({ outcome: "exists", name: "aquariums" });
    expect((await addSubreddit(sql, "not a name!")).outcome).toBe("invalid");
    expect((await addSubreddit(sql, "india")).outcome).toBe("refused");
    expect((await listSubreddits(sql)).map((row) => [row.name, row.addedBy])).toEqual([["Aquariums", "admin"]]);

    expect(await removeSubreddit(sql, "AQUARIUMS")).toBe(true);
    expect(await removeSubreddit(sql, "aquariums")).toBe(false);
    expect(await listSubreddits(sql)).toEqual([]);
  });
});

describe("balancedOrder", () => {
  it("keeps a list of ten or fewer as it is", () => {
    expect(balancedOrder([{ name: "a", weight: 1 }, { name: "b", weight: 9 }])).toEqual(["a", "b"]);
  });

  it("spreads the busiest across groups of at most ten", () => {
    const entries = Array.from({ length: 25 }, (_, index) => ({ name: `s${String(index).padStart(2, "0")}`, weight: 25 - index }));
    const order = balancedOrder(entries);
    expect(new Set(order).size).toBe(25);
    const groups = [order.slice(0, 10), order.slice(10, 20), order.slice(20)];
    // The run cuts the list in tens, so the groups are 10, 10 and the rest.
    expect(groups.map((group) => group.length)).toEqual([10, 10, 5]);
    // The three busiest open the three groups.
    expect(groups.map((group) => group[0])).toEqual(["s00", "s01", "s02"]);
    const weightOf = (name: string) => entries.find((entry) => entry.name === name)?.weight ?? 0;
    const sums = groups.map((group) => group.reduce((sum, name) => sum + weightOf(name), 0));
    // The small last group cannot match the others; the two full ones are close.
    expect(Math.abs((sums[0] as number) - (sums[1] as number))).toBeLessThanOrEqual(25);
  });
});

describe("readingOrder", () => {
  it("weighs a subreddit by its week's requests, and a new one at the median", async () => {
    for (const name of ["busy", "mid", "quiet", "fresh", "aa", "bb", "cc", "dd", "ee", "ff", "gg"]) await addSubreddit(sql, name);
    for (let i = 0; i < 9; i += 1) await post("busy", { phrase: "r/busy" });
    for (let i = 0; i < 4; i += 1) await post("mid", { phrase: "r/mid" });
    await post("quiet", { phrase: "r/quiet" });
    for (let i = 0; i < 20; i += 1) await post("quiet", { phrase: "r/quiet", at: daysAgo(10) });

    const order = await readingOrder(sql, now);
    expect(order).toHaveLength(11);
    // "quiet"'s old posts do not count, so "busy" (9) is first. The second
    // group, one name, takes the second in weight: the new ones weigh the
    // median (4) like "mid", and "aa" comes before "mid" by name. Had a new
    // one weighed 0, "mid" would be there.
    expect(order[0]).toBe("busy");
    expect(order[10]).toBe("aa");
  });
});

describe("subredditStats", () => {
  it("counts the list's week, and ranks the search terms' subreddits outside it by fit posts", async () => {
    await addSubreddit(sql, "Aquariums");
    await post("Aquariums", { phrase: "r/Aquariums", fit: true });
    await post("Aquariums", { phrase: "r/Aquariums", fit: false });
    await post("aquariums", { phrase: "buying advice", fit: true });
    await post("Aquariums", { phrase: "r/Aquariums", fit: true, at: daysAgo(9) });
    await post("woodworking", { phrase: "buying advice", fit: true });
    await post("Woodworking", { phrase: "which should I buy", fit: true });
    await post("woodworking", { phrase: "buying advice", fit: null });
    await post("cars", { phrase: "is it worth buying", fit: false });
    await post("cars", { phrase: "is it worth buying", fit: false });
    await post("cars", { phrase: "is it worth buying", fit: false });
    // A subreddit read is never a candidate, even outside the list.
    await post("oldlist", { phrase: "r/oldlist+other", fit: true });

    const stats = await subredditStats(sql, 7, now);

    expect(stats.listed).toEqual([
      expect.objectContaining({ name: "Aquariums", requests: 3, fit: 2, judged: 3, addedBy: "admin" }),
    ]);
    expect(stats.candidates.map((row) => ({ ...row, name: row.name.toLowerCase() }))).toEqual([
      { name: "woodworking", requests: 3, fit: 2, judged: 2 },
      { name: "cars", requests: 3, fit: 0, judged: 3 },
    ]);
  });
});
