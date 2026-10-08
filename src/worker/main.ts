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
  builtInSources,
  createSourceRegistry,
  createSourceRuntime,
} from "@signalscout/engine";
import { z } from "zod";
import { connect } from "../db/client.ts";
import { allTags } from "../db/tags.ts";
import { createMailer } from "../lib/mail.ts";
import { servicesEnabled } from "../sort/categories.ts";
import { createSorter } from "../sort/categorize.ts";
import { sendDigests } from "./digest.ts";
import { run, type SearchPlan } from "./run.ts";

// The cheap model rejects a JSON schema and the engine puts it in the prompt
// instead (BUG-018 in the open repository); the SDK warns on every call.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const env = z
  .object({
    DATABASE_URL: z.string().url(),
    SOCIALDATA_API_KEY: z.string().min(1),
    SCRAPECREATORS_API_KEY: z.string().min(1),
    RADAR_DAILY_CAP_USD: z.coerce.number().positive().max(20).default(2),
    PUBLIC_URL: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().default("https://radar.signalscout.run")),
  })
  .parse(process.env);

// Migrations are the `migrate` service's job (src/db/migrate-cli.ts), run
// before this process starts.
const sql = connect(env.DATABASE_URL);

const registry = createSourceRegistry({ definitions: builtInSources, runtime: createSourceRuntime() });
const ai = aiConfigFromEnvironment(aiEnvSchema.parse(process.env));

/**
 * Software first, because the first audience is people who build software:
 * software subreddits and X together get 60% of each run, the goods
 * subreddits 30%, the Reddit keyword search 10%. With services on (US-429),
 * the subreddits where people hire get 10% of that 30%. What a plan leaves unspent
 * passes to the plans after it. Before shares, the money ran out in list order
 * and one production run kept 292 goods requests and 1 software request.
 *
 * Software subreddits give fewer requests than goods ones: 4-8 in 24 posts
 * (probe of 2026-09-26), against 20-24 in the laptop and headphone ones. The
 * weak ones — SaaS, iosapps, ecommerce, macapps, shopify, msp, emailmarketing,
 * dataengineering, 0-2 in 24 — are left out.
 *
 * Prices are the connectors' own (`builtInSources`); the worst case is a full
 * page billed at that price. `pnpm phrases` ranks every input by requests per
 * dollar, so a weak one can be dropped from this list.
 */
const redditKey = env.SCRAPECREATORS_API_KEY;
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
 * Where people hire a business service (US-429). About three posts in four
 * offer work instead, and those are refused before the model, for free. Off
 * while `servicesEnabled` is false; its 10% then goes to the goods subreddits.
 */
const servicesPlan: SearchPlan = {
  platform: "reddit",
  source: reddit,
  apiKey: redditKey,
  share: 0.1,
  ...subreddits,
  channels: ["forhire", "hiring", "slavelabour", "HireaWriter", "DesignJobs"],
  ...redditPrices,
};

const plans: SearchPlan[] = [
  {
    platform: "reddit",
    source: reddit,
    apiKey: redditKey,
    share: 0.2,
    ...subreddits,
    channels: [
      "sysadmin",
      "selfhosted",
      "webdev",
      "devops",
      "Notetaking",
      "CRM",
      "ProductivityApps",
      "Bookkeeping",
      "androidapps",
    ],
    ...redditPrices,
  },
  {
    platform: "x",
    source: registry.get("x", "socialdata"),
    apiKey: env.SOCIALDATA_API_KEY,
    share: 0.4,
    // The four measured in US-413, and six aimed at software, which is the
    // first audience; `pnpm phrases` says after a day which ones pay. Each run
    // starts at a different phrase, so all of them get their turn.
    phrases: [
      "looking for recommendations",
      "what do you use",
      "any suggestions for",
      "can anyone recommend",
      "is there an app",
      "is there a tool",
      "what software do you",
      "what app do you",
      "any alternatives to",
      "recommend a tool",
    ],
    maxPages: 10,
    limit: 20,
    worstSearchMicros: 20 * 200,
    unitMicros: 200,
  },

  ...(servicesEnabled ? [servicesPlan] : []),
  {
    platform: "reddit",
    source: reddit,
    apiKey: redditKey,
    share: servicesEnabled ? 0.2 : 0.3,
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
    ],
    ...redditPrices,
  },
  {
    platform: "reddit",
    source: reddit,
    apiKey: redditKey,
    share: 0.1,
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
];

async function once() {
  // The tags as they are now, with yesterday's proposals, so a proposed tag
  // is reused and not proposed again under another name (US-456).
  const sort = createSorter(ai, await allTags(sql));
  await run({
    sql,
    plans,
    sort,
    dailyCapMicros: Math.round(env.RADAR_DAILY_CAP_USD * 1e6),
    runsPerDay: 24,
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
