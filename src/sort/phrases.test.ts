import { describe, expect, it } from "vitest";
import { offersWork, readsLikeRequest } from "./phrases.ts";

describe("readsLikeRequest", () => {
  it.each([
    "Is there an app that tracks my invoices?",
    "Is there a tool for merging PDFs on Mac?",
    "Any alternatives to Notion for a small team?",
    "What software do you use for bookkeeping?",
    "What app do you guys use for habit tracking?",
    "Can anyone recommend a CRM?",
    "Any good tools for screen recording?",
    "[Hiring] Logo for a small bakery, $150",
    "Looking to hire a Shopify developer for a store migration",
    "We need someone to build a simple booking site",
    "Can anyone recommend an agency for Google Ads",
  ])("keeps %s", (text) => {
    expect(readsLikeRequest(text)).toBe(true);
  });

  it.each([
    "Great game last night, what a finish.",
    "I recommend this to everyone.",
    "Is there anyone at the conference tomorrow?",
    "[For Hire] Senior designer, portfolio in bio",
  ])("drops %s", (text) => {
    expect(readsLikeRequest(text)).toBe(false);
  });
});

describe("offersWork", () => {
  it.each(["[For Hire] Web designer", "[FOR HIRE] Card Artist", "[Offer] Logo design", "(Hire Me) Copywriter"])(
    "sees an offer in %s",
    (title) => {
      expect(offersWork(title, "")).toBe(true);
    },
  );

  it.each(["[Hiring] Logo designer", "[Task] Edit a video", "Looking for a ghostwriter"])(
    "sees a request in %s",
    (title) => {
      expect(offersWork(title, "")).toBe(false);
    },
  );
});
