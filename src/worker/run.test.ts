import type { CandidatePost, ModelCall, SearchResult } from "@signalscout/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "../db/client.ts";
import { spentToday } from "../db/queries.ts";
import type { SortOutcome } from "../sort/categorize.ts";
import { createTestDatabase } from "../testing/database.ts";
import { run, type RunOptions, type SearchPlan } from "./run.ts";

type SocialSource = SearchPlan["source"];

const noon = new Date("2026-09-25T12:00:00Z");
let sql: Sql;
let drop: () => Promise<void>;

beforeEach(async () => {
  ({ sql, drop } = await createTestDatabase());
});
afterEach(async () => {
  await drop();
});

let nextId = 0;
function post(text: string): CandidatePost {
  nextId += 1;
  return {
    externalId: `p${nextId}`,
    url: `https://x.com/i/status/p${nextId}`,
    author: "somebody",
    text,
    postedAt: new Date(noon.getTime() - 60_000),
  };
}

/** A source that serves the same page for ever, billing 20 units a page. */
function endlessSource(page: () => CandidatePost[], calls = { count: 0 }): SocialSource {
  return {
    async search(): Promise<SearchResult> {
      calls.count += 1;
      return { posts: page(), unitsConsumed: 20, next: { status: "ready", cursor: "more" } };
    },
  };
}

const call = (micros: number): ModelCall => ({
  provider: "deepseek",
  model: "deepseek-flash",
  latencyMs: 1,
  estimatedCostMicros: micros,
});

const yes = async (): Promise<SortOutcome> => ({
  status: "sorted",
  verdict: { isRequest: true, category: "audio", wants: "Headphones for a loud office" },
  call: call(300),
});

function plan(source: SocialSource): SearchPlan {
  return {
    platform: "x",
    source,
    apiKey: "key",
    phrases: ["can anyone recommend"],
    maxPages: 50,
    limit: 20,
    worstSearchMicros: 4000,
    unitMicros: 200,
  };
}

function options(overrides: Partial<RunOptions>): RunOptions {
  return {
    sql,
    plans: [],
    sort: yes,
    dailyCapMicros: 2_000_000,
    runsPerDay: 1,
    worstSortMicros: 1000,
    lookBackMs: 2 * 60 * 60 * 1000,
    now: () => noon,
    ...overrides,
  };
}

describe("run", () => {
  it("stops before the call that would pass the day's cap", async () => {
    // $1.99 already spent today by an earlier run.
    await sql`insert into runs (started_at, provider_micros, finished_at, outcome)
              values (${new Date("2026-09-25T01:00:00Z")}, 1_990_000, ${noon}, 'done')`;

    const source = endlessSource(() => [post("Can anyone recommend headphones for a loud office?")]);
    const result = await run(options({ plans: [plan(source)] }));

    expect(result.outcome).toBe("budget");
    expect(await spentToday(sql, noon)).toBeLessThanOrEqual(2_000_000);
    // $0.01 left: two pages at $0.004 and two sorts at $0.0003 fit, a third page does not.
    expect(result.providerMicros).toBe(8000);
  });

  it("counts yesterday's spend against yesterday, not today", async () => {
    await sql`insert into runs (started_at, provider_micros) values (${new Date("2026-09-24T23:00:00Z")}, 2_000_000)`;
    const result = await run(
      options({ plans: [{ ...plan(endlessSource(() => [])), maxPages: 1 }] }),
    );
    expect(result.outcome).toBe("done");
    expect(result.providerMicros).toBe(4000);
  });

  it("never sends a post it has seen to the model again", async () => {
    const same = post("Can anyone recommend headphones for a loud office?");
    let sorts = 0;
    const counting = async () => {
      sorts += 1;
      return yes();
    };
    const once = { ...plan(endlessSource(() => [same])), maxPages: 1 };

    await run(options({ plans: [once], sort: counting }));
    await run(options({ plans: [once], sort: counting }));

    expect(sorts).toBe(1);
  });

  it("does not pay the model for a post that reads like no request", async () => {
    let sorts = 0;
    const source = endlessSource(() => [post("Great game last night, what a finish.")]);
    const result = await run(
      options({
        plans: [{ ...plan(source), maxPages: 1 }],
        sort: async () => {
          sorts += 1;
          return yes();
        },
      }),
    );
    expect(sorts).toBe(0);
    expect(result.fetched).toBe(1);
    expect(result.kept).toBe(0);
  });

  it("stores the request without its author", async () => {
    const source = endlessSource(() => [post("Can anyone recommend headphones for a loud office?")]);
    await run(options({ plans: [{ ...plan(source), maxPages: 1 }] }));

    const columns = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns where table_name = 'requests'`;
    expect(columns.map((c) => c.column_name)).not.toContain("author");
    const [row] = await sql`select * from requests`;
    expect(JSON.stringify(row)).not.toContain("somebody");
    expect(row?.wants).toBe("Headphones for a loud office");
  });

  it("skips a phrase whose search fails, and records what the run spent", async () => {
    let pages = 0;
    const failing: SocialSource = {
        async search() {
        pages += 1;
        if (pages === 2) throw new Error("provider down");
        return { posts: [], unitsConsumed: 20, next: { status: "ready", cursor: "more" } };
      },
    };
    const lines: string[] = [];
    const result = await run(
      options({
        plans: [{ ...plan(failing), phrases: ["can anyone recommend", "what do you use"], maxPages: 2 }],
        log: (line) => lines.push(line),
      }),
    );

    // Phrase one: page 1 billed, page 2 failed. Phrase two: two pages billed.
    expect(result.errors).toBe(1);
    expect(result.providerMicros).toBe(12000);
    expect(lines.some((line) => line.includes("provider down"))).toBe(true);
    const [row] = await sql<{ provider_micros: string; outcome: string }[]>`select provider_micros::text, outcome from runs`;
    expect(row?.provider_micros).toBe("12000");
    expect(row?.outcome).toBe("done, 1 failed searches");
  });
});

describe("phrase stats", () => {
  it("records what each phrase cost and found, and which phrase found a request", async () => {
    const texts: Record<string, string> = {
      "can anyone recommend": "Can anyone recommend headphones for a loud office?",
      "what do you use": "Nice weather today.",
    };
    const bySearch: SocialSource = {
        async search(request) {
        const phrase = request.query.queries[0] as string;
        return { posts: [post(texts[phrase] as string)], unitsConsumed: 20, next: { status: "done" } };
      },
    };
    await run(
      options({ plans: [{ ...plan(bySearch), phrases: ["can anyone recommend", "what do you use"] }] }),
    );

    const stats = await sql<{ phrase: string; provider_micros: string; model_micros: string; fetched: number; filtered: number; kept: number }[]>`
      select phrase, provider_micros::text, model_micros::text, fetched, filtered, kept from phrase_stats order by phrase`;
    expect(stats).toEqual([
      { phrase: "can anyone recommend", provider_micros: "4000", model_micros: "300", fetched: 1, filtered: 1, kept: 1 },
      { phrase: "what do you use", provider_micros: "4000", model_micros: "0", fetched: 1, filtered: 0, kept: 0 },
    ]);
    const [request] = await sql<{ phrase: string }[]>`select phrase from requests`;
    expect(request?.phrase).toBe("can anyone recommend");
  });
});

describe("subreddits", () => {
  it("sends every new post in a subreddit to the model, and names the subreddit in the stats", async () => {
    let sorts = 0;
    const channelSource: SocialSource = {
      async search(request) {
        expect(request.query.queries).toEqual([]);
        expect(request.query.channels).toEqual(["SuggestALaptop"]);
        // A real request with no request phrase in it: the text filter would drop it.
        return { posts: [post("Laptop for video editing under $1,500")], unitsConsumed: 1, next: { status: "done" } };
      },
    };
    await run(
      options({
        plans: [{ ...plan(channelSource), phrases: [], channels: ["SuggestALaptop"], unitMicros: 1880, worstSearchMicros: 3760 }],
        sort: async () => {
          sorts += 1;
          return yes();
        },
      }),
    );

    expect(sorts).toBe(1);
    const [stat] = await sql<{ phrase: string; kept: number }[]>`select phrase, kept from phrase_stats`;
    expect(stat).toEqual({ phrase: "r/SuggestALaptop", kept: 1 });
  });
});

describe("budget inside a page", () => {
  it("leaves the posts it could not afford unseen, for a later run", async () => {
    // $0.005 left: one search ($0.004) and one sort ($0.001 at worst), not two.
    await sql`insert into runs (started_at, provider_micros) values (${new Date("2026-09-25T01:00:00Z")}, 1_995_000)`;
    const a = post("Can anyone recommend headphones?");
    const b = post("Can anyone recommend a laptop?");
    const source: SocialSource = {
      async search() {
        return { posts: [a, b], unitsConsumed: 20, next: { status: "done" } };
      },
    };
    const result = await run(options({ plans: [plan(source)] }));

    expect(result.outcome).toBe("budget");
    expect(result.sorted).toBe(1);
    const seen = await sql<{ external_id: string }[]>`select external_id from seen_posts order by external_id`;
    expect(seen.map((row) => row.external_id)).toEqual([a.externalId]);
  });
});

describe("plan shares", () => {
  it("keeps a first plan inside its share, so the plan after it still runs", async () => {
    // A run of $0.01 (runsPerDay 1, $0.01 left). The first plan may use 50%.
    await sql`insert into runs (started_at, provider_micros) values (${new Date("2026-09-25T01:00:00Z")}, 1_990_000)`;
    const searched: string[] = [];
    const counting = (name: string): SocialSource => ({
      async search() {
        searched.push(name);
        return { posts: [], unitsConsumed: 20, next: { status: "ready", cursor: "more" } };
      },
    });
    await run(
      options({
        plans: [
          { ...plan(counting("goods")), share: 0.5 },
          { ...plan(counting("software")), share: 0.5 },
        ],
      }),
    );

    // Each page costs $0.004: the first plan fits one page in its $0.005,
    // and the second gets its own $0.005 plus the $0.001 left over.
    expect(searched).toEqual(["goods", "software"]);
  });

  it("passes what a plan leaves unspent to the plans after it", async () => {
    await sql`insert into runs (started_at, provider_micros) values (${new Date("2026-09-25T01:00:00Z")}, 1_990_000)`;
    const searched: string[] = [];
    const counting = (name: string, pages: number): SocialSource => {
      let left = pages;
      return {
        async search() {
          searched.push(name);
          left -= 1;
          return { posts: [], unitsConsumed: 20, next: left > 0 ? { status: "ready", cursor: "more" } : { status: "done" } };
        },
      };
    };
    await run(
      options({
        plans: [
          // Uses nothing: no phrases at all.
          { ...plan(counting("quiet", 0)), phrases: [], share: 0.5 },
          { ...plan(counting("busy", 10)), share: 0.5 },
        ],
      }),
    );

    // $0.005 of its own and $0.005 passed on: two pages of $0.004.
    expect(searched).toEqual(["busy", "busy"]);
  });
});

describe("rotate", () => {
  it("starts the list at a different place each hour, and keeps every item", async () => {
    const { rotate } = await import("./run.ts");
    expect(rotate(["a", "b", "c"], 0)).toEqual(["a", "b", "c"]);
    expect(rotate(["a", "b", "c"], 1)).toEqual(["b", "c", "a"]);
    expect(rotate(["a", "b", "c"], 5)).toEqual(["c", "a", "b"]);
    expect(rotate([], 3)).toEqual([]);
  });
});

describe("everyHours", () => {
  it("skips a plan outside its hours and passes its whole share on", async () => {
    await sql`insert into runs (started_at, provider_micros) values (${new Date("2026-09-25T01:00:00Z")}, 1_990_000)`;
    const searched: string[] = [];
    const counting = (name: string): SocialSource => ({
      async search() {
        searched.push(name);
        return { posts: [], unitsConsumed: 20, next: { status: "ready", cursor: "more" } };
      },
    });
    // Noon UTC on 2026-09-25 is hour 497,316 since 1970, and 497,316 % 5 = 1.
    await run(
      options({
        plans: [
          { ...plan(counting("slow")), share: 0.5, everyHours: 5 },
          { ...plan(counting("fast")), share: 0.5 },
        ],
      }),
    );
    // The slow plan's $0.005 passes on: the fast one gets $0.01, two pages.
    expect(searched).toEqual(["fast", "fast"]);
  });
});

describe("hidden categories", () => {
  it("keeps a service row stored but shows none of it while services are off", async () => {
    const { latestRequests, requestsIn, categoryCounts } = await import("../db/queries.ts");
    const { servicesEnabled } = await import("../sort/categories.ts");
    await sql`insert into requests (platform, external_id, url, excerpt, wants, category, posted_at, phrase)
              values ('reddit', 's1', 'https://r/1', 'Need a logo', 'A logo', 'design-services', ${noon}, 'r/DesignJobs'),
                     ('reddit', 'p1', 'https://r/2', 'Which laptop?', 'A laptop', 'computers', ${noon}, 'r/SuggestALaptop')`;

    const shown = (await latestRequests(sql)).map((row) => row.category);
    const counts = (await categoryCounts(sql, noon)).map((row) => row.category);

    expect(servicesEnabled).toBe(false);
    expect(shown).toEqual(["computers"]);
    expect(counts).toEqual(["computers"]);
    expect(await requestsIn(sql, "design-services")).toEqual([]);
    const [{ count }] = await sql<{ count: string }[]>`select count(*)::text from requests`;
    expect(count).toBe("2");
  });
});
