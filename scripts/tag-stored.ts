/**
 * US-456: give tags to posts stored before tagging, once.
 *
 *   node --env-file=.env scripts/tag-stored.ts --limit 40            # a sample, newest first
 *   node --env-file=.env scripts/tag-stored.ts --limit 40 --dry-run  # print, write nothing
 *
 * One model call per post, through the same sort as the worker. Only the
 * tags are written: the category and the `wants` line stay as the worker
 * stored them. The post's text is the stored excerpt, with the `wants` line,
 * because the full post was never kept.
 */
import { aiConfigFromEnvironment, aiEnvSchema } from "@signalscout/engine";
import { connect } from "../src/db/client.ts";
import { allTags, proposeTags, showBusyProposals, syncListedTags } from "../src/db/tags.ts";
import { categorySlugs } from "../src/sort/categories.ts";
import { createSorter } from "../src/sort/categorize.ts";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const limit = Number(argument("--limit") ?? "0");
const dryRun = process.argv.includes("--dry-run");
if (!Number.isInteger(limit) || limit <= 0) throw new Error("say how many posts: --limit <n>");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = connect(url);
await syncListedTags(sql);
const ai = aiConfigFromEnvironment(aiEnvSchema.parse(process.env));

const rows = await sql<
  { id: string; platform: "reddit" | "x"; channel: string | null; title: string | null; excerpt: string; wants: string; category: string }[]
>`
  select id::text, platform, channel, title, excerpt, wants, category from requests
  where removed_at is null and cardinality(tags) = 0 and category in ${sql(categorySlugs as string[])}
  order by posted_at desc limit ${limit}`;
console.log(`${rows.length} posts to tag${dryRun ? " (dry run)" : ""}`);

let failed = 0;
let tagged = 0;
for (const [index, row] of rows.entries()) {
  // Fresh each time, so a tag proposed by one post is offered to the next.
  const sort = createSorter(ai, await allTags(sql));
  const outcome = await sort({
    platform: row.platform,
    channel: row.channel ?? undefined,
    title: row.title ?? undefined,
    text: `${row.excerpt}\n\n(What the author asks for: ${row.wants})`,
  });
  if (outcome.status !== "sorted") {
    failed += 1;
    console.log(`${index + 1}. ${row.id} failed: ${outcome.error}`);
    continue;
  }
  const { tags, proposals } = outcome.tagging;
  console.log(`${index + 1}. [${row.category}] ${row.wants.slice(0, 70)} -> ${tags.join(", ") || "(none)"}`);
  if (dryRun || tags.length === 0) continue;
  await proposeTags(sql, proposals);
  await sql`update requests set tags = ${tags} where id = ${row.id}`;
  tagged += 1;
}

if (!dryRun) {
  const shown = await showBusyProposals(sql);
  if (shown.length > 0) console.log(`tags now shown: ${shown.join(", ")}`);
}
console.log(`${tagged} tagged, ${failed} failed, ${rows.length - tagged - failed} with no tag`);
await sql.end();
