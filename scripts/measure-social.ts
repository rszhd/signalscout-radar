/**
 * Can YouTube, TikTok and LinkedIn give product requests when asked the right
 * way? US-413 asked them a generic question and they gave almost nothing.
 * This asks YouTube and TikTok by topic and reads the comments under the
 * videos, and asks LinkedIn with a request tied to a category.
 *
 *   node --env-file=<a .env with provider and AI keys> scripts/measure-social.ts
 *
 * Spends real money and stops before $1. Authors are never written.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  aiConfigFromEnvironment,
  aiEnvSchema,
  builtInSources,
  type CandidatePost,
  createSourceRegistry,
  createSourceRuntime,
} from "@signalscout/engine";
import { createSorter } from "../src/sort/categorize.ts";
import { readsLikeRequest } from "../src/sort/phrases.ts";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const ceilingMicros = 1_000_000;
const registry = createSourceRegistry({ definitions: builtInSources, runtime: createSourceRuntime() });
const sort = createSorter(aiConfigFromEnvironment(aiEnvSchema.parse(process.env)));

const plan = [
  {
    platform: "youtube",
    provider: "scrapecreators",
    key: "SCRAPECREATORS_API_KEY",
    videos: 3,
    queries: [
      "best budget laptop 2026",
      "notion vs obsidian",
      "best noise cancelling headphones",
      "best crm for small business",
      "best note taking app",
      "best project management software",
    ],
  },
  {
    platform: "tiktok",
    provider: "scrapecreators",
    key: "SCRAPECREATORS_API_KEY",
    videos: 3,
    queries: ["best productivity apps", "tech gadgets under 50", "iphone apps you need", "desk setup", "ai tools for work"],
  },
  {
    platform: "linkedin",
    provider: "harvestapi",
    key: "HARVESTAPI_API_KEY",
    videos: 0,
    queries: [
      "recommendations for a CRM",
      "which tool do you use for",
      "can anyone recommend a tool",
      "looking for software recommendations",
      "what CRM do you use",
      "any recommendations for a platform",
      "recommend an app for",
      "what software do you use for",
    ],
  },
] as const;

function priceOf(platform: string, provider: string) {
  const d = builtInSources.find(
    (s: { platform: { id: string }; provider: { id: string } }) => s.platform.id === platform && s.provider.id === provider,
  );
  if (!d) throw new Error(`no connector ${platform}/${provider}`);
  return { post: d.pricePerUnitMicros as number, reply: (d.replyPricePerUnitMicros ?? d.pricePerUnitMicros) as number };
}

interface Item {
  query: string;
  kind: "post" | "comment";
  under?: string;
  url: string;
  text: string;
  passesFilter: boolean;
  model: { asksForProduct: boolean; category: string; wants: string } | null;
}

let providerMicros = 0;
let modelMicros = 0;
const spent = () => providerMicros + modelMicros;
const summary: string[] = [];
mkdirSync("fixtures/social", { recursive: true });

for (const step of plan) {
  const apiKey = process.env[step.key];
  if (!apiKey) {
    summary.push(`${step.platform}: skipped, ${step.key} not set`);
    continue;
  }
  const source = registry.get(step.platform, step.provider);
  const price = priceOf(step.platform, step.provider);
  const items: Item[] = [];
  const perQuery: string[] = [];
  const before = spent();

  for (const query of step.queries) {
    if (spent() > ceilingMicros - 50_000) break;
    const texts: Omit<Item, "passesFilter" | "model">[] = [];
    let posts: readonly CandidatePost[] = [];
    try {
      const result = await source.search({
        query: {
          queries: [query],
          channels: [],
          since: step.videos === 0 ? new Date(Date.now() - 7 * 24 * 3600_000) : undefined,
        },
        credentials: { apiKey },
        limit: step.videos === 0 ? 25 : 10,
      });
      providerMicros += result.unitsConsumed * price.post;
      posts = result.posts;
    } catch (error) {
      perQuery.push(`  "${query}": search failed: ${(error as Error).message.slice(0, 80)}`);
      continue;
    }

    if (step.videos === 0) {
      for (const post of posts) texts.push({ query, kind: "post", url: post.url, text: `${post.title ?? ""} ${post.text}`.trim() });
    } else {
      for (const video of posts.slice(0, step.videos)) {
        if (!source.fetchReplies) break;
        try {
          const replies = await source.fetchReplies({ postUrl: video.url, postExternalId: video.externalId, credentials: { apiKey } });
          providerMicros += replies.unitsConsumed * price.reply;
          const under = (video.title ?? video.text).replace(/\s+/g, " ").slice(0, 100);
          for (const reply of replies.replies) texts.push({ query, kind: "comment", under, url: reply.url ?? video.url, text: reply.text });
        } catch (error) {
          perQuery.push(`  "${query}": comments failed: ${(error as Error).message.slice(0, 80)}`);
        }
      }
    }

    let yes = 0;
    let filterYes = 0;
    for (let i = 0; i < texts.length; i += 6) {
      if (spent() > ceilingMicros - 20_000) break;
      const batch = texts.slice(i, i + 6);
      const outcomes = await Promise.all(
        batch.map((t) =>
          sort({ platform: "reddit", title: t.under ? `Comment under the video "${t.under}"` : undefined, text: t.text }),
        ),
      );
      for (const [n, outcome] of outcomes.entries()) {
        const t = batch[n] as Omit<Item, "passesFilter" | "model">;
        modelMicros += outcome.call.estimatedCostMicros ?? 2000;
        const model = outcome.status === "sorted" ? outcome.verdict : null;
        const passesFilter = readsLikeRequest(t.text);
        const request = Boolean(model?.asksForProduct && model.category !== "other");
        if (request) yes += 1;
        if (request && passesFilter) filterYes += 1;
        items.push({ ...t, text: t.text.slice(0, 600), passesFilter, model });
      }
    }
    perQuery.push(`  "${query}": ${posts.length} results, ${texts.length} items, ${yes} requests (${filterYes} pass the text filter)`);
  }

  writeFileSync(`fixtures/social/${step.platform}.json`, `${JSON.stringify(items, null, 2)}\n`);
  const cost = (spent() - before) / 1e6;
  const requests = items.filter((i) => i.model?.asksForProduct && i.model.category !== "other").length;
  summary.push(
    `${step.platform}: ${items.length} items, ${requests} requests by the model, $${cost.toFixed(4)}` +
      (requests ? `, $${(cost / requests).toFixed(4)} per request` : ""),
    ...perQuery,
  );
}

console.log(summary.join("\n"));
console.log(`total $${(spent() / 1e6).toFixed(4)} (providers $${(providerMicros / 1e6).toFixed(4)}, model $${(modelMicros / 1e6).toFixed(4)})`);
