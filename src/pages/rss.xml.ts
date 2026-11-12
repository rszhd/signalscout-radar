import type { APIRoute } from "astro";
import { latestRequests } from "@/db/queries.ts";
import { db } from "@/lib/db";
import { feedResponse, renderFeed } from "@/lib/rss";

export const GET: APIRoute = async () =>
  feedResponse(
    renderFeed({
      title: "BuyerFinder Radar: people asking what to buy",
      description: "Public Reddit posts where someone asks which product to buy, and a small shop could answer.",
      page: "/",
      self: "/rss.xml",
      campaign: "home",
      rows: await latestRequests(db(), 50),
    }),
  );
