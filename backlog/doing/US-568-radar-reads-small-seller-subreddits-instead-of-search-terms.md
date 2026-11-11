---
id: US-568
title: Radar reads 29 small-seller subreddits beside the Reddit search terms
type: feature
priority: p2
created: 2026-11-11T16:29+08:00
parent: US-561
area: radar
resolution:
---

## Context

Radar is to show which niches BuyerFinder should look for customers in
(US-561, owner 2026-11-11). The seven Reddit search terms ("is it worth
buying", "which should I buy") bring mostly car, phone and laptop questions:
in a 40-post dry run, 30 were questions only big brands answer. The owner:
"search subreddits directly instead of using keywords".

A survey on 2026-11-11 read one page of 60 candidate subreddits (60
ScrapeCreators credits) and judged up to five kept posts of each for seller
fit (231 calls through a local Claude bridge). Estimated fit posts a day:
ABraThatFits ~39, Equestrian ~18, sewing ~14, CatAdvice ~12, BuyItForLife ~9,
guitarpedals ~8, flashlight ~8, Aquariums ~7, DogAdvice ~7, houseplants ~7,
PlantedTank ~6.5, SkincareAddiction ~6, knitting ~4.5, Celiac ~4,
bettafish ~4; then 1 to 3 a day: pourover, shrimptank, puppy101, 4Runner,
fpv, minipainting, FlyFishing, reptiles, Fishing, synthesizers, Homebrewing,
BackYardChickens, smoking, bikepacking. The owner agreed to these 29.

A rough guide only: five judged posts a subreddit, and some "fit" answers
were advice questions.

## Acceptance

- [x] The subreddit plan reads the 29, ten to a search, ordered so each search holds about the same posts a day.
- [x] The list lives in a `subreddits` table (migration 010, seeded with the 29), so the owner adds and removes from BuyerFinder's admin page with no deploy (owner, 2026-11-11). The worker reads it at the start of each run; `readingOrder` spreads the busy ones by their kept posts of the last 7 days, a new one at the median.
- [x] `POST /api/subreddits` adds or removes, for the `RADAR_NICHES_TOKEN` bearer only; `GET /api/niches` returns the list's week and the subreddits outside it that the search terms found, most fit posts first.
- [x] Both on (owner, 2026-11-11): `RADAR_PLATFORMS` defaults to `reddit,subreddits`; the search terms $0.30 a day, the subreddits $0.20. The search terms also show which subreddits outside the list give fit posts, to add weekly. Plan weights are now the dollars a day chosen for each plan (Facebook $0.30, forums $0.60 kept).
- [ ] The owner sets `RADAR_DAILY_CAP_USD=0.5` in the box `.env`.
- [x] Pets covers horse tack, chicken and beekeeping supplies, and Cameras covers drones: in the survey, horse bits and beekeeping gloves were sorted "other", which Radar drops.
- [ ] The owner checks the box `.env`: `RADAR_PLATFORMS` unset or `reddit,subreddits`.
- [ ] The push waits for the owner's word; the worker is paused (owner, 2026-11-11), so it is stopped again after the deploy unless the owner says to start it.
- [ ] A week after it starts, rank the 29 by fit posts (`phrase = 'r/<name>'`) and drop the weak ones.

## Notes

Expected cost, from the survey's posts a day (about 1,440 for the 29): at a
run every three hours, three searches of about 60 posts each, three pages a
search, about 72 credits a day ($0.14), inside the subreddits' $0.20.
Model calls go through the box's Claude bridge. Subreddit posts skip the free
word filter (`channelInputs`, `filter: false`), so every one is sorted:
about 1,400 calls a day. (First written here as about 350, from the
survey's filtered rate; corrected the same day.)

Until a week of posts exists, every subreddit weighs the same, so the first
groups are by name, not by busyness. The busiest ten would be about 97 posts
in three hours, a little over a search's four pages.

Checked locally 2026-11-11: built Radar on a temporary database filled with
the survey's judged posts, BuyerFinder's built admin against it. Add, a
repeated add in another case, a bad name and Remove gave the right messages
and the right list; Radar's address answered 404 without the token.

Radar now shows only the niches on this list. A niche that is not on it
cannot rise in the ranking; adding one means a new survey line here.
