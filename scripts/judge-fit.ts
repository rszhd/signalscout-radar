/**
 * US-561: ask the seller-fit question of posts stored before it, once.
 *
 *   node --env-file=.env scripts/judge-fit.ts --limit 40 --dry-run  # print, write nothing
 *   node --env-file=.env scripts/judge-fit.ts --limit 40 --days 30  # newest first
 *   ... --platform all   # every platform; Reddit alone by default, the one the page shows (US-569)
 *
 * On the box: `docker exec signalscout-radar-worker-1 node scripts/judge-fit.ts ...`.
 *
 * One model call per post, through the same sort as the worker. Only
 * `seller_fit` is written: category, tags and the `wants` line stay as the
 * worker stored them. The post's text is the stored excerpt, with the `wants`
 * line, because the full post was never kept.
 */
import { aiConfigFromEnvironment, aiEnvSchema } from "@signalscout/engine";
import { connect } from "../src/db/client.ts";
import { allTags } from "../src/db/tags.ts";
import { categorySlugs } from "../src/sort/categories.ts";
import { createSorter } from "../src/sort/categorize.ts";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const limit = Number(argument("--limit") ?? "0");
const days = Number(argument("--days") ?? "30");
const platform = argument("--platform") ?? "reddit";
const dryRun = process.argv.includes("--dry-run");
if (!Number.isInteger(limit) || limit <= 0) throw new Error("say how many posts: --limit <n>");
if (!Number.isInteger(days) || days <= 0) throw new Error("--days must be a whole number of days");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = connect(url);
const sort = createSorter(aiConfigFromEnvironment(aiEnvSchema.parse(process.env)), await allTags(sql));

const rows = await sql<
  { id: string; platform: "reddit" | "x" | "forum" | "facebook"; channel: string | null; title: string | null; excerpt: string; wants: string; category: string }[]
>`
  select id::text, platform, channel, title, excerpt, wants, category from requests
  where removed_at is null and seller_fit is null and category in ${sql(categorySlugs as string[])}
    and posted_at >= now() - make_interval(days => ${days})
    ${platform === "all" ? sql`` : sql`and platform = ${platform}`}
  order by posted_at desc limit ${limit}`;
console.log(`${rows.length} posts to judge${dryRun ? " (dry run)" : ""}`);

let failed = 0;
let fit = 0;
let costMicros = 0;
for (const [index, row] of rows.entries()) {
  const outcome = await sort({
    platform: row.platform,
    channel: row.channel ?? undefined,
    title: row.title ?? undefined,
    text: `${row.excerpt}\n\n(What the author asks for: ${row.wants})`,
  });
  costMicros += outcome.call.estimatedCostMicros ?? 0;
  if (outcome.status !== "sorted") {
    failed += 1;
    console.log(`${index + 1}. ${row.id} failed: ${outcome.error}`);
    continue;
  }
  const sellerFit = outcome.verdict.sellerFit;
  if (sellerFit) fit += 1;
  console.log(`${index + 1}. ${sellerFit ? "FIT " : "no  "} [${row.category}] ${row.wants.slice(0, 80)}`);
  if (!dryRun) await sql`update requests set seller_fit = ${sellerFit} where id = ${row.id}`;
}

console.log(
  `${fit} fit, ${rows.length - fit - failed} not, ${failed} failed; about $${(costMicros / 1_000_000).toFixed(3)}`,
);
await sql.end();
