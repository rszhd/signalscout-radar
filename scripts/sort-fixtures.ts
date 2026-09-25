/**
 * US-414: run the free filter and the model over the US-413 fixtures and
 * compare with the hand marks.
 *
 *   node --env-file=<a .env with AI_*> scripts/sort-fixtures.ts
 */
import { readFileSync } from "node:fs";
import { aiConfigFromEnvironment, aiEnvSchema } from "@signalscout/engine";
import { createSorter } from "../src/sort/categorize.ts";
import { readsLikeRequest } from "../src/sort/phrases.ts";

// The US-413 hand marks: indices of items that ask for a product.
const marks: Record<"reddit" | "x", Set<number>> = {
  reddit: new Set([4, 16, 18, 23]),
  x: new Set([18, 22, 37, 38, 59, 69, 72, 76, 79, 101, 116]),
};

const sort = createSorter(aiConfigFromEnvironment(aiEnvSchema.parse(process.env)));
let calls = 0;
let costMicros = 0;
let agree = 0;
let other = 0;
const rows: string[] = [];

for (const platform of ["reddit", "x"] as const) {
  const items = JSON.parse(readFileSync(`fixtures/us-413/${platform}.json`, "utf8"));
  for (const [index, item] of items.entries()) {
    const text = `${item.title ?? ""} ${item.text}`;
    const kept = readsLikeRequest(text);
    const marked = marks[platform].has(index);
    // The model reads what the filter keeps, and every hand-marked request,
    // so its category and wants can be judged on all of them.
    if (!kept && !marked) continue;
    const outcome = await sort({ platform, channel: item.channel, title: item.title, text: item.text });
    calls += 1;
    costMicros += outcome.call.estimatedCostMicros ?? 0;
    if (outcome.status !== "sorted") {
      rows.push(`${platform} ${index} ${outcome.status}: ${outcome.error}`);
      continue;
    }
    const v = outcome.verdict;
    if (kept && v.isRequest === marked) agree += 1;
    if (v.isRequest && v.category === "other") other += 1;
    rows.push(
      `${platform} ${index} kept=${kept} hand=${marked} model=${v.isRequest} ${v.category} | ${v.wants} | ${text.replace(/\s+/g, " ").slice(0, 80)}`,
    );
  }
}

console.log(rows.join("\n"));
console.log(`calls ${calls}, agreement on kept items ${agree}, requests in other ${other}, cost $${(costMicros / 1e6).toFixed(5)} (null prices count as 0)`);
