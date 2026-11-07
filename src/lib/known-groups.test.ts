import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "../db/client.ts";
import { createTestDatabase } from "../testing/database.ts";
import { forumsForTurn, knownForums } from "../worker/known-forums.ts";
import {
  groupAddress,
  groupName,
  knownGroups,
  readKnownGroups,
  refreshKnownGroups,
  syncKnownGroups,
} from "./known-groups.ts";
import { placeOf } from "./place.ts";

const forumNiches = new Set(knownForums.map((forum) => forum.niche));

/** A fetch that answers BuyerFinder's list as given, and records the token. */
function answer(status: number, body: unknown) {
  const calls: { url: string; authorization: string | null }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, authorization: new Headers(init?.headers).get("authorization") });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("Facebook groups (US-518, US-547)", () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let seeded: Awaited<ReturnType<typeof readKnownGroups>>;
  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    seeded = await readKnownGroups(sql);
  });
  afterAll(async () => {
    await drop();
  });
  beforeEach(async () => {
    // Every test starts from the seeded list.
    await sql.begin(async (tx) => {
      await tx`delete from radar_known_groups`;
      for (const group of seeded) {
        await tx`insert into radar_known_groups (key, name, niche) values (${group.key}, ${group.name}, ${group.niche})`;
      }
    });
    await refreshKnownGroups(sql, 0);
  });

  it("starts with the old file's 131 groups, in its order, none twice", () => {
    expect(seeded).toHaveLength(131);
    expect(seeded[0]).toEqual({ key: "266274396842958", name: "3D printer", niche: "3D printing" });
    const keys = seeded.map((group) => group.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("shows a post's group by the list's name, never by its key", () => {
    expect(placeOf("facebook", "266274396842958")).toBe("3D printer");
    expect(placeOf("facebook", "ILOVETO3DPRINT")).toBe("I love to 3D Print");
    expect(placeOf("facebook", "not-in-the-list")).toBe("A Facebook group");
    expect(placeOf("facebook", null)).toBe("A Facebook group");
    expect(groupName(undefined)).toBe("A Facebook group");
  });

  it("reads each group by its full address", () => {
    expect(groupAddress("iloveto3dprint")).toBe("https://www.facebook.com/groups/iloveto3dprint/");
  });

  it("reads 12 groups from 12 niches a run, and reaches every group in time", () => {
    const seen = new Set<string>();
    for (let turn = 0; turn < 200; turn += 1) {
      const picked = forumsForTurn(turn, 12, knownGroups());
      expect(new Set(picked.map((group) => group.niche)).size).toBe(12);
      for (const group of picked) seen.add(group.key);
    }
    expect(seen.size).toBe(knownGroups().length);
  });

  it("copies BuyerFinder's list with the token, less the niches Radar has no forum for", async () => {
    const { fetch, calls } = answer(200, {
      groups: [
        { key: "new.coffee", name: " New Coffee ", niche: "coffee" },
        { key: "money.talk", name: "Money Talk", niche: "a niche no forum has" },
        { key: "NEW.COFFEE", name: "Twice", niche: "coffee" },
        { key: "bad/key", name: "Bad", niche: "coffee" },
        { key: "266274396842958", name: "3D printer", niche: "3D printing" },
      ],
    });
    const count = await syncKnownGroups(sql, { url: "https://bf.example/admin/api/groups", token: "t0ken", niches: forumNiches, fetch });

    expect(count).toBe(2);
    expect(calls).toEqual([{ url: "https://bf.example/admin/api/groups", authorization: "Bearer t0ken" }]);
    expect(await readKnownGroups(sql)).toEqual([
      { key: "new.coffee", name: "New Coffee", niche: "coffee" },
      { key: "266274396842958", name: "3D printer", niche: "3D printing" },
    ]);
    await refreshKnownGroups(sql, 0);
    expect(groupName("new.coffee")).toBe("New Coffee");
  });

  it("keeps the table as it was when the read fails or leaves no group", async () => {
    const sync = (status: number, body: unknown) =>
      syncKnownGroups(sql, { url: "https://bf.example/x", token: "t", niches: forumNiches, fetch: answer(status, body).fetch });

    await expect(sync(401, "Password required")).rejects.toThrow("answered 401");
    await expect(sync(200, "<html>")).rejects.toThrow("not a list");
    await expect(sync(200, { groups: [] })).rejects.toThrow("no group in Radar's niches");
    await expect(sync(200, { groups: [{ key: "x", name: "X", niche: "a niche no forum has" }] })).rejects.toThrow(
      "no group in Radar's niches",
    );
    expect(await readKnownGroups(sql)).toEqual(seeded);
  });
});
