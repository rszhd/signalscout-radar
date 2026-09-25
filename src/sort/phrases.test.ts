import { describe, expect, it } from "vitest";
import { readsLikeRequest } from "./phrases.ts";

describe("readsLikeRequest", () => {
  it.each([
    "Is there an app that tracks my invoices?",
    "Is there a tool for merging PDFs on Mac?",
    "Any alternatives to Notion for a small team?",
    "What software do you use for bookkeeping?",
    "What app do you guys use for habit tracking?",
    "Can anyone recommend a CRM?",
    "Any good tools for screen recording?",
  ])("keeps %s", (text) => {
    expect(readsLikeRequest(text)).toBe(true);
  });

  it.each([
    "Great game last night, what a finish.",
    "I recommend this to everyone.",
    "Is there anyone at the conference tomorrow?",
  ])("drops %s", (text) => {
    expect(readsLikeRequest(text)).toBe(false);
  });
});
