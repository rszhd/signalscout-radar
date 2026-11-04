/**
 * The worker process: one run at the top of every hour, for ever. US-415.
 *
 *   node --env-file=.env src/worker/main.ts          # every hour
 *   node --env-file=.env src/worker/main.ts --once   # one run, then exit
 *   node --env-file=.env src/worker/main.ts --digests  # the daily emails due now, then exit
 */
import {
  aiConfigFromEnvironment,
  aiEnvSchema,
  type BrowserUsage,
  builtInSources,
  createBrightDataForum,
  createScrapeCreatorsFacebook,
  createSourceRegistry,
  createSourceRuntime,
  hasBrowserCredentials,
} from "@signalscout/engine";
import { z } from "zod";
import { connect } from "../db/client.ts";
import { allTags } from "../db/tags.ts";
import { createMailer } from "../lib/mail.ts";
import { createSorter } from "../sort/categorize.ts";
import { sendDigests } from "./digest.ts";
import { groupAddress, knownGroups } from "../lib/known-groups.ts";
import { loggingFetch } from "./facebook-log.ts";
import { forumsForTurn } from "./known-forums.ts";
import { run, type SearchPlan } from "./run.ts";

// The cheap model rejects a JSON schema and the engine puts it in the prompt
// instead (BUG-018 in the open repository); the SDK warns on every call.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const env = z
  .object({
    DATABASE_URL: z.string().url(),
    SCRAPECREATORS_API_KEY: z.string().min(1),
    // Forums (US-511): Browser Use's cloud browser on our own proxy first,
    // Bright Data's Web Unlocker after a browser failure. Without all of them
    // Radar reads no forum.
    BRIGHTDATA_API_KEY: z.string().trim().default(""),
    BRIGHTDATA_UNLOCKER_ZONE: z.string().trim().default(""),
    BROWSER_USE_API_KEY: z.string().trim().default(""),
    PROXY_HOST: z.string().trim().default(""),
    PROXY_PORT: z.string().trim().default(""),
    PROXY_USERNAME: z.string().trim().default(""),
    PROXY_PASSWORD: z.string().trim().default(""),
    // "port" for a proxy that keeps an address per port (DataImpulse).
    PROXY_SESSION: z.string().trim().default("port"),
    // What the proxy charges a GB, in dollars: DataImpulse, $5 for 5 GB.
    RADAR_PROXY_PRICE_PER_GB: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().positive().default(1)),
    RADAR_DAILY_CAP_USD: z.coerce.number().positive().max(20).default(2),
    PUBLIC_URL: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().default("https://radar.buyerfinder.run")),
  })
  .parse(process.env);

// Migrations are the `migrate` service's job (src/db/migrate-cli.ts), run
// before this process starts.
const sql = connect(env.DATABASE_URL);

const runtime = createSourceRuntime();
const registry = createSourceRegistry({ definitions: builtInSources, runtime });
const ai = aiConfigFromEnvironment(aiEnvSchema.parse(process.env));

/**
 * Physical goods only (owner, 2026-11-03, US-511): no software and no hiring
 * subreddits. Reddit, Facebook groups and forums split each run's money in
 * thirds (owner, 2026-11-05: $1.50 a day, up from $1, when Facebook was
 * added; Reddit and forums keep the $0.50 a day each they had): the goods
 * subreddits get 0.35 of $1, the Reddit keyword search 0.15, Facebook and the
 * forums $0.50 each. The subreddits are read every third hour, so in the other
 * hours their share passes to the keyword search. What a plan leaves unspent
 * passes to the plans after it, and the forums come last, so they get what
 * Reddit and Facebook leave.
 *
 * Goods subreddits give 20-24 requests in 24 posts in the laptop and
 * headphone ones (probe of 2026-09-26). Mattress, RobotVacuums, Televisions,
 * airpurifiers, Ultralight, projectors and Tools were added after a probe of
 * 20 candidates on 2026-11-03 (7-16 requests a page); MechanicalKeyboards,
 * homelab, onebag, fountainpens and headphones gave few and were left out.
 *
 * Prices are the connectors' own (`builtInSources`); the worst case is a full
 * page billed at that price. `pnpm phrases` ranks every input by requests per
 * dollar, so a weak one can be dropped from this list.
 */
const redditKey = { apiKey: env.SCRAPECREATORS_API_KEY };
const reddit = registry.get("reddit", "scrapecreators");
const redditPrices = { unitMicros: 1880, worstSearchMicros: 2 * 1880 };
const subreddits = {
  // A subreddit's first read reaches back a day or two; later reads find only
  // what is new, because `seen_posts` removes the overlap.
  lookBackMs: 48 * 60 * 60 * 1000,
  // One page of about 23 posts, every third hour: enough for every subreddit
  // here except r/whatcarshouldIbuy, and a sixth of the cost of two pages
  // every hour.
  maxPages: 1,
  everyHours: 3,
  limit: 25,
  phrases: [],
};

/**
 * Forums (US-511), last and with a third of each run (owner, 2026-11-03: $1 a
 * day, "50-50 between reddit and forums"; 2026-11-05: $1.50 with Facebook,
 * the forums keeping their $0.50), 8 forums an hour. Each run
 * reads 8 niches of the 44, each at its next forum (`forumsForTurn`). The
 * owner chose 8 over 12 the same day: half of a $1 day pays for 12 feed reads
 * an hour and almost no thread page, and a kept cut post needs its page. One
 * feed read is one call through the browser: Bright Data bills nothing for
 * it, so its cost is the browser's, estimated as BuyerFinder does
 * (`estimateBrowserMicros`): browser time at $0.02 an hour, a minute at
 * least, and 1 MB a page through the proxy at Browser Use's $0.20 a GB plus
 * the proxy's own price. A cut post the model keeps costs one more call.
 */
const browserCredentials = {
  apiKey: env.BROWSER_USE_API_KEY,
  proxyHost: env.PROXY_HOST,
  proxyPort: env.PROXY_PORT,
  proxyUsername: env.PROXY_USERNAME,
  proxyPassword: env.PROXY_PASSWORD,
  proxySession: env.PROXY_SESSION,
};
const forumsReady =
  hasBrowserCredentials(browserCredentials) && env.BRIGHTDATA_API_KEY !== "" && env.BRIGHTDATA_UNLOCKER_ZONE !== "";
if (!forumsReady) console.log("forum keys are not set: no forums");

let browserMicros = 0;
function estimateBrowserMicros(usage: BrowserUsage, proxyPricePerGb: number): number {
  const minutes = Math.max(1, Math.ceil((usage.stoppedAt.getTime() - usage.startedAt.getTime()) / 60_000));
  const traffic = (usage.pages / 1024) * (0.2 + proxyPricePerGb) * 1_000_000;
  return Math.round((minutes * 20_000) / 60 + traffic);
}

const forumPlan: SearchPlan | undefined = forumsReady
  ? {
      platform: "forum",
      source: createBrightDataForum({
        browser: { credentials: browserCredentials },
        // The owner's choice: the browser first, Bright Data after it.
        fetcherFor: () => "browser",
        onBrowser: (usage) => {
          browserMicros += estimateBrowserMicros(usage, env.RADAR_PROXY_PRICE_PER_GB);
        },
      }).create(runtime),
      credentials: { apiKey: env.BRIGHTDATA_API_KEY, unlockerZone: env.BRIGHTDATA_UNLOCKER_ZONE },
      share: 1 / 3,
      phrases: [],
      feeds: (turn) => forumsForTurn(turn, 8).map((forum) => ({ name: forum.name, url: forum.feed })),
      // A feed's threads active in the last three days, and of those, the ones
      // started in them: an older thread with a new reply is no new request.
      // Three days, the owner's choice on 2026-11-03: at two, 7 of 12 thread
      // pages bought in a live run were for threads started before it.
      lookBackMs: 72 * 60 * 60 * 1000,
      maxPages: 1,
      limit: 50,
      // The worst call: a browser minute and a page, then Bright Data's page
      // when the browser fails.
      worstSearchMicros: 3000,
      unitMicros: 1500,
      extraMicros: () => {
        const spent = browserMicros;
        browserMicros = 0;
        return spent;
      },
    }
  : undefined;

/**
 * Public Facebook groups (US-518), 8 an hour from 8 niches, rotated as the
 * forums are, from BuyerFinder's list (`lib/known-groups.ts`). One page of 3
 * or 4 posts a group, one ScrapeCreators credit, billed even when nothing is
 * new: 8 an hour is about 192 credits ($0.36) a day, inside Facebook's $0.50
 * with room for the model. The probe of 2026-11-04 found 2 to 4 posts a day
 * in an owner group, and a group comes round every 15 hours or so, so one
 * page catches most of them. A group the provider calls unavailable is skipped
 * by the connector and billed nothing. Every post goes to the model with no
 * text filter, as a subreddit's do (owner, 2026-11-05): in the first 5 runs on
 * the box the filter passed 8 of 96 posts read, and a group post is short and
 * rarely says "recommend". The connector returns the poster's name; Radar
 * never stores it.
 */
// One log line per Facebook page (`facebook-log.ts`), until the box's empty
// reads are explained (2026-11-05).
const facebookRuntime = createSourceRuntime({ fetch: loggingFetch(fetch, (line) => console.log(line)) });

const facebookPlan: SearchPlan = {
  platform: "facebook",
  source: createScrapeCreatorsFacebook({ pagesPerGroup: 1 }).create(facebookRuntime),
  credentials: redditKey,
  share: 0.5 / 1.5,
  phrases: [],
  feeds: (turn) => forumsForTurn(turn, 8, knownGroups).map((group) => ({ name: group.name, url: groupAddress(group.key) })),
  feedsSkipFilter: true,
  lookBackMs: 72 * 60 * 60 * 1000,
  maxPages: 1,
  limit: 10,
  unitMicros: 1880,
  worstSearchMicros: 1880,
};

const plans: SearchPlan[] = [
  {
    platform: "reddit",
    source: reddit,
    credentials: redditKey,
    share: 0.35 / 1.5,
    ...subreddits,
    channels: [
      "SuggestALaptop",
      "HeadphoneAdvice",
      "PickAnAndroidForMe",
      "whatcarshouldIbuy",
      "buildapcforme",
      "BuyItForLife",
      "VacuumCleaners",
      "OfficeChairs",
      "BudgetAudiophile",
      "Cameras",
      "ebikes",
      "CampingGear",
      "Appliances",
      "StandingDesk",
      "HomeNetworking",
      "homegym",
      "Monitors",
      "tablets",
      "Mattress",
      "RobotVacuums",
      "Televisions",
      "airpurifiers",
      "Ultralight",
      "projectors",
      "Tools",
    ],
    ...redditPrices,
  },
  {
    platform: "reddit",
    source: reddit,
    credentials: redditKey,
    share: 0.15 / 1.5,
    phrases: [
      "can anyone recommend",
      "which should I buy",
      "best alternative to",
      "is it worth buying",
      "any suggestions for",
      "looking for recommendations",
    ],
    maxPages: 3,
    limit: 25,
    ...redditPrices,
  },
  facebookPlan,
  ...(forumPlan ? [forumPlan] : []),
];

/**
 * The subreddits once, two pages each and every one of them, for posts the
 * hourly runs missed. The connectors stop every input at two pages, so this is
 * as far back as a run can reach: phrase searches find only the last hour or
 * so, and an hourly run reads one page of each subreddit. Added on 2026-10-24
 * after 16 days with no posts kept.
 */
const backfillPlans: SearchPlan[] = plans
  .filter((plan) => plan.channels !== undefined && plan.channels.length > 0)
  .map(({ everyHours: _, ...plan }) => ({ ...plan, maxPages: 2 }));

async function once(selected = plans, runsPerDay = 24) {
  // The tags as they are now, with yesterday's proposals, so a proposed tag
  // is reused and not proposed again under another name (US-456).
  const sort = createSorter(ai, await allTags(sql));
  await run({
    sql,
    plans: selected,
    sort,
    dailyCapMicros: Math.round(env.RADAR_DAILY_CAP_USD * 1e6),
    runsPerDay,
    // The engine prices an `ollama` call at zero. Here that is the Claude
    // bridge on the owner's subscription (src/bridge, US-455).
    worstSortMicros: ai.provider === "ollama" ? 0 : 2000,
    lookBackMs: 3 * 60 * 60 * 1000,
    log: (line) => console.log(line),
  });
}

// Without SMTP settings there is no daily email; the run goes on.
const send = createMailer();
if (!send) console.log("SMTP is not set up: no daily emails");

/** After each run, so the 08:00 email holds the 08:00 run's posts. US-456. */
async function digests() {
  if (!send) return;
  const result = await sendDigests(sql, send, env.PUBLIC_URL.replace(/\/$/, ""));
  if (result.sent + result.empty + result.failed > 0) {
    console.log(`daily emails: ${result.sent} sent, ${result.empty} with no posts, ${result.failed} failed`);
  }
}

if (process.argv.includes("--digests")) {
  // The daily emails alone, for a test: `pnpm worker --digests`.
  await digests();
  await sql.end();
} else if (process.argv.includes("--backfill")) {
  // One run of `backfillPlans`, out of what is left of today's cap.
  await once(backfillPlans, 1);
  await sql.end();
} else if (process.argv.includes("--once")) {
  await once();
  await sql.end();
} else {
  for (;;) {
    try {
      await once();
    } catch (error) {
      console.error(`run failed: ${(error as Error).message}`);
    }
    try {
      await digests();
    } catch (error) {
      console.error(`daily emails failed: ${(error as Error).message}`);
    }
    const next = new Date();
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    await new Promise((resolve) => setTimeout(resolve, next.getTime() - Date.now()));
  }
}
