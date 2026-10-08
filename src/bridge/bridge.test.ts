import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createSorter } from "../sort/categorize.ts";
import { BridgeError, type CallLog, type ClaudeResult, createBridge, type Fallback, isUsageLimit, jsonFrom, limiter, type RunClaude, toClaudeCall, toCompletion } from "./bridge.ts";

describe("toClaudeCall", () => {
  it("makes the system messages the system prompt and passes one user message as it is", () => {
    expect(
      toClaudeCall({
        model: "sonnet",
        messages: [
          { role: "system", content: "Score the post." },
          { role: "user", content: [{ type: "text", text: "The post." }] },
        ],
      }),
    ).toEqual({ system: "Score the post.", prompt: "The post." });
  });

  it("writes out a longer conversation with each turn's role", () => {
    const call = toClaudeCall({
      model: "sonnet",
      messages: [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
        { role: "user", content: "c" },
      ],
    });
    expect(call.prompt).toBe("user:\na\n\nassistant:\nb\n\nuser:\nc");
  });

  it("refuses a request with nothing to answer", () => {
    expect(() => toClaudeCall({ model: "sonnet", messages: [{ role: "system", content: "x" }] })).toThrow(/no user message/);
  });
});

describe("jsonFrom", () => {
  it("cuts the object out of a code fence", () => {
    expect(jsonFrom('```json\n{"a": {"b": 1}}\n```')).toBe('{"a": {"b": 1}}');
  });

  it("passes an answer with no object on, for the engine to reject", () => {
    expect(jsonFrom("I cannot score this.")).toBe("I cannot score this.");
  });

  it("takes the corrected object when a broken one comes first", () => {
    // Sonnet's own words, from the US-455 sample.
    const answer =
      '{"isRequest":true,"category":"pets","wants":"Macroalgae for a brackish jar","}\n\n' +
      'Correction: here is the valid JSON object.\n\n{"isRequest":true,"category":"pets","wants":"Macroalgae for a brackish jar","x":{"y":1}}';
    expect(JSON.parse(jsonFrom(answer))).toEqual({ isRequest: true, category: "pets", wants: "Macroalgae for a brackish jar", x: { y: 1 } });
  });

  it("drops a stray comma and quote before the closing brace", () => {
    expect(jsonFrom('{"isRequest":true,"category":"design","wants":"An iPad drawing app","}')).toBe(
      '{"isRequest":true,"category":"design","wants":"An iPad drawing app"}',
    );
  });

  it("passes a broken answer with no good object on whole, for the engine to reject", () => {
    expect(jsonFrom('{"a": 1,"b"}')).toBe('{"a": 1,"b"}');
  });
});

describe("toCompletion", () => {
  const request = { model: "haiku", messages: [], response_format: { type: "json_object" } };

  it("counts cached input as input", () => {
    const completion = toCompletion(request, {
      is_error: false,
      result: '{"a":1}',
      usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 3 },
    });
    expect(completion.choices[0]!.message.content).toBe('{"a":1}');
    expect(completion.usage).toEqual({ prompt_tokens: 15, completion_tokens: 3, total_tokens: 18 });
  });

  it("makes a usage limit a 429 and any other error a 502", () => {
    expect(() => toCompletion(request, { is_error: true, result: "limit", api_error_status: 429 })).toThrow(
      expect.objectContaining({ status: 429 }),
    );
    expect(() => toCompletion(request, { is_error: true, result: "boom" })).toThrow(expect.objectContaining({ status: 502 }));
  });
});

describe("limiter", () => {
  it("runs no more than the limit at once", async () => {
    const queue = limiter(2);
    let running = 0;
    let most = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        queue(async () => {
          most = Math.max(most, ++running);
          await new Promise((done) => setTimeout(done, 5));
          running--;
        }),
      ),
    );
    expect(most).toBe(2);
  });
});

describe("the call log", () => {
  it("separates the wait behind the limit from Claude's own time", async () => {
    const lines: CallLog[] = [];
    const server = createBridge({
      run: async () => {
        await new Promise((done) => setTimeout(done, 50));
        return { is_error: false, result: "ok" };
      },
      concurrency: 1,
      timeoutMs: 1_000,
      log: (line) => lines.push(line),
    });
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/chat/completions`;
    const body = JSON.stringify({ model: "sonnet", messages: [{ role: "user", content: "hi" }] });
    try {
      await Promise.all([1, 2].map(() => fetch(url, { method: "POST", body })));
    } finally {
      server.close();
    }

    const [first, second] = [...lines].sort((a, b) => a.waitMs - b.waitMs);
    expect(first!.waitMs).toBeLessThan(25);
    // The second waited for the first's 50 ms, then ran its own.
    expect(second!.waitMs).toBeGreaterThanOrEqual(40);
    expect(second!.ms - second!.waitMs).toBeGreaterThanOrEqual(40);
  });
});

describe("the fallback", () => {
  const closers: (() => void)[] = [];
  afterEach(() => closers.splice(0).forEach((close) => close()));

  /** A DeepSeek stand-in: answers every call with a million input tokens. */
  async function fakeDeepSeek() {
    const requests: { authorization?: string; body: { model: string; messages: unknown[] } }[] = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push({ authorization: request.headers.authorization, body: JSON.parse(body) });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: "deepseek-flash",
          choices: [{ index: 0, message: { role: "assistant", content: '{"from":"deepseek"}' }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1_000_000, completion_tokens: 0, total_tokens: 1_000_000 },
        }),
      );
    });
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    closers.push(() => server.close());
    return { requests, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1` };
  }

  async function bridgeWith(run: RunClaude, fallback: Fallback) {
    const lines: CallLog[] = [];
    const server = createBridge({ run, concurrency: 2, timeoutMs: 1_000, fallback, log: (line) => lines.push(line) });
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    closers.push(() => server.close());
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/chat/completions`;
    const ask = async (model: string) => {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ model, messages: [{ role: "user", content: "the post" }], response_format: { type: "json_object" } }),
      });
      return { status: response.status, body: (await response.json()) as { choices?: { message: { content: string } }[] } };
    };
    return { lines, ask };
  }

  const settings = (baseUrl: string, change: Partial<Fallback> = {}): Fallback => ({
    baseUrl,
    apiKey: "deepseek-key",
    model: "deepseek-flash",
    forModels: ["claude-sonnet-5-5"],
    inputPriceMicros: 150_000,
    outputPriceMicros: 600_000,
    dailyBudgetMicros: 10_000_000,
    cooldownMs: 60_000,
    ...change,
  });

  it("sends a failed sorting call to DeepSeek with only the model changed, and logs its cost", async () => {
    const deepseek = await fakeDeepSeek();
    const { lines, ask } = await bridgeWith(async () => ({ is_error: true, result: "overloaded" }), settings(deepseek.baseUrl));

    const answer = await ask("claude-sonnet-5-5");

    expect(answer.status).toBe(200);
    expect(answer.body.choices![0]!.message.content).toBe('{"from":"deepseek"}');
    expect(deepseek.requests).toEqual([
      {
        authorization: "Bearer deepseek-key",
        body: { model: "deepseek-flash", messages: [{ role: "user", content: "the post" }], response_format: { type: "json_object" } },
      },
    ]);
    expect(lines[0]).toMatchObject({ status: 200, fallback: true, costMicros: 150_000, error: "overloaded" });
  });

  it("does not fall back for a model it is not set for", async () => {
    const deepseek = await fakeDeepSeek();
    const { ask } = await bridgeWith(async () => ({ is_error: true, result: "overloaded" }), settings(deepseek.baseUrl));

    expect((await ask("claude-opus-5-5")).status).toBe(502);
    expect(deepseek.requests).toHaveLength(0);
  });

  it("skips Claude after a usage limit, so later calls go straight to DeepSeek", async () => {
    const deepseek = await fakeDeepSeek();
    let claudeCalls = 0;
    const { lines, ask } = await bridgeWith(async () => {
      claudeCalls += 1;
      return { is_error: true, result: "You've hit your limit · resets 3pm", api_error_status: 429 };
    }, settings(deepseek.baseUrl));

    expect((await ask("claude-sonnet-5-5")).status).toBe(200);
    expect((await ask("claude-sonnet-5-5")).status).toBe(200);
    // A model with no fallback fails at once while Claude rests, without a try.
    expect((await ask("claude-opus-5-5")).status).toBe(429);
    expect(claudeCalls).toBe(1);
    expect(deepseek.requests).toHaveLength(2);
    expect(lines[1]).toMatchObject({ fallback: true, waitMs: 0 });
  });

  it("stops falling back when the day's budget is spent", async () => {
    const deepseek = await fakeDeepSeek();
    const { ask } = await bridgeWith(
      async () => ({ is_error: true, result: "overloaded" }),
      settings(deepseek.baseUrl, { dailyBudgetMicros: 100_000 }),
    );

    expect((await ask("claude-sonnet-5-5")).status).toBe(200);
    expect((await ask("claude-sonnet-5-5")).status).toBe(502);
    expect(deepseek.requests).toHaveLength(1);
  });

  it("matches a usage limit by its status or its words", () => {
    expect(isUsageLimit(new BridgeError(429, "x"))).toBe(true);
    expect(isUsageLimit(new BridgeError(502, "Claude AI usage limit reached|1791259200"))).toBe(true);
    expect(isUsageLimit(new BridgeError(502, "overloaded"))).toBe(false);
  });
});

describe("the bridge behind Radar's sorter", () => {
  let close: (() => void) | undefined;
  afterEach(() => close?.());

  async function serve(run: RunClaude): Promise<string> {
    const server = createBridge({ run, concurrency: 2, timeoutMs: 1_000 });
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    close = () => server.close();
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  }

  const post = {
    platform: "reddit" as const,
    channel: "selfhosted",
    title: "What do you use for notes?",
    text: "I want a self-hosted notes app that syncs to my phone. What do you all use?",
  };

  it("sorts a post from a fenced answer, and records the call at no cost", async () => {
    const calls: Parameters<RunClaude>[0][] = [];
    const answer: ClaudeResult = {
      is_error: false,
      result:
        "```json\n" +
        JSON.stringify({
          isRequest: true,
          category: "productivity",
          wants: "A self-hosted notes app that syncs to a phone",
          tags: ["note-taking"],
          newTag: "",
          leaving: "",
        }) +
        "\n```",
      usage: { input_tokens: 900, output_tokens: 40 },
    };
    const baseUrl = await serve(async (call) => (calls.push(call), answer));
    const sort = createSorter({ provider: "ollama", model: "sonnet", baseUrl, timeoutMs: 5_000 });

    const outcome = await sort(post);

    expect(outcome.status).toBe("sorted");
    expect(outcome.call).toMatchObject({ provider: "ollama", model: "sonnet", inputTokens: 900, outputTokens: 40, estimatedCostMicros: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe("sonnet");
    // The engine puts the schema in the system prompt for this provider.
    expect(calls[0]!.system).toContain("JSON schema");
    expect(calls[0]!.prompt).toContain("What do you use for notes?");
  });

  it("stops Claude when the engine gives up on the call", async () => {
    let stopped = false;
    const baseUrl = await serve(
      ({ signal }) =>
        new Promise((_, reject) =>
          signal?.addEventListener("abort", () => {
            stopped = true;
            reject(new Error("stopped"));
          }),
        ),
    );
    const sort = createSorter({ provider: "ollama", model: "sonnet", baseUrl, timeoutMs: 1_000 });

    const outcome = await sort(post);

    expect(outcome.status).toBe("failed");
    await expect.poll(() => stopped).toBe(true);
  });

  it("reports a usage limit as a failed call", async () => {
    const baseUrl = await serve(async () => ({ is_error: true, result: "You've hit your limit", api_error_status: 429 }));
    const sort = createSorter({ provider: "ollama", model: "sonnet", baseUrl, timeoutMs: 5_000 });

    expect((await sort(post)).status).toBe("failed");
  });
});
