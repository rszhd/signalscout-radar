/**
 * An RSS 2.0 feed of requests. Each item links to the original post; the item
 * text ends with one line to SignalScout, tagged as coming from the feed.
 */
import type { RequestRow } from "@/db/queries.ts";
import { signalscoutUrl, siteUrl } from "./links.ts";

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const platformName = { reddit: "Reddit", x: "X" } as const;

export function renderFeed(options: {
  title: string;
  description: string;
  /** The page this feed belongs to, as a path: "/" or "/c/sales-crm". */
  page: string;
  /** The feed's own path. */
  self: string;
  campaign: string;
  rows: readonly RequestRow[];
}): string {
  const pitch = signalscoutUrl("rss", options.campaign);
  const items = options.rows.map((row) => {
    const where = row.channel ? `${platformName[row.platform]} · r/${row.channel}` : platformName[row.platform];
    const body = [
      `<p><b>Wants:</b> ${escape(row.wants)}</p>`,
      `<p>${escape(row.excerpt)}</p>`,
      `<p>${escape(where)} · <a href="${escape(row.url)}">Open the post</a></p>`,
      `<p><a href="${escape(pitch)}">Only the posts that fit your product: SignalScout</a></p>`,
    ].join("");
    return [
      "    <item>",
      `      <title>${escape(row.wants)}</title>`,
      `      <link>${escape(row.url)}</link>`,
      `      <guid isPermaLink="false">radar-${row.id}</guid>`,
      `      <pubDate>${row.postedAt.toUTCString()}</pubDate>`,
      `      <description>${escape(body)}</description>`,
      "    </item>",
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escape(options.title)}</title>`,
    `    <link>${siteUrl}${options.page}</link>`,
    `    <description>${escape(options.description)}</description>`,
    `    <atom:link href="${siteUrl}${options.self}" rel="self" type="application/rss+xml" />`,
    "    <ttl>60</ttl>",
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function feedResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
