/**
 * Which phrases earn their money: requests kept per dollar, per phrase.
 *
 *   node --env-file=.env scripts/phrases.ts [days]
 */
import { connect } from "../src/db/client.ts";
import { phraseReport } from "../src/db/queries.ts";

const days = Number(process.argv[2] ?? 7);
const sql = connect(process.env.DATABASE_URL ?? "");
const rows = await phraseReport(sql, days);
console.table(
  rows.map((row) => ({
    platform: row.platform,
    phrase: row.phrase,
    runs: row.runs,
    spent: `$${(row.spentMicros / 1e6).toFixed(3)}`,
    fetched: row.fetched,
    filtered: row.filtered,
    kept: row.kept,
    errors: row.errors,
    "kept per $": row.keptPerDollar === null ? "-" : row.keptPerDollar.toFixed(0),
  })),
);
await sql.end();
