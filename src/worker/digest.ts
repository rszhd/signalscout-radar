/**
 * The daily email. US-456.
 *
 * One email a day per subscriber, at `sendHourUtc` or at the first run after
 * it: the worker calls this after every hourly run, and a subscriber is due
 * once a day. The email holds the posts found since the last daily window,
 * under the subscriber's tags. No posts, no email; the window still closes,
 * so a post found at 09:00 waits for tomorrow's email and does not make a
 * second one today.
 *
 * A first email reaches back a day before the confirmation, so somebody who
 * signs up gets something the next morning.
 */
import { categorySlugs } from "../sort/categories.ts";
import type { Sql } from "../db/client.ts";
import { type DigestPost, digestEmail } from "../lib/email.ts";
import type { Send } from "../lib/mail.ts";

export const sendHourUtc = 8;
export const postsPerEmail = 30;

interface DueRow {
  id: string;
  email: string;
  token: string;
  tags: string[];
  since: Date;
}

export interface DigestResult {
  sent: number;
  empty: number;
  failed: number;
}

/** Today's send time, or null before it. */
export function windowEnd(now: Date): Date | null {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), sendHourUtc));
  return now >= today ? today : null;
}

export async function sendDigests(
  sql: Sql,
  send: Send,
  publicUrl: string,
  now: Date = new Date(),
): Promise<DigestResult> {
  const result: DigestResult = { sent: 0, empty: 0, failed: 0 };
  const today = windowEnd(now);
  if (!today) return result;

  const due = await sql<DueRow[]>`
    select id::text, email, token, tags,
      coalesce(covered_until, confirmed_at - interval '1 day') as since
    from subscribers
    where confirmed_at is not null and unsubscribed_at is null and cardinality(tags) > 0
      and (covered_until is null or covered_until < ${today})`;

  const shownNames = new Map(
    (
      await sql<{ slug: string; name: string }[]>`
        select slug, name from tags where shown_at is not null and category in ${sql(categorySlugs as string[])}`
    ).map((row) => [row.slug, row.name]),
  );

  for (const subscriber of due) {
    const followed = subscriber.tags.filter((tag) => shownNames.has(tag));
    const rows =
      followed.length === 0
        ? []
        : await sql<(Omit<DigestPost, "tagNames"> & { tags: string[]; total: number })[]>`
            select platform, channel, url, wants, excerpt, posted_at as "postedAt", tags,
              (count(*) over ())::int as total
            from requests
            where removed_at is null and category in ${sql(categorySlugs as string[])}
              and tags && ${followed}::text[]
              and found_at > ${subscriber.since} and found_at <= ${now}
            order by posted_at desc
            limit ${postsPerEmail}`;

    if (rows.length === 0) {
      await sql`update subscribers set covered_until = ${now} where id = ${subscriber.id}`;
      result.empty += 1;
      continue;
    }

    const posts: DigestPost[] = rows.map(({ tags, total: _total, ...post }) => ({
      ...post,
      tagNames: tags.filter((tag) => followed.includes(tag)).map((tag) => shownNames.get(tag) ?? tag),
    }));
    // The subject names the tags that found something, busiest first.
    const hits = new Map<string, number>();
    for (const post of posts) for (const name of post.tagNames) hits.set(name, (hits.get(name) ?? 0) + 1);
    const tagNames = [...hits.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

    const unsubscribeUrl = `${publicUrl}/unsubscribe/${subscriber.token}`;
    const email = digestEmail({
      posts,
      more: (rows[0]?.total ?? posts.length) - posts.length,
      tagNames,
      manageUrl: `${publicUrl}/subscription/${subscriber.token}`,
      unsubscribeUrl,
      now,
    });
    try {
      await send({
        to: subscriber.email,
        ...email,
        id: `radar-digest-${subscriber.id}-${today.toISOString().slice(0, 10)}`,
        unsubscribeUrl,
      });
    } catch (error) {
      // The window stays open, so the next run tries again with the same posts.
      console.error(`the daily email to subscriber ${subscriber.id} failed`, error);
      result.failed += 1;
      continue;
    }
    await sql`update subscribers set covered_until = ${now} where id = ${subscriber.id}`;
    result.sent += 1;
  }
  return result;
}
