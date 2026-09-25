/**
 * US-429: do hiring subreddits and service phrases give business-service
 * requests, and at what price? Every item is saved for reading by hand.
 *
 *   node --env-file=<a .env with provider and AI keys> scripts/measure-services.ts
 *
 * Spends real money and stops before $0.50. Authors are never written.
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
import { categoryBySlug } from "../src/sort/categories.ts";
import { createSorter } from "../src/sort/categorize.ts";
import { readsLikeRequest } from "../src/sort/phrases.ts";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const ceilingMicros = 500_000;
const registry = createSourceRegistry({ definitions: builtInSources, runtime: createSourceRuntime() });
const reddit = registry.get("reddit", "scrapecreators");
const x = registry.get("x", "socialdata");
const sort = createSorter(aiConfigFromEnvironment(aiEnvSchema.parse(process.env)));

const subreddits = ["forhire", "hiring", "slavelabour", "HireaWriter", "DesignJobs", "freelance_forhire", "smallbusiness", "Entrepreneur", "startups", "shopify", "SEO", "webdev"];
const phrases = ["looking to hire", "need a web developer", "recommend an agency", "looking for a freelancer", "need someone to build", "hire a virtual assistant"];

interface Item { input: string; filtered: boolean; url: string; title?: string; text: string; model: { isRequest: boolean; category: string; wants: string } | null }
let providerMicros = 0;
let modelMicros = 0;
const spent = () => providerMicros + modelMicros;
const items: Item[] = [];
const rows: string[] = [];

async function sortAll(input: string, posts: readonly CandidatePost[], filter: boolean, cost: number) {
  let requests = 0, services = 0, sorted = 0;
  const kept = posts.filter((p) => !filter || readsLikeRequest(`${p.title ?? ""} ${p.text}`));
  for (let i = 0; i < kept.length; i += 6) {
    if (spent() > ceilingMicros - 20_000) break;
    const batch = kept.slice(i, i + 6);
    const outs = await Promise.all(batch.map((p) => sort({ platform: input.startsWith("x:") ? "x" : "reddit", channel: p.channel, title: p.title, text: p.text })));
    for (const [n, o] of outs.entries()) {
      const p = batch[n] as CandidatePost;
      modelMicros += o.call.estimatedCostMicros ?? 2000;
      sorted++;
      const v = o.status === "sorted" ? o.verdict : null;
      const isRequest = Boolean(v?.isRequest && v.category !== "other");
      if (isRequest) requests++;
      if (isRequest && categoryBySlug(v?.category ?? "")?.kind === "services") services++;
      items.push({ input, filtered: filter, url: p.url, title: p.title, text: p.text.slice(0, 500), model: v });
    }
  }
  rows.push(`${input}\t${posts.length} posts\t${sorted} sorted\t${requests} requests (${services} services)\t$${(cost / 1e6).toFixed(4)} provider`);
}

for (const sub of subreddits) {
  if (spent() > ceilingMicros - 50_000) break;
  try {
    const r = await reddit.search({ query: { queries: [], channels: [sub] }, credentials: { apiKey: process.env.SCRAPECREATORS_API_KEY! }, limit: 25 });
    providerMicros += r.unitsConsumed * 1880;
    await sortAll(`r/${sub}`, r.posts, false, r.unitsConsumed * 1880);
  } catch (error) { rows.push(`r/${sub}\tFAILED ${(error as Error).message.slice(0, 60)}`); }
}
for (const phrase of phrases) {
  if (spent() > ceilingMicros - 50_000) break;
  try {
    const r = await reddit.search({ query: { queries: [phrase], channels: [], since: new Date(Date.now() - 7 * 864e5) }, credentials: { apiKey: process.env.SCRAPECREATORS_API_KEY! }, limit: 25 });
    providerMicros += r.unitsConsumed * 1880;
    await sortAll(`reddit:${phrase}`, r.posts, true, r.unitsConsumed * 1880);
  } catch (error) { rows.push(`reddit:${phrase}\tFAILED ${(error as Error).message.slice(0, 60)}`); }
  try {
    const r = await x.search({ query: { queries: [phrase], channels: [], since: new Date(Date.now() - 7 * 864e5) }, credentials: { apiKey: process.env.SOCIALDATA_API_KEY! }, limit: 20 });
    providerMicros += r.unitsConsumed * 200;
    await sortAll(`x:${phrase}`, r.posts, true, r.unitsConsumed * 200);
  } catch (error) { rows.push(`x:${phrase}\tFAILED ${(error as Error).message.slice(0, 60)}`); }
}

mkdirSync("fixtures/us-429", { recursive: true });
writeFileSync("fixtures/us-429/items.json", `${JSON.stringify(items, null, 2)}\n`);
console.log(rows.join("\n"));
console.log(`total $${(spent() / 1e6).toFixed(4)} (providers $${(providerMicros / 1e6).toFixed(4)}, model $${(modelMicros / 1e6).toFixed(4)}), engine prices`);
