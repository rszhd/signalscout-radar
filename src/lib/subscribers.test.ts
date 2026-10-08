import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "../db/client.ts";
import { createTestDatabase } from "../testing/database.ts";
import { confirm, readByToken, setTags, subscribe, subscriptionsPerIpPerDay, unsubscribe } from "./subscribers.ts";

let sql: Sql;
let drop: () => Promise<void>;

beforeEach(async () => {
  ({ sql, drop } = await createTestDatabase());
});
afterEach(async () => {
  await drop();
});

async function send(email: string, tags: string[], ipHash = "ip") {
  const result = await subscribe(sql, { email, tags, ipHash });
  if (result.status !== "send") throw new Error(`expected send, got ${result.status}`);
  return result;
}

/** As if the last confirmation went out long ago, so another may go. */
const longAgo = () => sql`update subscribers set confirmation_sent_at = now() - interval '1 hour'`;

describe("subscribe and confirm", () => {
  it("changes nothing until the link is clicked", async () => {
    const { token } = await send("A@Example.com ", ["standing-desks"]);
    const before = await readByToken(sql, token);
    expect(before).toMatchObject({ email: "a@example.com", tags: [], pendingTags: ["standing-desks"], confirmedAt: null });

    const after = await confirm(sql, token);
    expect(after?.tags).toEqual(["standing-desks"]);
    expect(after?.pendingTags).toEqual([]);
    expect(after?.confirmedAt).not.toBeNull();
  });

  it("adds tags to a confirmed subscriber only after a second click", async () => {
    const { token } = await send("a@example.com", ["standing-desks"]);
    await confirm(sql, token);
    await longAgo();

    const again = await send("a@example.com", ["standing-desks", "office-chairs"]);
    expect(again).toMatchObject({ adding: true, tags: ["office-chairs"] });
    expect((await readByToken(sql, token))?.tags).toEqual(["standing-desks"]);

    await confirm(sql, token);
    expect((await readByToken(sql, token))?.tags.sort()).toEqual(["office-chairs", "standing-desks"]);
  });

  it("says already when every tag is followed", async () => {
    const { token } = await send("a@example.com", ["standing-desks"]);
    await confirm(sql, token);
    expect((await subscribe(sql, { email: "a@example.com", tags: ["standing-desks"], ipHash: "ip" })).status).toBe(
      "already",
    );
  });

  it("waits before a second confirmation email", async () => {
    await send("a@example.com", ["standing-desks"]);
    await sql`update subscribers set confirmation_sent_at = now()`;
    expect((await subscribe(sql, { email: "a@example.com", tags: ["office-chairs"], ipHash: "ip" })).status).toBe(
      "wait",
    );
  });

  it("limits new addresses per IP per day", async () => {
    for (let i = 0; i < subscriptionsPerIpPerDay; i += 1) await send(`a${i}@example.com`, ["standing-desks"], "same");
    const over = await subscribe(sql, { email: "late@example.com", tags: ["standing-desks"], ipHash: "same" });
    expect(over.status).toBe("refused");
  });

  it("an old confirmation link cannot undo an unsubscribe", async () => {
    const { token } = await send("a@example.com", ["standing-desks"]);
    await confirm(sql, token);
    await unsubscribe(sql, token);
    const after = await confirm(sql, token);
    expect(after?.unsubscribedAt).not.toBeNull();
  });

  it("starts again, with only the new tags, after an unsubscribe", async () => {
    const { token } = await send("a@example.com", ["standing-desks"]);
    await confirm(sql, token);
    await unsubscribe(sql, token);
    await longAgo();

    const again = await send("a@example.com", ["office-chairs"]);
    expect(again.adding).toBe(false);
    const after = await confirm(sql, token);
    expect(after).toMatchObject({ tags: ["office-chairs"], unsubscribedAt: null });
  });
});

describe("setTags", () => {
  it("changes a confirmed subscriber's tags at once, and stops at none", async () => {
    const { token } = await send("a@example.com", ["standing-desks"]);
    await confirm(sql, token);

    expect((await setTags(sql, token, ["office-chairs", "mice"]))?.tags).toEqual(["office-chairs", "mice"]);
    const emptied = await setTags(sql, token, []);
    expect(emptied?.unsubscribedAt).not.toBeNull();
  });

  it("does nothing before the confirmation", async () => {
    const { token } = await send("a@example.com", ["standing-desks"]);
    expect((await setTags(sql, token, ["mice"]))?.tags).toEqual([]);
  });

  it("refuses a token that is not one", async () => {
    expect(await setTags(sql, "short", ["mice"])).toBeNull();
    expect(await readByToken(sql, "x".repeat(30))).toBeNull();
  });
});
