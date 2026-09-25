/**
 * US-413: run generic questions once on each platform and save what comes
 * back, so a person can mark each post by hand.
 *
 *   node --env-file=<a .env with provider keys> scripts/measure.ts
 *
 * Spends real money. It stops before a call that would pass `ceilingMicros`.
 * Authors are never written: a fixture holds the text, the link and the time.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  builtInSources,
  type CandidatePost,
  createSourceRegistry,
  createSourceRuntime,
} from "@signalscout/engine";

const ceilingMicros = 1_000_000; // $1 for the whole run
const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const phrases = [
  "can anyone recommend",
  "what do you use",
  "which should I buy",
  "looking for recommendations",
  "best alternative to",
  "any suggestions for",
  "is it worth buying",
  "anyone know a good",
];

/**
 * One provider per platform: the cheapest the cloud holds a key for. On the
 * three video platforms the request is a comment, so `threads` videos per
 * phrase have their comments read, and fewer phrases are run.
 */
const plan = [
  { platform: "reddit", provider: "scrapecreators", key: "SCRAPECREATORS_API_KEY", phrases, threads: 0 },
  { platform: "x", provider: "socialdata", key: "SOCIALDATA_API_KEY", phrases, threads: 0 },
  { platform: "linkedin", provider: "harvestapi", key: "HARVESTAPI_API_KEY", phrases, threads: 0 },
  { platform: "youtube", provider: "scrapecreators", key: "SCRAPECREATORS_API_KEY", phrases: phrases.slice(0, 4), threads: 2 },
  { platform: "tiktok", provider: "scrapecreators", key: "SCRAPECREATORS_API_KEY", phrases: phrases.slice(0, 4), threads: 2 },
  { platform: "instagram", provider: "socialcrawl", key: "SOCIALCRAWL_API_KEY", phrases: phrases.slice(0, 3), threads: 1 },
] as const;

const registry = createSourceRegistry({ definitions: builtInSources, runtime: createSourceRuntime() });

function priceOf(platform: string, provider: string) {
  const definition = builtInSources.find(
    (d: { platform: { id: string }; provider: { id: string } }) =>
      d.platform.id === platform && d.provider.id === provider,
  );
  if (!definition) throw new Error(`no connector ${platform}/${provider}`);
  return {
    post: definition.pricePerUnitMicros as number,
    reply: (definition.replyPricePerUnitMicros ?? definition.pricePerUnitMicros) as number,
  };
}

let spentMicros = 0;
function spend(units: number, unitMicros: number) {
  spentMicros += units * unitMicros;
}
function roomFor(unitMicros: number) {
  return spentMicros + unitMicros * 5 < ceilingMicros;
}

interface Item {
  phrase: string;
  kind: "post" | "comment";
  url: string;
  channel?: string;
  title?: string;
  under?: string;
  text: string;
  postedAt: string;
  /** Filled in by hand: does this ask for a product? */
  isRequest: null;
}

const outDir = "fixtures/us-413";
mkdirSync(outDir, { recursive: true });
const summary: Record<string, unknown>[] = [];

for (const step of plan) {
  const apiKey = process.env[step.key];
  if (!apiKey) {
    console.log(`${step.platform}: skipped, ${step.key} is not set`);
    continue;
  }
  const source = registry.get(step.platform, step.provider);
  const price = priceOf(step.platform, step.provider);
  const credentials = { apiKey };
  const items: Item[] = [];
  const perPhrase: Record<string, { posts: number; comments: number; units: number }> = {};
  const started = spentMicros;

  for (const phrase of step.phrases) {
    if (!roomFor(price.post)) break;
    const tally = { posts: 0, comments: 0, units: 0 };
    perPhrase[phrase] = tally;
    let posts: readonly CandidatePost[] = [];
    try {
      const result = await source.search({
        query: {
          queries: [phrase],
          channels: [],
          since: step.threads === 0 ? since : undefined,
        },
        credentials,
        limit: 25,
      });
      spend(result.unitsConsumed, price.post);
      tally.units += result.unitsConsumed;
      posts = result.posts;
    } catch (error) {
      console.log(`${step.platform} "${phrase}": search failed: ${(error as Error).message}`);
      continue;
    }

    if (step.threads === 0) {
      for (const post of posts) {
        items.push({
          phrase,
          kind: "post",
          url: post.url,
          channel: post.channel,
          title: post.title,
          text: post.text.slice(0, 600),
          postedAt: post.postedAt.toISOString(),
          isRequest: null,
        });
      }
      tally.posts = posts.length;
      continue;
    }

    // A video platform: the lead is in the comments.
    tally.posts = posts.length;
    for (const post of posts.slice(0, step.threads)) {
      if (!roomFor(price.reply) || !source.fetchReplies) break;
      try {
        const replies = await source.fetchReplies({
          postUrl: post.url,
          postExternalId: post.externalId,
          credentials,
        });
        spend(replies.unitsConsumed, price.reply);
        tally.units += replies.unitsConsumed;
        for (const reply of replies.replies) {
          items.push({
            phrase,
            kind: "comment",
            url: reply.url ?? post.url,
            under: (post.title ?? post.text).slice(0, 120),
            text: reply.text.slice(0, 600),
            postedAt: reply.postedAt.toISOString(),
            isRequest: null,
          });
          tally.comments += 1;
        }
      } catch (error) {
        console.log(`${step.platform} "${phrase}": replies failed: ${(error as Error).message}`);
      }
    }
  }

  const costMicros = spentMicros - started;
  writeFileSync(`${outDir}/${step.platform}.json`, `${JSON.stringify(items, null, 2)}\n`);
  summary.push({ platform: step.platform, provider: step.provider, items: items.length, costUsd: costMicros / 1e6, perPhrase });
  console.log(`${step.platform}: ${items.length} items, $${(costMicros / 1e6).toFixed(4)}`);
}

writeFileSync(`${outDir}/summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`total: $${(spentMicros / 1e6).toFixed(4)} (estimate from connector prices)`);
