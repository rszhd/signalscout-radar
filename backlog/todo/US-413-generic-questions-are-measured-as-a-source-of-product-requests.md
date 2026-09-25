---
id: US-413
title: Generic questions are measured as a source of product requests
type: spike
priority: p1
created: 2026-09-25T22:57+08:00
parent:
area: radar
resolution:
---

## Context

**Radar lives or dies on one number: of the posts a generic question returns,
how many really ask for a product?** A product is anything a person can pick:
software, an app, a gadget, a piece of gear (owner, 2026-09-25). Nothing has
measured it. In SignalScout a
query carries a topic, and the classifier finds the intent. Radar has no topic,
so the question words must do the searching — `can someone recommend`, `what do
you all use for`, `which one should I buy`. That is the opposite of what the
engine's query rules were written for.

The repository already records that searches match loosely. On Reddit,
`end to end tests keep breaking` returned r/AllFinraExams and r/islam because
the provider matched `test` and `end` as single words (`platforms.ts`, US-022).
On X, the same phrase unquoted returned anime and Bitcoin, and quoted returned
nothing (US-006). A generic question may therefore return mostly noise, or a
good stream. This ticket finds out before anything is built on it.

The budget is **$2 a day**, providers and models together (owner, 2026-09-25).
The measurement decides how many queries and how many runs a day fit in it.

## Acceptance

- [ ] The phrases cover both software and things people buy, so the Log can
      say which kind each platform returns
- [ ] Five to eight generic phrases are run once each on the six platforms
      the engine has — Reddit, X, LinkedIn, YouTube, TikTok and Instagram —
      through `@signalscout/engine` connectors, and each answer is saved as a
      fixture with authors scrubbed
- [ ] On YouTube, TikTok and Instagram the request is in the comments, so the
      Log gives the cost with comments read, not only the search
- [ ] Every post is read and marked by hand: asks for a product, or not
- [ ] The Log gives, per platform and per phrase: posts returned, posts that
      ask for a product, provider cost, and cost per useful post
- [ ] The Log states which platforms and phrases go into US-415, and how many
      runs a day $2 buys with them
- [ ] If no platform reaches a useful rate, the Log says so and Radar stops here

## Notes

- Connectors run without a database: see the engine README, *Connectors*.
- Only the engine's six platforms; no Hacker News (owner, 2026-09-25).
- An Instagram comment is the dearest item the engine fetches, about
  $0.0027 (`docs/costs.md` in the open repository). It may not fit $2 a day.
- X's word limit is 4 (`platforms.ts`); the phrases must fit it.
- The spend of this spike is a few cents to about a dollar. Ask the owner
  before the first paid call.

## Log
