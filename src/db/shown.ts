/**
 * The rule every public list of requests uses (US-569): not taken down, on a
 * shown platform, and, with `fitOnly`, one a small seller could answer.
 * BuyerFinder's admin counts (niches.ts, subreddits.ts) do not use it: they
 * count every kept post.
 */
import { fitOnly, shownPlatforms } from "../lib/visibility.ts";
import type { Sql } from "./client.ts";

/** For a query on `requests` with no alias. */
export const shownRequest = (sql: Sql) =>
  sql`removed_at is null and platform in ${sql([...shownPlatforms])} ${fitOnly ? sql`and seller_fit` : sql``}`;

/** For a query that names `requests` as `r`. */
export const shownRequestR = (sql: Sql) =>
  sql`r.removed_at is null and r.platform in ${sql([...shownPlatforms])} ${fitOnly ? sql`and r.seller_fit` : sql``}`;
