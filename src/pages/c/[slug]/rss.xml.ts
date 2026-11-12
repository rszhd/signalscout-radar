import type { APIRoute } from "astro";
import { requestsIn } from "@/db/queries.ts";
import { db } from "@/lib/db";
import { feedResponse, renderFeed } from "@/lib/rss";
import { categoryBySlug } from "@/sort/categories.ts";

export const GET: APIRoute = async ({ params }) => {
  const category = categoryBySlug(params.slug ?? "");
  if (!category) return new Response("Not found", { status: 404 });
  return feedResponse(
    renderFeed({
      title: `People asking for ${category.name} | BuyerFinder Radar`,
      description: `Public Reddit posts where someone asks which ${category.name.toLowerCase()} product to buy, and a small shop could answer.`,
      page: `/c/${category.slug}`,
      self: `/c/${category.slug}/rss.xml`,
      campaign: category.slug,
      rows: await requestsIn(db(), category.slug, 50),
    }),
  );
};
