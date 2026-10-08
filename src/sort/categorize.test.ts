import { describe, expect, it } from "vitest";
import type { TagRow } from "../db/tags.ts";
import { buildSystemPrompt, tagging, type Verdict } from "./categorize.ts";

const known = new Map<string, TagRow>(
  (
    [
      { slug: "standing-desks", name: "Standing desks", category: "home-office", kind: "product" },
      { slug: "office-chairs", name: "Office chairs", category: "home-office", kind: "product" },
      { slug: "alt-steelcase", name: "Alternatives to Steelcase", category: "home-office", kind: "alt" },
    ] as const
  ).map((tag) => [tag.slug, tag]),
);

const verdict = (over: Partial<Verdict>): Verdict => ({
  isRequest: true,
  category: "home-office",
  wants: "A chair",
  tags: [],
  newTag: "",
  leaving: "",
  ...over,
});

describe("tagging", () => {
  it("keeps listed slugs and drops the ones the list does not know", () => {
    expect(tagging(verdict({ tags: ["office-chairs", "Standing-Desks ", "chairz"] }), known)).toEqual({
      tags: ["office-chairs", "standing-desks"],
      proposals: [],
    });
  });

  it("proposes a new tag and the product left, hidden, under the post's category", () => {
    const result = tagging(verdict({ newTag: "Footrests", leaving: "Herman Miller" }), known);
    expect(result.tags).toEqual(["footrests", "alt-herman-miller"]);
    expect(result.proposals).toEqual([
      { slug: "footrests", name: "Footrests", category: "home-office", kind: "product" },
      { slug: "alt-herman-miller", name: "Alternatives to Herman Miller", category: "home-office", kind: "alt" },
    ]);
  });

  it("reuses a tag that already has the slug", () => {
    const result = tagging(verdict({ newTag: "Standing desks", leaving: "Steelcase" }), known);
    expect(result).toEqual({ tags: ["standing-desks", "alt-steelcase"], proposals: [] });
  });
});

describe("buildSystemPrompt", () => {
  it("lists the product tags under their category, not the alternatives", () => {
    const prompt = buildSystemPrompt([...known.values()]);
    expect(prompt).toContain("- home-office: standing-desks (Standing desks), office-chairs (Office chairs)");
    expect(prompt).not.toContain("alt-steelcase");
  });
});
