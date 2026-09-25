import type { APIRoute } from "astro";
import { latestRequests } from "@/db/queries.ts";
import { db } from "@/lib/db";
import { feedResponse, renderFeed } from "@/lib/rss";

export const GET: APIRoute = async () =>
  feedResponse(
    renderFeed({
      title: "SignalScout Radar: people asking what to buy",
      description: "Public posts from Reddit and X where someone asks which product to use or buy.",
      page: "/",
      self: "/rss.xml",
      campaign: "home",
      rows: await latestRequests(db(), 50),
    }),
  );
