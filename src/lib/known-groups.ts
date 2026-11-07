/**
 * The public Facebook groups Radar reads (US-518, US-547): owner and user
 * groups the owner's search found, each read and judged from its newest
 * posts, none made for buying or selling.
 *
 * The list is BuyerFinder's (signalscout-lookout US-546), less the niches
 * Radar's forums do not cover, so no personal finance, programming, travel or
 * web hosting group. Before each hourly run the worker copies it into
 * `radar_known_groups` (`syncKnownGroups`); the web and the worker keep a
 * copy of that table in memory, read again when it is a minute old
 * (`refreshKnownGroups`), so the helpers below stay synchronous.
 *
 * `key` is the part of the address after `/groups/`, as the connector stores
 * it in a post's channel.
 */
import type { Sql } from "../db/client.ts";

export interface KnownGroup {
  readonly key: string;
  readonly name: string;
  readonly niche: string;
}

/** How old the copy may be before the next refresh reads the table again. */
export const knownGroupsMaxAgeMs = 60_000;

let current: readonly KnownGroup[] = [];
let byKey = new Map<string, KnownGroup>();
let readAt = 0;
let reading: Promise<readonly KnownGroup[]> | undefined;

/** The copy of the list, in its order. */
export function knownGroups(): readonly KnownGroup[] {
  return current;
}

/** Replace the copy. The refresh uses it, and tests set a list with it. */
export function setKnownGroups(groups: readonly KnownGroup[]): void {
  current = groups.map((group) => ({ key: group.key, name: group.name, niche: group.niche }));
  byKey = new Map(current.map((group) => [group.key.toLowerCase(), group]));
  readAt = Date.now();
}

/** The table's groups, in the list's order. */
export async function readKnownGroups(sql: Sql): Promise<KnownGroup[]> {
  return sql<KnownGroup[]>`select key, name, niche from radar_known_groups order by id`;
}

/**
 * Read the table again when the copy is older than `maxAgeMs`; one read at a
 * time. A failed read throws and keeps the old copy.
 */
export async function refreshKnownGroups(sql: Sql, maxAgeMs = knownGroupsMaxAgeMs): Promise<readonly KnownGroup[]> {
  if (readAt > 0 && Date.now() - readAt < maxAgeMs) return current;
  reading ??= readKnownGroups(sql)
    .then((rows) => {
      setKnownGroups(rows);
      return current;
    })
    .finally(() => {
      reading = undefined;
    });
  return reading;
}

export interface SyncInput {
  /** BuyerFinder's `GET /admin/api/groups`. */
  url: string;
  /** Its read-only token, `LOOKOUT_GROUPS_TOKEN` there. */
  token: string;
  /** The niches of Radar's forums: a group in any other niche is left out. */
  niches: ReadonlySet<string>;
  fetch?: typeof globalThis.fetch;
}

const keyPattern = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Replace the table's rows with BuyerFinder's list, less the niches Radar does
 * not cover. Throws, and leaves the table as it was, on a failed read, an
 * answer that is not a list, or one with no group left: an outage at
 * BuyerFinder must never empty Radar's list. Returns how many groups it wrote.
 */
export async function syncKnownGroups(sql: Sql, input: SyncInput): Promise<number> {
  const fetchList = input.fetch ?? globalThis.fetch;
  const response = await fetchList(input.url, {
    headers: { authorization: `Bearer ${input.token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`BuyerFinder's group list answered ${response.status}`);
  const body = (await response.json().catch(() => null)) as { groups?: unknown } | null;
  if (!Array.isArray(body?.groups)) throw new Error("BuyerFinder's group list is not a list");

  const groups: KnownGroup[] = [];
  const seen = new Set<string>();
  for (const item of body.groups) {
    const row = (item !== null && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const { key, name, niche } = row;
    if (typeof key !== "string" || !keyPattern.test(key)) continue;
    if (typeof name !== "string" || name.trim() === "" || typeof niche !== "string") continue;
    if (!input.niches.has(niche) || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    groups.push({ key, name: name.trim(), niche });
  }
  if (groups.length === 0) throw new Error("BuyerFinder's group list has no group in Radar's niches");

  await sql.begin(async (tx) => {
    await tx`delete from radar_known_groups`;
    for (const group of groups) {
      await tx`insert into radar_known_groups (key, name, niche) values (${group.key}, ${group.name}, ${group.niche})`;
    }
  });
  return groups.length;
}

/** A group's address, the form the connector's query takes. */
export function groupAddress(key: string): string {
  return `https://www.facebook.com/groups/${key}/`;
}

/** The name a page shows for a group's key: the list's name, else "A Facebook group". */
export function groupName(key: string | null | undefined): string {
  return (key ? byKey.get(key.toLowerCase())?.name : undefined) ?? "A Facebook group";
}
