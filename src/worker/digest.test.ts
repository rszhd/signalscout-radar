import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "../db/client.ts";
import { syncListedTags } from "../db/tags.ts";
import type { Message } from "../lib/mail.ts";
import { confirm, setTags, subscribe, unsubscribe } from "../lib/subscribers.ts";
import { createTestDatabase } from "../testing/database.ts";
import { sendDigests, windowEnd } from "./digest.ts";

let sql: Sql;
let drop: () => Promise<void>;
let sent: Message[];
const send = async (message: Message) => {
  sent.push(message);
};

beforeEach(async () => {
  ({ sql, drop } = await createTestDatabase());
  await syncListedTags(sql);
  sent = [];
  nextId = 0;
});
afterEach(async () => {
  await drop();
});

let nextId = 0;
async function request(tags: string[], foundAt: Date, category = "home-office") {
  nextId += 1;
  await sql`
    insert into requests (platform, external_id, url, channel, excerpt, wants, category, posted_at, found_at, tags)
    values ('reddit', ${`p${nextId}`}, ${`https://reddit.com/p${nextId}`}, 'desks', 'Which desk for a small room?',
            ${`A desk ${nextId}`}, ${category}, ${foundAt}, ${foundAt}, ${tags})`;
}

/** A confirmed subscriber, confirmed at `at`. */
async function subscriber(email: string, tags: string[], at: Date) {
  const result = await subscribe(sql, { email, tags, ipHash: "ip" });
  if (result.status !== "send") throw new Error(result.status);
  await confirm(sql, result.token);
  await sql`update subscribers set confirmed_at = ${at} where token = ${result.token}`;
  return result.token;
}

const day1 = new Date("2026-10-08T06:00:00Z");
const day2At8 = new Date("2026-10-09T08:05:00Z");

describe("windowEnd", () => {
  it("is today's 08:00 UTC once it has passed, and nothing before", () => {
    expect(windowEnd(new Date("2026-10-09T07:59:00Z"))).toBeNull();
    expect(windowEnd(new Date("2026-10-09T08:00:00Z"))?.toISOString()).toBe("2026-10-09T08:00:00.000Z");
    expect(windowEnd(new Date("2026-10-09T23:00:00Z"))?.toISOString()).toBe("2026-10-09T08:00:00.000Z");
  });
});

describe("sendDigests", () => {
  it("sends the posts under the subscriber's tags, and only those", async () => {
    const token = await subscriber("a@example.com", ["standing-desks"], day1);
    await request(["standing-desks"], new Date("2026-10-08T20:00:00Z"));
    await request(["office-chairs"], new Date("2026-10-08T21:00:00Z"));

    const result = await sendDigests(sql, send, "https://radar.example", day2At8);

    expect(result).toEqual({ sent: 1, empty: 0, failed: 0 });
    expect(sent).toHaveLength(1);
    const [email] = sent;
    expect(email?.to).toBe("a@example.com");
    expect(email?.subject).toBe("1 person is asking for Standing desks");
    expect(email?.text).toContain("Wants: A desk 1");
    expect(email?.text).not.toContain("A desk 2");
    expect(email?.unsubscribeUrl).toBe(`https://radar.example/unsubscribe/${token}`);
    expect(email?.text).toContain(`https://radar.example/subscription/${token}`);
  });

  it("waits for 08:00 UTC, then sends once a day", async () => {
    await subscriber("a@example.com", ["standing-desks"], day1);
    await request(["standing-desks"], new Date("2026-10-08T20:00:00Z"));

    await sendDigests(sql, send, "https://radar.example", new Date("2026-10-09T07:00:00Z"));
    expect(sent).toHaveLength(0);

    await sendDigests(sql, send, "https://radar.example", day2At8);
    await request(["standing-desks"], new Date("2026-10-09T09:00:00Z"));
    await sendDigests(sql, send, "https://radar.example", new Date("2026-10-09T10:00:00Z"));
    expect(sent).toHaveLength(1);

    // The 09:00 post is in the next day's email, not lost and not repeated.
    await sendDigests(sql, send, "https://radar.example", new Date("2026-10-10T08:00:00Z"));
    expect(sent).toHaveLength(2);
    expect(sent[1]?.text).toContain("A desk 2");
    expect(sent[1]?.text).not.toContain("A desk 1");
  });

  it("sends nothing on a day with no posts, and still closes the day", async () => {
    await subscriber("a@example.com", ["standing-desks"], day1);
    const first = await sendDigests(sql, send, "https://radar.example", day2At8);
    expect(first).toEqual({ sent: 0, empty: 1, failed: 0 });

    await request(["standing-desks"], new Date("2026-10-09T09:00:00Z"));
    await sendDigests(sql, send, "https://radar.example", new Date("2026-10-09T10:00:00Z"));
    expect(sent).toHaveLength(0);
  });

  it("reaches back a day before the confirmation in the first email", async () => {
    await subscriber("a@example.com", ["standing-desks"], day1);
    await request(["standing-desks"], new Date("2026-10-07T08:00:00Z"));
    await request(["standing-desks"], new Date("2026-10-05T08:00:00Z"));

    await sendDigests(sql, send, "https://radar.example", day2At8);
    expect(sent[0]?.text).toContain("A desk 1");
    expect(sent[0]?.text).not.toContain("A desk 2");
  });

  it("skips anyone unconfirmed, stopped, or with no tags left", async () => {
    await subscribe(sql, { email: "pending@example.com", tags: ["standing-desks"], ipHash: "ip" });
    const stopped = await subscriber("stopped@example.com", ["standing-desks"], day1);
    await unsubscribe(sql, stopped);
    const emptied = await subscriber("emptied@example.com", ["standing-desks"], day1);
    await setTags(sql, emptied, []);
    await request(["standing-desks"], new Date("2026-10-08T20:00:00Z"));

    await sendDigests(sql, send, "https://radar.example", day2At8);
    expect(sent).toHaveLength(0);
  });

  it("leaves out removed posts and categories no longer offered", async () => {
    await subscriber("a@example.com", ["standing-desks"], day1);
    await request(["standing-desks"], new Date("2026-10-08T20:00:00Z"));
    await sql`update requests set removed_at = now()`;
    await request(["standing-desks"], new Date("2026-10-08T21:00:00Z"), "retired-category");

    await sendDigests(sql, send, "https://radar.example", day2At8);
    expect(sent).toHaveLength(0);
  });

  it("keeps the day open when the mail server fails, and sends on the next run", async () => {
    await subscriber("a@example.com", ["standing-desks"], day1);
    await request(["standing-desks"], new Date("2026-10-08T20:00:00Z"));

    const failing = async () => {
      throw new Error("refused");
    };
    const first = await sendDigests(sql, failing, "https://radar.example", day2At8);
    expect(first.failed).toBe(1);

    await sendDigests(sql, send, "https://radar.example", new Date("2026-10-09T09:00:00Z"));
    expect(sent).toHaveLength(1);
  });

  it("caps the posts and counts the rest", async () => {
    await subscriber("a@example.com", ["standing-desks"], day1);
    for (let i = 0; i < 32; i += 1) await request(["standing-desks"], new Date(day1.getTime() + i * 60_000));

    await sendDigests(sql, send, "https://radar.example", day2At8);
    expect(sent[0]?.subject).toBe("32 people are asking for Standing desks");
    expect(sent[0]?.text).toContain("And 2 more.");
  });
});
