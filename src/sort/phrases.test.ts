import { describe, expect, it } from "vitest";
import { inIndianPlace, offersWork, readsLikeRequest } from "./phrases.ts";

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

describe("readsLikeRequest on a forum title (US-511)", () => {
  // Real forum titles, 2026-11-03: a request often has no question mark.
  it.each([
    "Meat slicer recommendations",
    "Recommend Me a RUT (Recreation and Utility Truck)",
    "[WTB] Espro Toroid 12oz pitcher (2008-2014)",
    "O-ring source needed",
    "Mk8/8.5 Subwoofers: Stock HK vs. Mk7 Fender vs. ARS24 vs. RS-A",
    "8\" Powermatic vs Jet 8\" jointer",
    "Upgrading Table Saw and Need Advice",
    "Looking for a budget/starter hand tool set.",
    "Where to buy Spares for Trimbridge Edge Bander",
    "Best sources for L-Carnatine",
    "280 Ackley or short barreled 7 PRC?",
    "anyone using Hercules 2 1/4 hp router in a table for $100",
    "Bosch PBD Anyone?",
    "Need Worksharp WS3000 slotted sandpaper",
  ])("keeps %s", (title) => {
    expect(readsLikeRequest(`${title} Some text with no question.`, title)).toBe(true);
  });

  it.each([
    "2026 SEMA Thread",
    "[FS] Eureka Olympus E",
    "The Best Way to Attach a Torsion-Box Top",
    "Need some humor here.",
    "need to write a book or at least a long story",
    "Interesting BBQ Sauce",
  ])("drops %s", (title) => {
    expect(readsLikeRequest(`${title} Some text with no question.`, title)).toBe(false);
  });

  it.each([
    "Do any of you use this meat grinder? It seems too good a deal.",
    "Just wanna see what other people are using to fuel while riding. Gels, drink mixes?",
    "Has anyone used this solar generator? It is expensive but interesting.",
    "If you had to start over, what are the first 3 knives you'd buy?",
    "What is the best peptide to tighten up loose skin?",
  ])("keeps a body that asks: %s", (text) => {
    expect(readsLikeRequest(text, "A title")).toBe(true);
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

describe("inIndianPlace", () => {
  it.each(["TwentiesIndia", "techIndia", "IndianGamers", "iemlndia", "CarsIndia", "bangalore", "Hyderabad_city", "FitTamil", "AskIndianWomen"])(
    "drops r/%s",
    (name) => expect(inIndianPlace(name)).toBe(true),
  );
  it("drops a cross-post whose link names an Indian subreddit", () => {
    expect(inIndianPlace("OfficeChairs", "https://www.reddit.com/r/ErgonomicIndia/comments/1xfzaps/best_ergo_chair/")).toBe(true);
    expect(inIndianPlace("Monitors", "/r/IndianGaming/comments/1xmq25h/24_inch_fhd_monitor/")).toBe(true);
    expect(inIndianPlace("OfficeChairs", "https://www.reddit.com/r/OfficeChairs/comments/1abc/chair_for_india_trip/")).toBe(false);
  });
  it.each(["Indiana", "indianapolis", "IndianaHoosiers", "SuggestALaptop", "BuyItForLife", "www.smokingmeatforums.com", undefined, null])(
    "keeps %s",
    (name) => expect(inIndianPlace(name)).toBe(false),
  );
});
