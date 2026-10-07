/**
 * An OpenAI-compatible chat endpoint that answers with Claude Code.
 *
 * The engine sends the sorting call to any address that speaks the OpenAI chat
 * format: with `AI_PROVIDER=ollama` and `AI_BASE_URL` pointed here, it needs no
 * change and no API key. Each request runs one `claude -p` on the owner's
 * subscription, so the engine records the call at no cost and the daily cap
 * counts only the searches. US-455; a copy of BuyerFinder's bridge (US-452),
 * so a fix in one belongs in the other.
 *
 * Claude runs with no tools, no MCP servers, no settings files and its own
 * system prompt. The posts it reads are written by strangers; with nothing to
 * run, a post that gives orders can change only its own score.
 */
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface ChatMessage {
  role: string;
  content: string | readonly { type: string; text?: string }[] | null;
}

export interface ChatRequest {
  model: string;
  messages: readonly ChatMessage[];
  response_format?: { type: string };
}

/** What one `claude -p --output-format json` prints, the fields read here. */
export interface ClaudeResult {
  is_error: boolean;
  result?: string;
  api_error_status?: number | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export type RunClaude = (call: {
  model: string;
  system: string;
  prompt: string;
  timeoutMs: number;
  /** Fires when the caller hangs up: the engine's own timeout, or the worker stopping. */
  signal?: AbortSignal;
}) => Promise<ClaudeResult>;

export class BridgeError extends Error {
  // A plain field: Node strips types and refuses parameter properties.
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const textOf = (content: ChatMessage["content"]): string =>
  typeof content === "string" ? content : (content ?? []).map((part) => part.text ?? "").join("");

/**
 * The system messages become Claude's system prompt; the rest is the prompt.
 * The engine sends one user message, which passes through as it is. A longer
 * conversation is written out with each turn's role, so nothing is dropped.
 */
export function toClaudeCall(request: ChatRequest): { system: string; prompt: string } {
  const system = request.messages.filter((m) => m.role === "system").map((m) => textOf(m.content));
  const turns = request.messages.filter((m) => m.role !== "system");
  const prompt =
    turns.length === 1 && turns[0]!.role === "user"
      ? textOf(turns[0]!.content)
      : turns.map((m) => `${m.role}:\n${textOf(m.content)}`).join("\n\n");
  if (!prompt.trim()) throw new BridgeError(400, "The request has no user message.");
  return { system: system.join("\n\n"), prompt };
}

/**
 * The JSON object inside Claude's answer. Claude often wraps it in a code
 * fence, which the engine's parser refuses; the object is cut out from the
 * first brace to the last. An answer with no braces is passed on as it is, and
 * the engine's schema check rejects it with the model's own words.
 *
 * Sonnet sometimes ends the object with a stray `,"` before the brace (7 of
 * 72 calls in US-455), and then may write "Correction:" and a good object.
 * The stray pair is dropped; after a correction, the last object that parses
 * is the answer.
 */
export function jsonFrom(answer: string): string {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start === -1 || end < start) return answer;
  const whole = answer.slice(start, end + 1);
  if (parses(whole)) return whole;
  const mended = whole.replace(/,\s*"\s*}$/, "}");
  if (parses(mended)) return mended;
  // From the last brace back: a nested brace's slice keeps its parent's
  // closing brace and fails, so the first slice that parses is a whole object.
  for (let at = answer.lastIndexOf("{", end); at > start; at = answer.lastIndexOf("{", at - 1)) {
    const last = answer.slice(at, end + 1);
    if (parses(last)) return last;
  }
  return whole;
}

function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function toCompletion(request: ChatRequest, result: ClaudeResult, now = Date.now) {
  if (result.is_error) {
    // A usage limit is a 429 the queue retries later, not a broken request.
    const status = result.api_error_status === 429 ? 429 : 502;
    throw new BridgeError(status, result.result ?? "Claude Code reported an error.");
  }
  const answer = result.result ?? "";
  const content = request.response_format?.type === "json_object" ? jsonFrom(answer) : answer;
  const usage = result.usage ?? {};
  const promptTokens =
    (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  const completionTokens = usage.output_tokens ?? 0;
  return {
    id: `chatcmpl-${now().toString(36)}`,
    object: "chat.completion",
    created: Math.floor(now() / 1000),
    model: request.model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  };
}

/** One `claude -p` with everything but the model turned off. */
export function claudeRunner(options: { command?: string; cwd: string }): RunClaude {
  return ({ model, system, prompt, timeoutMs, signal }) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new BridgeError(499, "The caller hung up before the call started."));
      const child = spawn(
        options.command ?? "claude",
        [
          "-p",
          "--model", model,
          "--system-prompt", system,
          "--output-format", "json",
          "--tools", "",
          "--strict-mcp-config",
          "--setting-sources", "",
          "--safe-mode",
          "--disable-slash-commands",
          "--no-session-persistence",
        ],
        { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      // Nobody reads the answer of a call the engine gave up on; stop spending on it.
      const hangUp = () => child.kill("SIGKILL");
      signal?.addEventListener("abort", hangUp, { once: true });
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new BridgeError(502, `claude did not start: ${error.message}`));
      });
      child.on("close", (code, killedBy) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", hangUp);
        if (signal?.aborted) return reject(new BridgeError(499, "The caller hung up; the call was stopped."));
        if (killedBy === "SIGKILL") return reject(new BridgeError(504, `claude took longer than ${timeoutMs} ms.`));
        // A failed call still prints its JSON result, with is_error set.
        try {
          resolve(JSON.parse(stdout) as ClaudeResult);
        } catch {
          reject(new BridgeError(502, `claude exited ${code}: ${(stderr || stdout).trim().slice(0, 500)}`));
        }
      });
      child.stdin.end(prompt);
    });
}

/** At most `limit` calls at once; the rest wait their turn. */
export function limiter(limit: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= limit) await new Promise<void>((go) => waiting.push(go));
    running++;
    try {
      return await task();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}

export interface CallLog {
  model: string;
  status: number;
  /** From the request's arrival to the answer: waitMs plus Claude's own time. */
  ms: number;
  /** Time spent behind the concurrency limit before Claude started. */
  waitMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** The fallback answered, because Claude failed or rests after a limit. */
  fallback?: true;
  /** What the fallback call cost, in micro-dollars. Claude's calls cost nothing here. */
  costMicros?: number;
  error?: string;
}

/**
 * Where a call goes when Claude cannot answer it: the classifier the site ran
 * before, DeepSeek. The engine sends this provider the same request it sends
 * the bridge (both are OpenAI-compatible, the schema in the prompt), so the
 * request is passed on with only the model changed.
 *
 * The engine records every bridge call at no cost, so the site's daily cap
 * never sees this spend. The bridge keeps its own budget instead. It lives in
 * memory and starts again at zero when the bridge restarts.
 */
export interface Fallback {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** The requested models that may fall back. Any other model fails as Claude failed. */
  forModels: readonly string[];
  /** Per million tokens, in micro-dollars, as AI_INPUT_PRICE_MICROS. */
  inputPriceMicros: number;
  outputPriceMicros: number;
  /** Per UTC day, in micro-dollars. */
  dailyBudgetMicros: number;
  /** How long Claude is skipped after a usage limit, so each call does not fail first. */
  cooldownMs: number;
}

/**
 * Whether Claude's error is the subscription's usage limit. Not seen on a
 * live limit yet: the status is read when Claude gives one, and the words
 * otherwise.
 */
export function isUsageLimit(error: BridgeError): boolean {
  return error.status === 429 || /usage limit|rate limit|limit reached|hit your limit/i.test(error.message);
}

async function readBody(request: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body;
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const utcDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export function createBridge(deps: {
  run: RunClaude;
  concurrency: number;
  timeoutMs: number;
  fallback?: Fallback;
  log?: (line: CallLog) => void;
  now?: () => number;
}): Server {
  const now = deps.now ?? Date.now;
  const queue = limiter(deps.concurrency);
  const { fallback } = deps;
  let claudeRestsUntil = 0;
  const spent = { day: "", micros: 0 };
  const spentToday = () => (spent.day === utcDay(now()) ? spent.micros : 0);

  async function callFallback(chat: ChatRequest, signal: AbortSignal) {
    const settings = fallback!;
    let answer: Response;
    try {
      answer = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({ ...chat, model: settings.model }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(deps.timeoutMs)]),
      });
    } catch (error) {
      throw new BridgeError(502, `The fallback did not answer: ${error instanceof Error ? error.message : String(error)}`);
    }
    const text = await answer.text();
    if (!answer.ok) throw new BridgeError(answer.status === 429 ? 429 : 502, `The fallback refused the call (${answer.status}): ${text.slice(0, 300)}`);
    const completion = JSON.parse(text) as ReturnType<typeof toCompletion>;
    const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    const costMicros = Math.round(
      (usage.prompt_tokens * settings.inputPriceMicros + usage.completion_tokens * settings.outputPriceMicros) / 1_000_000,
    );
    const day = utcDay(now());
    if (spent.day !== day) Object.assign(spent, { day, micros: 0 });
    spent.micros += costMicros;
    return { completion: { ...completion, model: chat.model }, costMicros };
  }

  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true });
    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
      return send(response, 404, { error: { message: "Only POST /v1/chat/completions is served." } });
    }
    const startedAt = now();
    let ranAt: number | undefined;
    const waited = () => (ranAt ?? now()) - startedAt;
    let model = "unknown";
    const hungUp = new AbortController();
    response.on("close", () => {
      if (!response.writableFinished) hungUp.abort();
    });
    try {
      let chat: ChatRequest;
      try {
        chat = JSON.parse(await readBody(request)) as ChatRequest;
      } catch {
        throw new BridgeError(400, "The body is not JSON.");
      }
      if (typeof chat.model !== "string" || !Array.isArray(chat.messages)) {
        throw new BridgeError(400, "The body needs a model and messages.");
      }
      model = chat.model;
      const call = toClaudeCall(chat);

      let claudeError: BridgeError;
      if (now() < claudeRestsUntil) {
        // Nothing waited behind the limit.
        ranAt = startedAt;
        claudeError = new BridgeError(429, `Claude rests after a usage limit until ${new Date(claudeRestsUntil).toISOString()}.`);
      } else {
        try {
          const result = await queue(() => {
            ranAt = now();
            return deps.run({ model: chat.model, ...call, timeoutMs: deps.timeoutMs, signal: hungUp.signal });
          });
          const completion = toCompletion(chat, result, now);
          deps.log?.({
            model,
            status: 200,
            ms: now() - startedAt,
            waitMs: waited(),
            inputTokens: completion.usage.prompt_tokens,
            outputTokens: completion.usage.completion_tokens,
          });
          return send(response, 200, completion);
        } catch (error) {
          if (!(error instanceof BridgeError)) throw error;
          claudeError = error;
          if (fallback && isUsageLimit(error)) claudeRestsUntil = now() + fallback.cooldownMs;
        }
      }

      // 499: nobody is waiting for an answer, so none is bought.
      const mayFallBack =
        fallback && claudeError.status !== 499 && fallback.forModels.includes(chat.model) && spentToday() < fallback.dailyBudgetMicros;
      if (!mayFallBack) throw claudeError;
      try {
        const { completion, costMicros } = await callFallback(chat, hungUp.signal);
        deps.log?.({
          model,
          status: 200,
          ms: now() - startedAt,
          waitMs: waited(),
          inputTokens: completion.usage?.prompt_tokens,
          outputTokens: completion.usage?.completion_tokens,
          fallback: true,
          costMicros,
          error: claudeError.message,
        });
        send(response, 200, completion);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BridgeError(claudeError.status, `${claudeError.message} Then: ${message}`);
      }
    } catch (error) {
      const status = error instanceof BridgeError ? error.status : 500;
      const message = error instanceof Error ? error.message : String(error);
      deps.log?.({ model, status, ms: now() - startedAt, waitMs: waited(), error: message });
      send(response, status, { error: { message, type: "claude_bridge_error" } });
    }
  });
}
