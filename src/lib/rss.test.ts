import { describe, expect, it } from "vitest";
import { renderFeed } from "./rss.ts";

const row = {
  id: "7",
  platform: "reddit" as const,
  url: "https://www.reddit.com/r/CRM/comments/abc/",
  channel: "CRM",
  title: null,
  excerpt: "We track clients in a spreadsheet & it is falling apart <help>",
  wants: "A simple CRM with follow-up reminders",
  category: "sales-crm",
  postedAt: new Date("2026-09-26T01:00:00Z"),
};

describe("renderFeed", () => {
  const xml = renderFeed({
    title: "People asking for Sales & CRM",
    description: "d",
    page: "/c/sales-crm",
    self: "/c/sales-crm/rss.xml",
    campaign: "sales-crm",
    rows: [row],
  });

  it("escapes what the post says", () => {
    expect(xml).toContain("spreadsheet &amp;amp; it is falling apart &amp;lt;help&amp;gt;");
    expect(xml).toContain("<title>People asking for Sales &amp; CRM</title>");
  });

  it("links the item to the post and tags the pitch as coming from the feed", () => {
    expect(xml).toContain("<link>https://www.reddit.com/r/CRM/comments/abc/</link>");
    expect(xml).toContain("utm_medium=rss&amp;amp;utm_campaign=sales-crm");
  });
});
