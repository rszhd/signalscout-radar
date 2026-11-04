import { useState } from "react";
import { RequestCard } from "@/components/RequestCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Card, type Platform, platforms } from "@/lib/present";

type Filter = "all" | Platform;

// X is read no more and its posts are hidden (US-511).
const order: Filter[] = ["all", "reddit", "facebook", "forum"];

/** Posts a tab opens with, and posts each "Load more" adds (owner, 2026-11-05). */
export const firstPage = 20;
const nextPage = 10;

interface Paged {
  /** Posts per platform in the last 24 hours: the tab counts. */
  counts: Partial<Record<Platform, number>>;
}

interface List {
  cards: Card[];
  done: boolean;
}

async function fetchPage(filter: Filter, limit: number, after?: Card): Promise<Card[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filter !== "all") params.set("platform", filter);
  if (after) {
    params.set("before", after.postedAt);
    params.set("id", after.id);
  }
  const response = await fetch(`/api/requests?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Card[];
}

/**
 * Without `paged`, every post given is shown and the tabs filter them (category
 * and tag pages). With it, the home page: the tabs count the last 24 hours, a
 * tab shows its newest 20, and "Load more" fetches 10 more from the server.
 */
export function Feed({
  requests,
  showCategory = true,
  paged,
}: {
  requests: Card[];
  showCategory?: boolean;
  paged?: Paged;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [lists, setLists] = useState<Partial<Record<Filter, List>>>({
    all: { cards: requests, done: requests.length < firstPage },
  });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const countOf = (key: Filter) => {
    if (!paged) return key === "all" ? requests.length : requests.filter((r) => r.platform === key).length;
    const counts = paged.counts;
    return key === "all" ? Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0) : (counts[key] ?? 0);
  };

  async function load(key: Filter, limit: number, after?: Card) {
    setLoading(true);
    setFailed(false);
    try {
      const cards = await fetchPage(key, limit, after);
      setLists((old) => ({
        ...old,
        [key]: { cards: [...(after ? (old[key]?.cards ?? []) : []), ...cards], done: cards.length < limit },
      }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function choose(key: Filter) {
    setFilter(key);
    if (paged && !lists[key]) void load(key, firstPage);
  }

  const list = lists[filter];
  const shown = paged
    ? (list?.cards ?? [])
    : filter === "all"
      ? requests
      : requests.filter((r) => r.platform === filter);

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={filter} onValueChange={(value) => choose(value as Filter)}>
        <TabsList className="h-10! w-fit justify-start gap-1 rounded-full border bg-card p-1">
          {order.map((key) => {
            const count = countOf(key);
            // A tab that leads to an empty list is noise. On the home page a
            // tab counts one day but opens older posts too, so it stays.
            if (count === 0 && key !== "all" && !paged) return null;
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="h-8 flex-none rounded-full px-3.5 text-[0.875rem] data-active:bg-brand-soft data-active:text-primary data-active:shadow-none"
              >
                {key !== "all" && (
                  <img src={platforms[key].icon} alt="" className="size-3.5 rounded-[2px]" />
                )}
                {key === "all" ? "All" : platforms[key].name}
                <span className="text-muted-foreground tabular-nums">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="grid gap-4">
        {shown.map((request) => (
          <RequestCard key={request.id} request={request} showCategory={showCategory} />
        ))}
        {shown.length === 0 && !(paged && loading) && (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            Nothing here yet. Radar looks again every hour.
          </p>
        )}
      </div>

      {paged && (failed || loading || (list && !list.done)) && (
        <div className="flex flex-col items-center gap-2">
          {failed && <p className="text-[0.875rem] text-muted-foreground">Could not load more posts. Try again.</p>}
          <Button
            variant="outline"
            className="h-10 rounded-full px-5"
            disabled={loading}
            onClick={() => void load(filter, list ? nextPage : firstPage, list?.cards.at(-1))}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
