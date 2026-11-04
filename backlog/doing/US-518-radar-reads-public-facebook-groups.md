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

**Decided by the owner on 2026-11-05:** the cap goes from $1 to $1.50 a
day, "add facebook to radar, set daily limit to $1.50". The split is in
thirds, so Reddit and forums keep their $0.50 each and Facebook gets the new
$0.50. The thirds are my reading; the owner named only the total.

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

- [x] Radar runs on an engine version that has US-516.
- [x] A Facebook plan reads the decided number of groups an hour, rotating
      through the niches; its credits count in `runs` and in the cap.
- [x] Posts pass the phrase filter and the model as forum posts do; a
      firearms group or post is refused.
- [x] A Facebook post shows with the group's name, on the page, the emails,
      RSS and MCP, with no author name anywhere.
- [x] A group the provider calls unavailable is skipped with a log line and
      costs nothing.
- [x] One local run measured against the ScrapeCreators balance.
- [ ] `RADAR_DAILY_CAP_USD=1.5` in the box `.env` (the owner's edit).
- [ ] Owner viewed the local page; pushed on the owner's word.

## Log

- 2026-11-04T14:07+08:00 — Written, on the owner's request.
- 2026-11-05T00:46+08:00 — Built. Engine 0.25.0. 131 groups copied from
  BuyerFinder (be48f23), without its personal finance, programming, travel
  and web hosting groups. 8 groups an hour from 8 niches through
  `forumsForTurn`, one page each, after Reddit and before the forums; shares
  0.35/1.5, 0.15/1.5, 1/3, 1/3. Pages, emails, RSS and MCP name the group;
  no author is stored. A connector read of one turn's 8 groups: 8 credits
  (balance 9,558 before), 30 posts, 3 past the phrase filter, 1 of them a
  clear request (RAM or CPU upgrade). Missed by the filter: an HVAC "anyone
  has this control board available?". Two of these posts are local test rows
  (phrase `local test US-518`), local DB only.
