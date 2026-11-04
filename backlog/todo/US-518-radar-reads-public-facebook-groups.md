---
id: US-518
title: Radar reads public Facebook groups
type: feature
priority: p2
created: 2026-11-04T14:07+08:00
parent: US-516
area: radar
resolution:
---

## Context

The owner asked on 2026-11-04 to add Facebook to BuyerFinder and Radar, and
chose public groups only. A probe the same day read five public coffee gear
groups (`signalscout-open` US-516's Log): the owner groups held 2 to 4 posts
a day each, and about 1 owner post in 5 asked what to buy. A group made for
selling held only sellers' ads.

- **The connector is in the engine.** US-516 added the `facebook` platform
  and `createScrapeCreatorsFacebook({ pagesPerGroup })`. Radar needs an
  engine version that has it; that release is the owner's word. Radar
  already has `SCRAPECREATORS_API_KEY` for Reddit, so no new key.
- **Groups come from BuyerFinder's list** (US-517), as Radar's forums come
  from BuyerFinder's forum list: goods niches only, no firearms, owner groups
  only, no buy/sell groups.
- **Rotate like forums.** Each run reads the next few groups from different
  niches, so every niche gets turns evenly (US-511's `forumsForTurn`).
- **The free phrase filter first**, then the model, as for Reddit and forums.
- **No author names.** The connector returns the author's name; Radar drops
  it. Excerpt and link only, as for every source here.
- **A post shows with the group's name** and a Facebook badge.

**Open decision for the owner:** Facebook's share of the $1 a day.
Today it is half Reddit, half forums (US-511).

## Cost

Each group costs at least 1 credit ($0.00188) a read, even with no new
post; a page holds 3 or 4 posts. Estimate, from the probe's 2 to 4 posts a
day per group: one page a read.

| Groups an hour | Credits a day | Cost a day |
|---|---|---|
| 2 | ~48 | ~$0.09 |
| 4 | ~96 | ~$0.18 |
| 8 | ~192 | ~$0.36 |

4 an hour from a list of 24 groups reads each group every 6 hours, which a
group with 2 to 4 posts a day fills in one page. The model's cost is on top,
after the free filter. Not measured on Radar yet.

## Done when

- [ ] Radar runs on an engine version that has US-516.
- [ ] A Facebook plan reads the decided number of groups an hour, rotating
      through the niches; its credits count in `runs` and in the cap.
- [ ] Posts pass the phrase filter and the model as forum posts do; a
      firearms group or post is refused.
- [ ] A Facebook post shows with the group's name, on the page, the emails,
      RSS and MCP, with no author name anywhere.
- [ ] A group the provider calls unavailable is skipped with a log line and
      costs nothing.
- [ ] One local run measured against the ScrapeCreators balance.
- [ ] Owner viewed the local page; pushed on the owner's word.

## Log

- 2026-11-04T14:07+08:00 — Written, on the owner's request.
