/**
 * The paid stage: does this post ask for a product, and which kind? US-414.
 *
 * The engine's triage and classifier cannot answer it, because both score a
 * post against one product, and Radar has none. This is one structured call
 * on a cheap model with its own prompt and schema, through the engine's
 * `generateStructured`, so the cost of every call is reported the same way.
 */
import {
  type AiConfig,
  createModel,
  generateStructured,
  type ModelCall,
} from "@signalscout/engine";
import { z } from "zod";
import { categories, categorySlugs } from "./categories.ts";

export const verdictSchema = z.object({
  asksForProduct: z
    .boolean()
    .describe("True only when the author asks which product to use or buy"),
  category: z.enum([...categorySlugs, "other"]).describe("The kind of product, or other"),
  wants: z
    .string()
    .max(140)
    .describe("What the author asks for, in one plain line of at most 100 characters"),
});

export type Verdict = z.infer<typeof verdictSchema>;

export interface PostToSort {
  readonly platform: "reddit" | "x";
  readonly channel?: string;
  readonly title?: string;
  readonly text: string;
}

export function buildSystemPrompt(): string {
  return [
    "You read one public post and decide whether its author asks other people",
    "which product to use or buy.",
    "",
    "A PRODUCT is something a person can pick: software, an app, a website to",
    "use, a device, a gadget, gear, clothing, a car. Asking for an alternative",
    "to a product they use counts. Asking whether a product is worth buying",
    "counts.",
    "",
    "It is NOT a request when the post:",
    "- asks for a person or a service: a job candidate, a plumber, an agency,",
    "  a restaurant, a lawyer, a tutor",
    "- asks for books, films, music, shows or games to watch or read",
    "- asks for advice, tips or opinions without asking which product",
    "- sells, advertises or reviews a product",
    "- only uses the words 'recommend' or 'alternative' in another sense",
    "",
    "CATEGORIES. Choose the one that fits best, or 'other':",
    ...categories.map((category) => `- ${category.slug}: ${category.covers}`),
    "",
    "WANTS. When it is a request, write what the author asks for in one plain",
    "line, at most 100 characters, with the details that matter: budget, size,",
    "use, what they want to replace. No name of the author. When it is not a",
    "request, write an empty string.",
  ].join("\n");
}

export function buildUserPrompt(post: PostToSort): string {
  return [
    `PLATFORM: ${post.platform === "x" ? "X" : "Reddit"}`,
    ...(post.channel ? [`SUBREDDIT: r/${post.channel}`] : []),
    ...(post.title ? [`TITLE: ${post.title}`] : []),
    "POST:",
    post.text.slice(0, 2000),
  ].join("\n");
}

export type SortOutcome =
  | { readonly status: "sorted"; readonly verdict: Verdict; readonly call: ModelCall }
  | { readonly status: "rejected" | "failed"; readonly error: string; readonly call: ModelCall };

export function createSorter(config: AiConfig) {
  const model = createModel(config);
  const system = buildSystemPrompt();

  return async function sort(post: PostToSort): Promise<SortOutcome> {
    const result = await generateStructured({
      model,
      config,
      schema: verdictSchema,
      schemaName: "radar_verdict",
      schemaDescription: "Whether the post asks for a product, its category, and what it wants",
      system,
      prompt: buildUserPrompt(post),
    });
    if (result.status !== "ok") return result;
    return { status: "sorted", verdict: result.object, call: result.call };
  };
}
