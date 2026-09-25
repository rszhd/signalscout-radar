/**
 * One run: search, drop what was seen, filter for free, sort what is left,
 * keep the requests. US-415.
 *
 * **The cap is correctness, not a feature.** The cloud pays for every call
 * with its instance keys, and a generic question has no natural limit: one X
 * phrase fills a page of twenty posts in minutes (US-413). So before every
 * paid call the run asks whether that call, at its dearest, still fits — in
 * this run's share of the day and in the day. The day's spend is read from
 * `runs`, so a restart cannot reset it, and the run's row is updated after
 * every call, so a crash cannot hide what it spent.
 */
import type { CandidatePost, ModelCall, SocialSource } from "@signalscout/engine";
import type { Sql } from "../db/client.ts";
import { alreadySeen, forgetOld, markSeen, saveRequest, spentToday } from "../db/queries.ts";
import type { PostToSort, SortOutcome } from "../sort/categorize.ts";
import { readsLikeRequest } from "../sort/phrases.ts";

export interface SearchPlan {
  readonly platform: "reddit" | "x";
  readonly source: SocialSource;
  readonly apiKey: string;
  readonly phrases: readonly string[];
  /** Pages per phrase per run, at most. */
  readonly maxPages: number;
  /** Posts asked for per page. */
  readonly limit: number;
  /** The dearest one search call can cost, in micro-dollars. */
  readonly worstSearchMicros: number;
  /** What one billed unit costs, in micro-dollars. */
  readonly unitMicros: number;
}

export interface RunOptions {
  readonly sql: Sql;
  readonly plans: readonly SearchPlan[];
  readonly sort: (post: PostToSort) => Promise<SortOutcome>;
  readonly dailyCapMicros: number;
  /** Runs per UTC day. The day's remainder is shared by the runs still to come. */
  readonly runsPerDay: number;
  /** The dearest one model call can cost, in micro-dollars. */
  readonly worstSortMicros: number;
  /** How far back a search looks. Overlap is fine: `seen_posts` removes it. */
  readonly lookBackMs: number;
  readonly now?: () => Date;
  readonly log?: (line: string) => void;
}

export interface RunResult {
  readonly outcome: "done" | "budget";
  readonly providerMicros: number;
  readonly modelMicros: number;
  readonly fetched: number;
  readonly filtered: number;
  readonly sorted: number;
  readonly kept: number;
  /** Searches that failed and were skipped. */
  readonly errors: number;
}

const excerptLength = 280;

/**
 * The text a page may show. No handle survives, because the page promises no
 * names: a reply on X opens with the people it answers, and a post may name
 * others inside it. X also sends HTML entities and t.co links.
 */
export function cleanText(text: string): string {
  return text
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .replace(/^(\s*@\w+)+/, "")
    .replace(/(^|[^\w])@\w+/g, "$1someone")
    .replace(/(^|\s)u\/[\w-]+/g, "$1someone")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptOf(text: string): string {
  const flat = cleanText(text);
  return flat.length <= excerptLength ? flat : `${flat.slice(0, excerptLength - 1).trimEnd()}…`;
}

function modelMicros(call: ModelCall): number {
  // An unpriced model reports nothing. Count the worst case rather than zero,
  // so a missing price can only stop a run early, never let it run on.
  return call.estimatedCostMicros ?? Number.NaN;
}

export async function run(options: RunOptions): Promise<RunResult> {
  const { sql, plans, sort, dailyCapMicros, runsPerDay, worstSortMicros } = options;
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => {});

  const start = now();
  const before = await spentToday(sql, start);
  const runsLeft = Math.max(1, Math.ceil(runsPerDay * (1 - utcDayFraction(start))));
  // What a run leaves unspent carries to the runs after it, never past the day.
  const runCap = Math.max(0, dailyCapMicros - before) / runsLeft;

  const [row] = await sql<{ id: string }[]>`insert into runs (started_at) values (${start}) returning id::text`;
  const runId = row?.id as string;

  const totals = { providerMicros: 0, modelMicros: 0, fetched: 0, filtered: 0, sorted: 0, kept: 0, errors: 0 };
  const spent = () => totals.providerMicros + totals.modelMicros;
  const fits = (micros: number) => spent() + micros <= runCap;
  const save = () => sql`
    update runs set provider_micros = ${Math.round(totals.providerMicros)},
      model_micros = ${Math.round(totals.modelMicros)}, fetched = ${totals.fetched},
      filtered = ${totals.filtered}, sorted = ${totals.sorted}, kept = ${totals.kept}
    where id = ${runId}`;

  let outcome: RunResult["outcome"] = "done";
  const since = new Date(start.getTime() - options.lookBackMs);

  try {
    outer: for (const plan of plans) {
      for (const phrase of plan.phrases) {
        let cursor: string | undefined;
        for (let page = 0; page < plan.maxPages; page += 1) {
          if (!fits(plan.worstSearchMicros)) {
            outcome = "budget";
            break outer;
          }
          let result: Awaited<ReturnType<SocialSource["search"]>>;
          try {
            result = await plan.source.search({
              query: { queries: [phrase], channels: [], since },
              credentials: { apiKey: plan.apiKey },
              cursor,
              limit: plan.limit,
            });
          } catch (error) {
            // One provider answering 500 for one phrase (US-413 saw it) is no
            // reason to stop the others. A failed call reports no units; if
            // the provider billed it anyway, the invoice says so, not us.
            totals.errors += 1;
            log(`${plan.platform} "${phrase}": ${(error as Error).message}`);
            break;
          }
          totals.providerMicros += result.unitsConsumed * plan.unitMicros;
          await save();

          const fresh = await freshPosts(sql, plan.platform, result.posts);
          totals.fetched += fresh.length;
          for (const post of fresh) {
            const text = `${post.title ?? ""} ${post.text}`;
            if (!readsLikeRequest(text)) continue;
            totals.filtered += 1;
            if (!fits(worstSortMicros)) {
              outcome = "budget";
              break outer;
            }
            const sorted = await sort({
              platform: plan.platform,
              channel: post.channel,
              title: post.title,
              text: post.text,
            });
            const cost = modelMicros(sorted.call);
            totals.modelMicros += Number.isNaN(cost) ? worstSortMicros : cost;
            totals.sorted += 1;
            if (sorted.status === "sorted" && sorted.verdict.asksForProduct && sorted.verdict.category !== "other") {
              await saveRequest(sql, {
                platform: plan.platform,
                externalId: post.externalId,
                url: post.url,
                channel: post.channel ?? null,
                title: post.title ? cleanText(post.title) : null,
                excerpt: excerptOf(post.text),
                wants: sorted.verdict.wants,
                category: sorted.verdict.category,
                postedAt: post.postedAt,
              });
              totals.kept += 1;
            }
            await save();
          }

          if (result.next.status !== "ready") break;
          cursor = result.next.cursor;
        }
      }
    }
    await forgetOld(sql, start);
  } catch (error) {
    await save();
    await sql`update runs set finished_at = ${now()}, outcome = ${(error as Error).message} where id = ${runId}`;
    throw error;
  }

  await save();
  const said = totals.errors > 0 ? `${outcome}, ${totals.errors} failed searches` : outcome;
  await sql`update runs set finished_at = ${now()}, outcome = ${said} where id = ${runId}`;
  log(
    `run ${runId}: ${outcome}, $${(spent() / 1e6).toFixed(4)} of $${(runCap / 1e6).toFixed(4)}, ` +
      `${totals.fetched} fetched, ${totals.filtered} filtered, ${totals.sorted} sorted, ${totals.kept} kept, ${totals.errors} failed searches`,
  );
  return { outcome, ...totals };
}

/** New posts only, each once, and every one of them recorded as seen. */
async function freshPosts(sql: Sql, platform: string, posts: readonly CandidatePost[]) {
  const unique = [...new Map(posts.map((post) => [post.externalId, post])).values()];
  const seen = await alreadySeen(sql, platform, unique.map((post) => post.externalId));
  const fresh = unique.filter((post) => !seen.has(post.externalId));
  await markSeen(sql, platform, fresh.map((post) => post.externalId));
  return fresh;
}

function utcDayFraction(at: Date): number {
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return (at.getTime() - midnight) / (24 * 60 * 60 * 1000);
}
