import { describe, expect, it } from "vitest";
import { forumsForTurn } from "../worker/known-forums.ts";
import { groupAddress, groupName, knownGroups } from "./known-groups.ts";
import { placeOf } from "./place.ts";

describe("Facebook groups (US-518)", () => {
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

  it("has no group twice", () => {
    const keys = knownGroups.map((group) => group.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("reads 12 groups from 12 niches a run, and reaches every group in time", () => {
    const seen = new Set<string>();
    for (let turn = 0; turn < 200; turn += 1) {
      const picked = forumsForTurn(turn, 12, knownGroups);
      expect(new Set(picked.map((group) => group.niche)).size).toBe(12);
      for (const group of picked) seen.add(group.key);
    }
    expect(seen.size).toBe(knownGroups.length);
  });
});
