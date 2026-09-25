---
id: US-413
title: Generic questions are measured as a source of product requests
type: spike
priority: p1
created: 2026-09-25T22:57+08:00
parent:
area: radar
resolution: shipped
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

- [x] The phrases cover both software and things people buy, so the Log can
      say which kind each platform returns
- [x] Five to eight generic phrases are run once each on the six platforms
      the engine has — Reddit, X, LinkedIn, YouTube, TikTok and Instagram —
      through `@signalscout/engine` connectors, and each answer is saved as a
      fixture with authors scrubbed
- [x] On YouTube, TikTok and Instagram the request is in the comments, so the
      Log gives the cost with comments read, not only the search
- [x] Every post is read and marked by hand: asks for a product, or not
- [x] The Log gives, per platform and per phrase: posts returned, posts that
      ask for a product, provider cost, and cost per useful post
- [x] The Log states which platforms and phrases go into US-415, and how many
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
- 2026-09-25T23:24+08:00 — Ran `scripts/measure.ts` once, with the cloud's
  local keys: 8 phrases on Reddit, X and LinkedIn; 4 on YouTube and TikTok
  with the comments of 2 videos each; 3 on Instagram with 1 video each.
  Estimated spend $0.75, from the connector prices. Fixtures in
  `fixtures/us-413/`, no authors, kept out of git: the repository is public
  and they hold other people's posts in full. Every item read and marked by hand:

  | Platform | Items | Ask for a product | Rate | Cost | Per useful item |
  |---|---|---|---|---|---|
  | Reddit (ScrapeCreators) | 49 | 4 | 8% | $0.013 | $0.0033 |
  | X (SocialData) | 159 | 11 (+4 books, albums, films) | 7% | $0.032 | $0.0029 |
  | LinkedIn (HarvestAPI) | 183 | 1 | 0.5% | $0.032 | $0.032 |
  | YouTube (ScrapeCreators) | 101 comments | 0 | 0% | $0.019 | — |
  | TikTok (ScrapeCreators) | 80 comments | 3, weak | 4% | $0.023 | $0.0075 |
  | Instagram (SocialCrawl) | 0 comments | — | — | $0.63 | — |

  Reddit's search matched single words (an ALEKS test, a breakup, a porch).
  LinkedIn returned job posts and thought pieces. Comments under YouTube and
  TikTok videos *answer* the video; they do not ask. Instagram returned no
  comment for $0.63; the cause is not checked. Reddit's "looking for
  recommendations" search failed with a provider 500.

  On X the phrases differ: "looking for recommendations" 4 of 20, "what do
  you use" 3 of 19, "any suggestions for" 2 of 20, "can anyone recommend" 1
  (+2 media) of 20; "which should I buy", "is it worth buying" and "anyone
  know a good" 0 of 20 each.

  **A free text filter does most of the work.** Keeping only items that hold
  a question mark and a request phrase (recommend, suggestion, alternative to,
  what app/tool/device do you use, which one should I buy, any app for,
  anyone know a) keeps 30 of 159 on X with 9 of the 11 requests, and 6 of 49
  on Reddit with 3 of 4. The model then reads a fifth of the items.

  **Volume is not the limit; money is.** One X page of 20 took 0.1 to 3.3
  hours of posting, so every phrase has more than a day's budget of posts.
  A cheap model call costs about $0.0001, so provider cost decides: about
  $0.003 per real request on X or Reddit, which is 600 or more a day at $2.

  **Decision for US-415: X and Reddit only.** LinkedIn, YouTube, TikTok and
  Instagram do not produce requests from a generic question. The owner
  asked for the six platforms; this result goes to the owner before
  US-415 drops four of them. Phrases for X: the four above that found
  requests.

- 2026-09-26T02:36+08:00 — **Correction: Instagram's $0.63 above is an engine
  estimate five times too high.** The engine counts a SocialCrawl comment page
  at 25 credits instead of 5 (signalscout-open BUG-427); by the provider's
  price list the Instagram part cost about $0.15. And "no comment came back"
  was the connector, not Instagram: it drops every comment because the
  provider now sends `post_id` as the reel's shortcode (BUG-426). US-425 in
  signalscout-open read the same reels' comments at three providers.
