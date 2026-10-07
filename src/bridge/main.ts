/**
 * The Claude Code bridge process. See bridge.ts.
 *
 *   node src/bridge/main.ts
 *
 * Claude Code signs in with CLAUDE_CODE_OAUTH_TOKEN, from `claude setup-token`.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeRunner, createBridge, type Fallback } from "./bridge.ts";

/** A number from the environment; blank counts as unset, never as 0. */
function setting(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a whole number above 0, not "${value}".`);
  return number;
}

const port = setting("BRIDGE_PORT", 8787);
const host = process.env.BRIDGE_HOST?.trim() || "0.0.0.0";
/**
 * How many Claude Code processes run at once, about 250 MB each. Calls past it
 * wait, and the wait counts toward the engine's AI_TIMEOUT_MS.
 */
const concurrency = setting("BRIDGE_CONCURRENCY", 5);
/** The outer bound on one call; the engine's own timeout normally ends it first. */
const timeoutMs = setting("BRIDGE_TIMEOUT_MS", 180_000);

/**
 * DeepSeek when Claude cannot answer. Off without a key. The prices have no
 * default: DeepSeek sells in four bands, and a guessed one would make the
 * budget wrong by up to a hundred times. Copy them from the AI_*_PRICE_MICROS
 * the worker used for DeepSeek.
 *
 * The worker records every bridge call at no cost, so RADAR_DAILY_CAP_USD
 * never sees this spend; BRIDGE_FALLBACK_DAILY_USD is its own cap, on top.
 */
function fallbackSettings(): Fallback | undefined {
  const apiKey = process.env.BRIDGE_FALLBACK_API_KEY?.trim();
  if (!apiKey) return undefined;
  const required = (name: string) => {
    if (!process.env[name]?.trim()) throw new Error(`${name} must be set when BRIDGE_FALLBACK_API_KEY is.`);
    return setting(name, 0);
  };
  return {
    apiKey,
    baseUrl: process.env.BRIDGE_FALLBACK_BASE_URL?.trim() || "https://api.deepseek.com/v1",
    model: process.env.BRIDGE_FALLBACK_MODEL?.trim() || "deepseek-flash",
    forModels: (process.env.BRIDGE_FALLBACK_FOR?.trim() || "claude-sonnet-5-5").split(",").map((name) => name.trim()).filter(Boolean),
    inputPriceMicros: required("BRIDGE_FALLBACK_INPUT_PRICE_MICROS"),
    outputPriceMicros: required("BRIDGE_FALLBACK_OUTPUT_PRICE_MICROS"),
    dailyBudgetMicros: setting("BRIDGE_FALLBACK_DAILY_USD", 1) * 1_000_000,
    cooldownMs: setting("BRIDGE_CLAUDE_COOLDOWN_MS", 15 * 60_000),
  };
}
const fallback = fallbackSettings();

// An empty directory, so Claude finds no CLAUDE.md or project settings.
const cwd = mkdtempSync(join(tmpdir(), "claude-bridge-"));

const bridge = createBridge({
  run: claudeRunner({ cwd }),
  concurrency,
  timeoutMs,
  ...(fallback ? { fallback } : {}),
  // One line per call, never the post's text.
  log: (line) => console.log(JSON.stringify({ time: new Date().toISOString(), ...line })),
});

bridge.listen(port, host, () => {
  const fallingBack = fallback
    ? `${fallback.forModels.join(", ")} fall back to ${fallback.model}, up to $${fallback.dailyBudgetMicros / 1_000_000} a day`
    : "no fallback";
  console.log(`claude bridge on ${host}:${port}, ${concurrency} at once, ${fallingBack}`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => bridge.close(() => process.exit(0)));
}
