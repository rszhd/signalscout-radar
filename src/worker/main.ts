/**
 * The worker process: one run at the top of every hour, for ever. US-415.
 *
 *   node --env-file=.env src/worker/main.ts          # every hour
 *   node --env-file=.env src/worker/main.ts --once   # one run, then exit
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
import { createSorter } from "../sort/categorize.ts";
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
  })
  .parse(process.env);

// Migrations are the `migrate` service's job (src/db/migrate-cli.ts), run
// before this process starts.
const sql = connect(env.DATABASE_URL);

const registry = createSourceRegistry({ definitions: builtInSources, runtime: createSourceRuntime() });
const sort = createSorter(aiConfigFromEnvironment(aiEnvSchema.parse(process.env)));

/**
 * In order of value, because the day's money runs out in this order: the
 * subreddits made for buying advice (63% requests in the probe, about $0.0007
 * each), then X (7%), then the Reddit keyword search (8%).
 *
 * Prices are the connectors' own (`builtInSources`); the worst case is a full
 * page billed at that price. `pnpm phrases` ranks every input by requests per
 * dollar, so a weak one can be dropped from this list.
 */
const redditKey = env.SCRAPECREATORS_API_KEY;
const redditPrices = { unitMicros: 1880, worstSearchMicros: 2 * 1880 };

const plans: SearchPlan[] = [
  {
    platform: "reddit",
    source: registry.get("reddit", "scrapecreators"),
    apiKey: redditKey,
    phrases: [],
    channels: [
      // Things people buy
      "SuggestALaptop",
      "HeadphoneAdvice",
      "whatcarshouldIbuy",
      "BuyItForLife",
      "Cameras",
      "PickAnAndroidForMe",
      "buildapcforme",
      "BudgetAudiophile",
      "OfficeChairs",
      "StandingDesk",
      "ebikes",
      "homegym",
      "CampingGear",
      "VacuumCleaners",
      "Appliances",
      "HomeNetworking",
      "Monitors",
      "tablets",
      // Software
      "androidapps",
      "iosapps",
      "productivity",
      "Notetaking",
      "selfhosted",
      "SaaS",
    ],
    // A subreddit's first read reaches back a day or two; later reads find
    // only what is new, because `seen_posts` removes the overlap.
    lookBackMs: 48 * 60 * 60 * 1000,
    maxPages: 2,
    limit: 25,
    ...redditPrices,
  },
  {
    platform: "x",
    source: registry.get("x", "socialdata"),
    apiKey: env.SOCIALDATA_API_KEY,
    phrases: ["looking for recommendations", "what do you use", "any suggestions for", "can anyone recommend"],
    maxPages: 10,
    limit: 20,
    worstSearchMicros: 20 * 200,
    unitMicros: 200,
  },
  {
    platform: "reddit",
    source: registry.get("reddit", "scrapecreators"),
    apiKey: redditKey,
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
  await run({
    sql,
    plans,
    sort,
    dailyCapMicros: Math.round(env.RADAR_DAILY_CAP_USD * 1e6),
    runsPerDay: 24,
    worstSortMicros: 2000,
    lookBackMs: 3 * 60 * 60 * 1000,
    log: (line) => console.log(line),
  });
}

if (process.argv.includes("--once")) {
  await once();
  await sql.end();
} else {
  for (;;) {
    try {
      await once();
    } catch (error) {
      console.error(`run failed: ${(error as Error).message}`);
    }
    const next = new Date();
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    await new Promise((resolve) => setTimeout(resolve, next.getTime() - Date.now()));
  }
}
