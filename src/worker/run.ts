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
  // Only the search: Radar never reads replies and never checks a key.
  readonly source: Pick<SocialSource, "search">;
  readonly apiKey: string;
  /** Search phrases. A post they find must pass the free text filter first. */
  readonly phrases: readonly string[];
  /**
   * Subreddits read newest first. A post there skips the text filter: in a
   * subreddit made for buying advice most posts are requests, and most of
   * those never say "recommend" — a probe of 8 subreddits found 122 requests
   * in 193 posts, of which the filter would have kept 35.
   */
  readonly channels?: readonly string[];
  /** How far back this plan looks, when it differs from the run's. */
  readonly lookBackMs?: number;
  /** Pages per phrase or subreddit per run, at most. */
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

/** Model calls in flight at once. */
const sortConcurrency = 6;

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

  const blank = () => ({ providerMicros: 0, modelMicros: 0, fetched: 0, filtered: 0, sorted: 0, kept: 0, errors: 0 });
  const totals = blank();
  // The same counters for the phrase being searched, so a phrase can be judged
  // by what it found per dollar (phrase_stats).
  let phrase = { platform: "", text: "", ...blank() };
  const add = (field: keyof ReturnType<typeof blank>, amount: number) => {
    totals[field] += amount;
    phrase[field] += amount;
  };
  const spent = () => totals.providerMicros + totals.modelMicros;
  const fits = (micros: number) => spent() + micros <= runCap;
  const save = async () => {
    await sql`
      update runs set provider_micros = ${Math.round(totals.providerMicros)},
        model_micros = ${Math.round(totals.modelMicros)}, fetched = ${totals.fetched},
        filtered = ${totals.filtered}, sorted = ${totals.sorted}, kept = ${totals.kept}
      where id = ${runId}`;
    if (!phrase.text) return;
    await sql`
      insert into phrase_stats (run_id, platform, phrase, provider_micros, model_micros, fetched, filtered, kept, errors)
      values (${runId}, ${phrase.platform}, ${phrase.text}, ${Math.round(phrase.providerMicros)},
              ${Math.round(phrase.modelMicros)}, ${phrase.fetched}, ${phrase.filtered}, ${phrase.kept}, ${phrase.errors})
      on conflict (run_id, platform, phrase) do update set
        provider_micros = excluded.provider_micros, model_micros = excluded.model_micros,
        fetched = excluded.fetched, filtered = excluded.filtered, kept = excluded.kept, errors = excluded.errors`;
  };

  let outcome: RunResult["outcome"] = "done";

  try {
    outer: for (const plan of plans) {
      const since = new Date(start.getTime() - (plan.lookBackMs ?? options.lookBackMs));
      const inputs = [
        ...plan.phrases.map((text) => ({ text, queries: [text], channels: [], filter: true })),
        ...(plan.channels ?? []).map((name) => ({ text: `r/${name}`, queries: [], channels: [name], filter: false })),
      ];
      for (const input of inputs) {
        const { text } = input;
        phrase = { platform: plan.platform, text, ...blank() };
        let cursor: string | undefined;
        for (let page = 0; page < plan.maxPages; page += 1) {
          if (!fits(plan.worstSearchMicros)) {
            outcome = "budget";
            break outer;
          }
          let result: Awaited<ReturnType<SocialSource["search"]>>;
          try {
            result = await plan.source.search({
              query: { queries: input.queries, channels: input.channels, since },
              credentials: { apiKey: plan.apiKey },
              cursor,
              limit: plan.limit,
            });
          } catch (error) {
            // One provider answering 500 for one phrase (US-413 saw it) is no
            // reason to stop the others. A failed call reports no units; if
            // the provider billed it anyway, the invoice says so, not us.
            add("errors", 1);
            await save();
            log(`${plan.platform} "${text}": ${(error as Error).message}`);
            break;
          }
          add("providerMicros", result.unitsConsumed * plan.unitMicros);
          await save();

          const fresh = await freshPosts(sql, plan.platform, result.posts);
          add("fetched", fresh.length);
          const toSort = fresh.filter(
            (post) => !input.filter || readsLikeRequest(`${post.title ?? ""} ${post.text}`),
          );
          // What the filter set aside is handled: it will never be sorted.
          await markSeen(sql, plan.platform, fresh.filter((post) => !toSort.includes(post)).map((post) => post.externalId));
          add("filtered", toSort.length);

          // The model is the slow part, so a few calls run at once. Each one in
          // flight is counted at its worst case before it starts.
          for (let i = 0; i < toSort.length; i += sortConcurrency) {
            const affordable = Math.floor((runCap - spent()) / worstSortMicros);
            const batch = toSort.slice(i, i + Math.min(sortConcurrency, affordable));
            if (batch.length === 0) {
              outcome = "budget";
              break outer;
            }
            const outcomes = await Promise.all(
              batch.map((post) =>
                sort({ platform: plan.platform, channel: post.channel, title: post.title, text: post.text }),
              ),
            );
            for (const [index, sorted] of outcomes.entries()) {
              const post = batch[index] as CandidatePost;
              const cost = modelMicros(sorted.call);
              add("modelMicros", Number.isNaN(cost) ? worstSortMicros : cost);
              add("sorted", 1);
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
                  phrase: text,
                });
                add("kept", 1);
              }
            }
            // Seen only once sorted: a post the budget did not reach stays
            // unseen, so a later run can still pick it up.
            await markSeen(sql, plan.platform, batch.map((post) => post.externalId));
            await save();
            if (batch.length < Math.min(sortConcurrency, toSort.length - i)) {
              outcome = "budget";
              break outer;
            }
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

/** New posts only, each once. The caller marks them seen once it has handled them. */
async function freshPosts(sql: Sql, platform: string, posts: readonly CandidatePost[]) {
  const unique = [...new Map(posts.map((post) => [post.externalId, post])).values()];
  const seen = await alreadySeen(sql, platform, unique.map((post) => post.externalId));
  return unique.filter((post) => !seen.has(post.externalId));
}

function utcDayFraction(at: Date): number {
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return (at.getTime() - midnight) / (24 * 60 * 60 * 1000);
}
