import { describe, expect, it } from "vitest";
import { forumsForTurn, type KnownForum, knownForums } from "./known-forums.ts";

const forum = (niche: string, host: string): KnownForum => ({ host, name: host, niche, program: null, feed: `https://${host}/feed` });

describe("forumsForTurn (US-511)", () => {
  it("reads different niches in one run, and each niche's next forum on its next turn", () => {
    const forums = [forum("a", "a1"), forum("a", "a2"), forum("b", "b1"), forum("c", "c1"), forum("c", "c2"), forum("c", "c3")];
    const hosts = (turn: number) => forumsForTurn(turn, 2, forums).map((f) => f.host);
    expect(hosts(0)).toEqual(["a1", "b1"]);
    expect(hosts(1)).toEqual(["c1", "a2"]);
    expect(hosts(2)).toEqual(["b1", "c2"]);
    expect(hosts(3)).toEqual(["a1", "b1"]);
  });

  it("gives every niche the same number of reads over a day's runs", () => {
    const niches = new Set(knownForums.map((f) => f.niche));
    const reads = new Map<string, number>();
    for (let turn = 0; turn < niches.size; turn += 1) {
      const picked = forumsForTurn(turn, 12);
      expect(new Set(picked.map((f) => f.niche)).size).toBe(12);
      for (const f of picked) reads.set(f.niche, (reads.get(f.niche) ?? 0) + 1);
    }
    expect(new Set(reads.values())).toEqual(new Set([12]));
  });
});
