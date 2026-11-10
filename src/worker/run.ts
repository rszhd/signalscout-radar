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
import type { CandidatePost, ModelCall, SocialSource, SourceCredentials } from "@signalscout/engine";
import type { Sql } from "../db/client.ts";
import { alreadySeen, forgetOld, keptAmong, markSeen, saveRequest, spentToday } from "../db/queries.ts";
import { forgetIdleProposals, proposeTags, showBusyProposals } from "../db/tags.ts";
import type { PostToSort, SortOutcome } from "../sort/categorize.ts";
import { inIndianPlace, offersWork, readsLikeRequest } from "../sort/phrases.ts";

export interface SearchPlan {
  readonly platform: "reddit" | "x" | "forum" | "facebook";
  // Only the search, and for a forum the thread page of a cut post: Radar
  // never reads replies and never checks a key.
  readonly source: Pick<SocialSource, "search" | "completePosts">;
  readonly credentials: SourceCredentials;
  /** Search phrases. A post they find must pass the free text filter first. */
  readonly phrases: readonly string[];
  /**
   * Subreddits read newest first. A post there skips the text filter: in a
   * subreddit made for buying advice most posts are requests, and most of
   * those never say "recommend" — a probe of 8 subreddits found 122 requests
   * in 193 posts, of which the filter would have kept 35.
   */
  readonly channels?: readonly string[];
  /**
   * Read the subreddits ten to a search, `subreddit:a OR subreddit:b`, not
   * one a request (engine 0.26.4, US-536). A quiet hour then costs one credit
   * a group, not one a subreddit. The search can miss a few posts that a read
   * of each subreddit returns: BuyerFinder measured 0.5% to 3%.
   */
  readonly combineChannels?: boolean;
  /**
   * Forums, each read through its newest-threads feed (US-511). A feed is
   * one call, and its posts pass the text filter as a phrase's do: most
   * threads on a forum are not requests.
   */
  readonly feeds?: (turn: number) => readonly { readonly name: string; readonly url: string }[];
  /**
   * Send every new post of a feed to the model, as a subreddit's are, with no
   * text filter. For Facebook groups (US-518): their posts are short and
   * rarely use a request phrase.
   */
  readonly feedsSkipFilter?: boolean;
  /**
   * What the plan spent outside the units its source reports, since the last
   * ask: a forum's browser, which the engine counts no unit for (US-511).
   * Read after every call.
   */
  readonly extraMicros?: () => number;
  /**
   * This plan's part of each run's money, from 0 to 1. What a plan leaves
   * unspent passes to the plans after it. Without shares the money simply runs
   * out in plan order, and on 2026-09-26 that gave the goods subreddits 292 of
   * a run's 293 requests while software was never reached.
   */
  readonly share?: number;
  /**
   * Run this plan only in hours divisible by this number. A subreddit gets
   * fewer than a page of new posts in three hours, and every read is billed
   * whether it finds anything or not: read hourly, 27 subreddits cost more
   * than the whole $2 a day. A skipped plan passes its whole share on.
   */
  readonly everyHours?: number;
  /** How far back this plan looks, when it differs from the run's. */
  readonly lookBackMs?: number;
  /** Pages per phrase or subreddit per run, at most. */
  readonly maxPages: number;
  /**
   * Pages the connector may read for one input, when its own cap (two for
   * Reddit) is too few: a backfill of a busy subreddit. The engine allows 20.
   */
  readonly pagesPerInput?: number;
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
  /**
   * The dearest one model call can cost, in micro-dollars. Zero for a model
   * the run does not pay for (the Claude bridge, US-455): its calls never wait
   * for money the searches left.
   */
  readonly worstSortMicros: number;
  /** How far back a search looks. Overlap is fine: `seen_posts` removes it. */
  readonly lookBackMs: number;
  /**
   * A backfill: `dailyCapMicros` is this run's own budget, and its spend is
   * left out of the day's, so the hourly runs keep their cap.
   */
  readonly backfill?: boolean;
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

/** The most subreddits one combined search names: the engine's own group size. */
const subredditsPerSearch = 10;

/**
 * A plan's subreddits as inputs: one each, or in groups of ten for a combined
 * search. A group's stats row is named `r/a+b+c`.
 */
function channelInputs(plan: SearchPlan) {
  const channels = plan.channels ?? [];
  const groups: string[][] = [];
  if (plan.combineChannels) {
    for (let start = 0; start < channels.length; start += subredditsPerSearch) {
      groups.push(channels.slice(start, start + subredditsPerSearch));
    }
  } else {
    groups.push(...channels.map((name) => [name]));
  }
  return groups.map((group) => ({ text: `r/${group.join("+")}`, queries: [], channels: group, filter: false }));
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
    // Hiring posts carry contact details; the page promises no names (US-429).
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/https?:\/\/(t\.me|wa\.me|discord\.gg|discord\.com\/users|calendly\.com)\/\S+/gi, "[contact link]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[phone]")
    .replace(/\b(discord|telegram|whatsapp|skype)\s*[:@-]\s*[\w.#]+/gi, "$1: [handle]")
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
  const backfill = options.backfill === true;
  const before = backfill ? 0 : await spentToday(sql, start);
  const runsLeft = backfill ? 1 : Math.max(1, Math.ceil(runsPerDay * (1 - utcDayFraction(start))));
  // What a run leaves unspent carries to the runs after it, never past the day.
  const runCap = Math.max(0, dailyCapMicros - before) / runsLeft;

  const [row] = await sql<{ id: string }[]>`
    insert into runs (started_at, backfill) values (${start}, ${backfill}) returning id::text`;
  const runId = row?.id as string;

  const blank = () => ({ providerMicros: 0, modelMicros: 0, fetched: 0, filtered: 0, sorted: 0, kept: 0, errors: 0 });
  const totals = blank();
  // The same counters for the phrase being searched, so a phrase can be judged
  // by what it found per dollar (phrase_stats). `found` and `matched` are the
  // phrase's alone: a post two phrases find counts for both (migration 008).
  const phraseBlank = () => ({ ...blank(), found: 0, matched: 0 });
  let phrase = { platform: "", text: "", ...phraseBlank() };
  const add = (field: keyof ReturnType<typeof blank>, amount: number) => {
    totals[field] += amount;
    phrase[field] += amount;
  };
  const spent = () => totals.providerMicros + totals.modelMicros;
  // The plan being run may spend up to its allowance: its share of the run,
  // plus whatever the plans before it left.
  let planStart = 0;
  let planAllowance = runCap;
  const planLeft = () => Math.min(runCap - spent(), planAllowance - (spent() - planStart));
  const fits = (micros: number) => micros <= planLeft();
  const save = async () => {
    await sql`
      update runs set provider_micros = ${Math.round(totals.providerMicros)},
        model_micros = ${Math.round(totals.modelMicros)}, fetched = ${totals.fetched},
        filtered = ${totals.filtered}, sorted = ${totals.sorted}, kept = ${totals.kept}
      where id = ${runId}`;
    if (!phrase.text) return;
    await sql`
      insert into phrase_stats (run_id, platform, phrase, provider_micros, model_micros, fetched, filtered, kept, errors, found, matched)
      values (${runId}, ${phrase.platform}, ${phrase.text}, ${Math.round(phrase.providerMicros)},
              ${Math.round(phrase.modelMicros)}, ${phrase.fetched}, ${phrase.filtered}, ${phrase.kept}, ${phrase.errors},
              ${phrase.found}, ${phrase.matched})
      on conflict (run_id, platform, phrase) do update set
        provider_micros = excluded.provider_micros, model_micros = excluded.model_micros,
        fetched = excluded.fetched, filtered = excluded.filtered, kept = excluded.kept, errors = excluded.errors,
        found = excluded.found, matched = excluded.matched`;
  };

  let outcome: RunResult["outcome"] = "done";

  try {
    let carried = 0;
    const hour = Math.floor(start.getTime() / (60 * 60 * 1000));
    for (const plan of plans) {
      planStart = spent();
      planAllowance = plan.share === undefined ? runCap : runCap * plan.share + carried;
      if (plan.everyHours && hour % plan.everyHours !== 0) {
        carried = planAllowance;
        continue;
      }
      const since = new Date(start.getTime() - (plan.lookBackMs ?? options.lookBackMs));
      const turn = plan.everyHours ? Math.floor(hour / plan.everyHours) : hour;
      const inputs = rotate(
        [
          ...plan.phrases.map((text) => ({ text, queries: [text], channels: [] as string[], filter: true })),
          ...channelInputs(plan),
          ...(plan.feeds?.(turn) ?? []).map((feed) => ({
            text: feed.name,
            queries: [feed.url],
            channels: [],
            filter: !plan.feedsSkipFilter,
          })),
        ],
        turn,
      );
      inputs: for (const input of inputs) {
        const { text } = input;
        phrase = { platform: plan.platform, text, ...phraseBlank() };
        let cursor: string | undefined;
        for (let page = 0; page < plan.maxPages; page += 1) {
          if (!fits(plan.worstSearchMicros)) {
            outcome = "budget";
            break inputs;
          }
          let result: Awaited<ReturnType<SocialSource["search"]>>;
          try {
            result = await plan.source.search({
              query: { queries: input.queries, channels: input.channels, since },
              credentials: plan.credentials,
              cursor,
              limit: plan.limit,
              ...(input.channels.length > 1 ? { combineChannels: true } : {}),
              ...(plan.pagesPerInput ? { pagesPerInput: plan.pagesPerInput } : {}),
            });
          } catch (error) {
            // One provider answering 500 for one phrase (US-413 saw it) is no
            // reason to stop the others. A failed call reports no units; if
            // the provider billed it anyway, the invoice says so, not us.
            add("errors", 1);
            add("providerMicros", plan.extraMicros?.() ?? 0);
            await save();
            log(`${plan.platform} "${text}": ${(error as Error).message}`);
            break;
          }
          add("providerMicros", result.unitsConsumed * plan.unitMicros + (plan.extraMicros?.() ?? 0));
          await save();

          const fresh = await freshPosts(sql, plan.platform, result.posts);
          add("fetched", fresh.length);
          // Every post the search returned counts for this phrase, and the
          // seen ones already kept as requests count as its matches. A fresh
          // one counts below, when this phrase keeps it.
          const freshIds = new Set(fresh.map((post) => post.externalId));
          const seenIds = [...new Set(result.posts.map((post) => post.externalId))].filter((id) => !freshIds.has(id));
          phrase.found += freshIds.size + seenIds.length;
          phrase.matched += await keptAmong(sql, plan.platform, seenIds);
          const toSort = fresh.filter(
            (post) =>
              !offersWork(post.title, post.text) &&
              !inIndianPlace(post.channel, post.url) &&
              (!input.filter || readsLikeRequest(`${post.title ?? ""} ${post.text}`, post.title)),
          );
          // What the filter set aside is handled: it will never be sorted.
          await markSeen(sql, plan.platform, fresh.filter((post) => !toSort.includes(post)).map((post) => post.externalId));
          add("filtered", toSort.length);
          // Saved here too: when the filter sets every post aside no model
          // batch saves after this, and the next input replaces `phrase`, so
          // the row kept fetched 0 (US-518: 33 of 40 Facebook reads showed 0
          // while 96 posts were read).
          await save();

          // The model is the slow part, so a few calls run at once. Each one in
          // flight is counted at its worst case before it starts.
          for (let i = 0; i < toSort.length; i += sortConcurrency) {
            const affordable = worstSortMicros === 0 ? sortConcurrency : Math.floor(planLeft() / worstSortMicros);
            const batch = toSort.slice(i, i + Math.min(sortConcurrency, affordable));
            if (batch.length === 0) {
              outcome = "budget";
              break inputs;
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
              if (sorted.status === "sorted" && sorted.verdict.isRequest && sorted.verdict.category !== "other") {
                // A forum feed may cut the first post and date the thread by
                // its newest reply. Only a post worth keeping pays for its page.
                let whole: CandidatePost | null = post;
                if (post.partial) {
                  if (!fits(plan.worstSearchMicros)) continue;
                  const read = await completed(plan, post);
                  add("providerMicros", read.units * plan.unitMicros + (plan.extraMicros?.() ?? 0));
                  whole = read.post;
                }
                if (!whole) continue;
                await proposeTags(sql, sorted.tagging.proposals);
                await saveRequest(sql, {
                  platform: plan.platform,
                  externalId: whole.externalId,
                  url: whole.url,
                  channel: whole.channel ?? null,
                  title: whole.title ? cleanText(whole.title) : null,
                  excerpt: excerptOf(whole.text),
                  wants: sorted.verdict.wants,
                  category: sorted.verdict.category,
                  postedAt: whole.postedAt,
                  // A combined search names its own subreddit, not the group.
                  phrase: input.channels.length > 1 && whole.channel ? `r/${whole.channel}` : text,
                  tags: sorted.tagging.tags,
                });
                add("kept", 1);
                phrase.matched += 1;
              }
            }
            // Seen only once sorted: a post the budget did not reach, or whose
            // call failed (a Claude usage limit), stays unseen, so a later run
            // can still pick it up while its search reaches back that far.
            await markSeen(
              sql,
              plan.platform,
              batch.filter((_, index) => outcomes[index]?.status !== "failed").map((post) => post.externalId),
            );
            await save();
            if (batch.length < Math.min(sortConcurrency, toSort.length - i)) {
              outcome = "budget";
              break inputs;
            }
          }

          if (result.next.status !== "ready") break;
          cursor = result.next.cursor;
        }
      }
      carried = Math.max(0, planAllowance - (spent() - planStart));
    }
    await forgetOld(sql, start);
    // US-456: a proposed tag enough posts carry is shown; one no post carries
    // any more is dropped.
    const shown = await showBusyProposals(sql, start);
    if (shown.length > 0) log(`tags now shown: ${shown.join(", ")}`);
    await forgetIdleProposals(sql, start);
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

/**
 * A partial post's thread page, read whole. Null when the thread started
 * before the post's window, or its page could not be read: a thread the feed
 * showed for a new reply is not a new request.
 */
async function completed(
  plan: SearchPlan,
  post: CandidatePost,
): Promise<{ post: CandidatePost | null; units: number }> {
  if (!plan.source.completePosts) return { post, units: 0 };
  try {
    for await (const result of plan.source.completePosts({
      posts: [{ url: post.url, ...(post.partial?.since ? { since: post.partial.since } : {}) }],
      credentials: plan.credentials,
    })) {
      const units = result.unitsConsumed;
      return result.status === "complete"
        ? { post: { ...result.post, externalId: post.externalId }, units }
        : { post: null, units };
    }
  } catch {
    // A page that could not be read: the post is dropped, never kept half.
  }
  return { post: null, units: 0 };
}

/** New posts only, each once. The caller marks them seen once it has handled them. */
async function freshPosts(sql: Sql, platform: string, posts: readonly CandidatePost[]) {
  const unique = [...new Map(posts.map((post) => [post.externalId, post])).values()];
  const seen = await alreadySeen(sql, platform, unique.map((post) => post.externalId));
  return unique.filter((post) => !seen.has(post.externalId));
}

/**
 * The list, started at a different place each hour. A plan's share often buys
 * fewer inputs than the plan holds — X's share of one run pays for about four
 * of its ten phrases — and without this the same four would run every hour
 * and the rest never.
 */
export function rotate<T>(items: readonly T[], hour: number): T[] {
  if (items.length === 0) return [];
  const offset = hour % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function utcDayFraction(at: Date): number {
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return (at.getTime() - midnight) / (24 * 60 * 60 * 1000);
}
