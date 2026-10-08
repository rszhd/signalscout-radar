/**
 * The people who follow tags by email. US-456.
 *
 * Every change of tags waits for a click in an email to the address itself:
 * a public form that mailed whatever it was given every morning would be a
 * way to spam a stranger, and one that changed a subscriber's tags at once
 * would let anyone rewrite them.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "../db/client.ts";

/** How many addresses one IP may sign up in a UTC day. */
export const subscriptionsPerIpPerDay = 5;

/** A second confirmation for the same address waits this long. */
export const resendAfterMinutes = 10;

/** More than this is a scraper, not a seller. */
export const maxTags = 50;

export type SubscribeResult =
  | { status: "send"; subscriberId: string; token: string; tags: string[]; adding: boolean }
  | { status: "already" }
  | { status: "wait" }
  | { status: "refused"; reason: string };

export function clientIp(forwardedFor: string | null, socketAddress: string | undefined): string {
  const entries = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return entries.at(-1) ?? socketAddress ?? "unknown";
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Ask for these tags. `tags` are already checked as shown. Nothing changes
 * for the subscriber here: the tags wait in `pending_tags` for the click.
 */
export async function subscribe(
  sql: Sql,
  input: { email: string; tags: readonly string[]; ipHash: string },
): Promise<SubscribeResult> {
  const email = input.email.trim().toLowerCase();
  const asked = [...new Set(input.tags)];
  if (asked.length === 0) return { status: "refused", reason: "Pick at least one tag." };
  if (asked.length > maxTags) return { status: "refused", reason: `Pick at most ${maxTags} tags.` };

  const [existing] = await sql<
    {
      id: string;
      token: string;
      tags: string[];
      confirmed_at: Date | null;
      unsubscribed_at: Date | null;
      confirmation_sent_at: Date | null;
    }[]
  >`
    select id::text, token, tags, confirmed_at, unsubscribed_at, confirmation_sent_at
    from subscribers where email = ${email}`;

  if (existing) {
    const active = existing.confirmed_at !== null && existing.unsubscribed_at === null;
    const fresh = active ? asked.filter((tag) => !existing.tags.includes(tag)) : asked;
    if (fresh.length === 0) return { status: "already" };
    if (active && existing.tags.length + fresh.length > maxTags) {
      return { status: "refused", reason: `You can follow at most ${maxTags} tags.` };
    }
    const recent =
      existing.confirmation_sent_at &&
      Date.now() - existing.confirmation_sent_at.getTime() < resendAfterMinutes * 60_000;
    if (recent) return { status: "wait" };
    await sql`update subscribers set pending_tags = ${fresh} where id = ${existing.id}`;
    return { status: "send", subscriberId: existing.id, token: existing.token, tags: fresh, adding: active };
  }

  const [count] = await sql<{ n: number }[]>`
    select count(*)::int as n from subscribers
    where ip_hash = ${input.ipHash}
      and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')`;
  if ((count?.n ?? 0) >= subscriptionsPerIpPerDay) {
    return { status: "refused", reason: "Too many sign-ups from this network today. Try again tomorrow." };
  }

  const token = randomBytes(24).toString("base64url");
  const [row] = await sql<{ id: string }[]>`
    insert into subscribers (email, token, pending_tags, ip_hash)
    values (${email}, ${token}, ${asked}, ${input.ipHash})
    returning id::text`;
  if (!row) throw new Error("the subscriber insert returned no row");
  return { status: "send", subscriberId: row.id, token, tags: asked, adding: false };
}

export async function markConfirmationSent(sql: Sql, subscriberId: string): Promise<void> {
  await sql`update subscribers set confirmation_sent_at = now() where id = ${subscriberId}`;
}

export interface SubscriberView {
  id: string;
  email: string;
  token: string;
  tags: string[];
  pendingTags: string[];
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
}

const tokenShape = /^[A-Za-z0-9_-]{20,64}$/;

export async function readByToken(sql: Sql, token: string): Promise<SubscriberView | null> {
  if (!tokenShape.test(token)) return null;
  const [row] = await sql<SubscriberView[]>`
    select id::text, email, token, tags, pending_tags as "pendingTags",
      confirmed_at as "confirmedAt", unsubscribed_at as "unsubscribedAt"
    from subscribers where token = ${token}`;
  return row ?? null;
}

/**
 * The click in the confirmation email: the pending tags join the rest. A
 * subscriber who had stopped starts again with only the new tags, and from
 * now. A second click finds nothing pending and changes nothing, so an old
 * link cannot undo an unsubscribe.
 */
export async function confirm(sql: Sql, token: string): Promise<SubscriberView | null> {
  if (!tokenShape.test(token)) return null;
  await sql`
    update subscribers set
      tags = case when confirmed_at is null or unsubscribed_at is not null then pending_tags
                  else array(select distinct unnest(tags || pending_tags)) end,
      confirmed_at = case when confirmed_at is null or unsubscribed_at is not null then now() else confirmed_at end,
      covered_until = case when unsubscribed_at is not null then null else covered_until end,
      unsubscribed_at = null,
      pending_tags = '{}'
    where token = ${token} and cardinality(pending_tags) > 0`;
  return readByToken(sql, token);
}

/**
 * The manage page, opened from the link in every email: the holder of the
 * token is the subscriber, so the tags change at once. No tags left stops
 * the emails.
 */
export async function setTags(sql: Sql, token: string, tags: readonly string[]): Promise<SubscriberView | null> {
  if (!tokenShape.test(token)) return null;
  const kept = [...new Set(tags)].slice(0, maxTags);
  await sql`
    update subscribers set tags = ${kept},
      unsubscribed_at = case when ${kept.length} = 0 then coalesce(unsubscribed_at, now()) else unsubscribed_at end
    where token = ${token} and confirmed_at is not null and unsubscribed_at is null`;
  return readByToken(sql, token);
}

export async function unsubscribe(sql: Sql, token: string): Promise<SubscriberView | null> {
  if (!tokenShape.test(token)) return null;
  await sql`
    update subscribers set unsubscribed_at = now(), pending_tags = '{}'
    where token = ${token} and unsubscribed_at is null`;
  return readByToken(sql, token);
}
