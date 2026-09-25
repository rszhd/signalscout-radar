import type { CandidatePost, ModelCall, SearchResult, SocialSource } from "@signalscout/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "../db/client.ts";
import { spentToday } from "../db/queries.ts";
import type { SortOutcome } from "../sort/categorize.ts";
import { createTestDatabase } from "../testing/database.ts";
import { run, type RunOptions, type SearchPlan } from "./run.ts";

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
    validateCredentials: async () => ({ ok: true }) as never,
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
  verdict: { asksForProduct: true, category: "audio", wants: "Headphones for a loud office" },
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
      validateCredentials: async () => ({ ok: true }) as never,
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
