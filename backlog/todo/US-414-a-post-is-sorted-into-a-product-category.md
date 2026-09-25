---
id: US-414
title: A post is sorted into a product category
type: feature
priority: p1
created: 2026-09-25T22:57+08:00
parent:
area: radar
resolution:
---

## Context

**The engine's triage and classifier cannot do this job, because both ask
about a product.** Their prompts open with the product, the ideal customer and
the problem, and they answer "is this a lead for *this* product?". Radar has no
single product to match against. It asks two other questions: does this post
ask for a product, and which kind? A product is anything a person can pick —
software, an app, a gadget, a piece of gear — so the list spans both.

The answer is one `generateStructured` call per post with its own prompt and
schema, on a cheap model — the price class of the cloud's triage model. It
lives in this repository, not in the engine, until a second user needs it.

The category list is closed and short, so a category page has enough posts to
be worth indexing. A post that fits none is `other` and is not shown.

## Acceptance

- [x] The call returns `{ asksForProduct: boolean, category: <closed list>,
      wants: string }` and reports its `ModelCall` cost. `wants` is one line
      in plain words — what the person asks for — and the page shows it under
      the excerpt (the mockup's *Wants:* line)
- [x] Measured on the US-413 fixtures against the hand marks: the Log gives
      agreement on `asksForProduct`, and the share of posts put in `other`
- [x] The Log gives the cost per post, so US-415's cap is set from a number

## Notes

- `generateStructured` is exported by `@signalscout/engine` (`ai/call.ts`).
- The categories come from what US-413's posts actually ask for, not from a
  list written in advance.

## Log
- 2026-09-25T23:29+08:00 — `src/sort/`: a free phrase filter (`phrases.ts`), 26 categories
  drawn from the US-413 requests (`categories.ts`), and one
  `generateStructured` call (`categorize.ts`). Books, films and music are
  not requests: they help no SignalScout customer, and the prompt says so.
  `scripts/sort-fixtures.ts` on the US-413 X and Reddit fixtures, with the
  cloud's `deepseek-flash`: 39 calls, $0.011 estimated, about $0.0003 a
  call. On the 36 items the filter kept, the model agrees with the hand
  marks on 34. The two others: a custom-hat maker (model: a service, not a
  product — fair) and "which draft model for speculative decoding" (model:
  a request — right; the hand mark missed it). One request went to `other`
  (a microphone, a chair and lighting in one post). The `wants` lines read
  well, for example "Stackable heavy-duty plastic tool chest with multiple
  4”/100mm+ deep drawers".
