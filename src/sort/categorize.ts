/**
 * The paid stage: does this post ask for a product or a business service,
 * which kind, and which tags? US-414, US-429 for services, US-456 for tags.
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
import type { TagRow } from "../db/tags.ts";
import { categorySlugs, offeredCategories, servicesEnabled } from "./categories.ts";
import { altSlug, tagSlug } from "./tags.ts";

export const verdictSchema = z.object({
  isRequest: z
    .boolean()
    .describe("True only when the author asks which product to use or buy, or wants to hire a business service"),
  category: z.enum([...categorySlugs, "other"]).describe("The kind of product, or other"),
  wants: z
    .string()
    .max(140)
    .describe("What the author asks for, in one plain line of at most 100 characters"),
  // Empty strings and an empty list, never optional fields: OpenAI's strict
  // mode refuses `.optional()`, and the bridge puts this schema in the prompt.
  tags: z.array(z.string().max(64)).max(3).describe("1 to 3 tag slugs from the list under the chosen category"),
  newTag: z.string().max(60).describe("A short product type missing from the list, or an empty string"),
  leaving: z
    .string()
    .max(60)
    .describe("The brand name of the product the author wants to replace or leave, or an empty string"),
});

export type Verdict = z.infer<typeof verdictSchema>;

export interface PostToSort {
  readonly platform: "reddit" | "x";
  readonly channel?: string;
  readonly title?: string;
  readonly text: string;
}

/** The tags the model may choose, by category: listed and proposed, not "alternatives to". */
function tagLines(tags: readonly TagRow[]): string[] {
  return offeredCategories.flatMap((category) => {
    const own = tags.filter((tag) => tag.category === category.slug && tag.kind === "product");
    // The name beside the slug: "chargers" alone does not say it holds power banks.
    return own.length > 0 ? [`- ${category.slug}: ${own.map((tag) => `${tag.slug} (${tag.name})`).join(", ")}`] : [];
  });
}

export function buildSystemPrompt(tags: readonly TagRow[] = []): string {
  return [
    "You read one public post and decide whether its author asks other people",
    servicesEnabled
      ? "which product to use or buy, or wants to hire someone for business work."
      : "which product to use or buy.",
    "",
    "A PRODUCT is something a person can pick: software, an app, a website to",
    "use, a device, a gadget, gear, clothing, a car. Asking for an alternative",
    "to a product they use counts. Asking whether a product is worth buying",
    "counts.",
    "",
    ...(servicesEnabled
      ? [
          "A BUSINESS SERVICE is work someone is hired to do: an agency, a freelancer,",
          "a developer, a designer, a marketer, a consultant, an accountant, a lawyer,",
          "a virtual assistant. Asking where to find one, or posting a one-off or",
          "contract gig, counts.",
          "",
        ]
      : []),
    "It is NOT a request when the post:",
    ...(servicesEnabled
      ? []
      : ["- wants to hire a person, a freelancer or an agency for work"]),
    "- is a job ad for a full-time or permanent role (salary, benefits, a team",
    "  to join): that is recruiting, not buying",
    "- offers a service or a product, or promotes one ([For Hire], portfolios)",
    "- asks for a local consumer service: a plumber, a cleaner, a doctor, a",
    "  tutor, a restaurant, a shop to visit",
    "- asks for books, films, music, shows or games to watch or read",
    "- asks for advice, tips or opinions without asking which product or whom",
    "  to hire",
    "- only uses the words 'recommend', 'alternative' or 'hire' in another sense",
    "- asks for anything deceptive or unlawful: fake reviews, fake followers,",
    "  forged or edited documents, academic work to submit as one's own, spam",
    "",
    "CATEGORIES. Choose the one that fits best, or 'other':",
    ...offeredCategories.map((category) => `- ${category.slug}: ${category.covers}`),
    "",
    "WANTS. When it is a request, write what the author asks for in one plain",
    "line, at most 100 characters, with the details that matter: budget, size,",
    "use, deadline, what they want to replace. No name, email, phone number or",
    "handle of anyone. When it is not a request, write an empty string.",
    "",
    "TAGS. The products a seller would sell to this author. Pick 1 to 3 slugs",
    "from the list under the category you chose, most specific first. Pick",
    "only what the author asks to buy or use, not what they already own.",
    ...tagLines(tags),
    "",
    "NEW TAG. When no tag in the list fits what the author asks for, write the",
    "product type as a seller would name their market, plural, in 1 to 3 words:",
    "'Standing desks', 'Password managers'. Never a brand or a model. Otherwise",
    "write an empty string.",
    "",
    "LEAVING. When the author asks for an alternative to a product, or says they",
    "want to stop using it because it fails them, write that product's brand name",
    "as its maker writes it, without the model or version: 'HubSpot', 'Procreate',",
    "'Tempur-Pedic'. Not a product they own and want an accessory or part for, not",
    "one they outgrew or wore out and may buy again, and not a shop or a",
    "platform they buy through. Otherwise write an empty string.",
    "",
    "When it is not a request, give no tags and empty strings.",
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

/** What a kept post carries: its tags, and the new ones to store hidden. */
export interface Tagging {
  readonly tags: string[];
  readonly proposals: TagRow[];
}

/**
 * The model's tags, checked. A slug the list does not know is dropped, so a
 * typo never becomes a tag; the new tag and the product left become slugs,
 * reused when a tag with that slug exists and proposed when not.
 */
export function tagging(verdict: Verdict, known: ReadonlyMap<string, TagRow>): Tagging {
  const tags = verdict.tags.map((slug) => slug.trim().toLowerCase()).filter((slug) => known.has(slug));
  const proposals: TagRow[] = [];
  const category = verdict.category;
  const fresh = verdict.newTag.trim();
  const freshSlug = tagSlug(fresh);
  if (freshSlug.length >= 3) {
    tags.push(freshSlug);
    if (!known.has(freshSlug)) proposals.push({ slug: freshSlug, name: fresh.slice(0, 60), category, kind: "product" });
  }
  const leaving = verdict.leaving.trim();
  const leavingSlug = altSlug(leaving);
  if (leavingSlug.length >= 6) {
    tags.push(leavingSlug);
    if (!known.has(leavingSlug)) {
      proposals.push({ slug: leavingSlug, name: `Alternatives to ${leaving.slice(0, 48)}`, category, kind: "alt" });
    }
  }
  return { tags: [...new Set(tags)], proposals };
}

export type SortOutcome =
  | { readonly status: "sorted"; readonly verdict: Verdict; readonly tagging: Tagging; readonly call: ModelCall }
  | { readonly status: "rejected" | "failed"; readonly error: string; readonly call: ModelCall };

export function createSorter(config: AiConfig, tags: readonly TagRow[] = []) {
  const model = createModel(config);
  const system = buildSystemPrompt(tags);
  const known = new Map(tags.map((tag) => [tag.slug, tag]));

  return async function sort(post: PostToSort): Promise<SortOutcome> {
    const result = await generateStructured({
      model,
      config,
      schema: verdictSchema,
      schemaName: "radar_verdict",
      schemaDescription: "Whether the post asks for a product, its category, what it wants, and its tags",
      system,
      prompt: buildUserPrompt(post),
    });
    if (result.status !== "ok") return result;
    return { status: "sorted", verdict: result.object, tagging: tagging(result.object, known), call: result.call };
  };
}
