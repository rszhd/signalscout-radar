---
id: US-511
title: Radar reads forums and stops reading X
type: feature
priority: p1
created: 2026-11-03T11:39+08:00
parent: US-416
area: radar
resolution:
---

## Context

The owner asked on 2026-11-03: "update radar to also include forums,
disable X". Answers given the same day:

- **12 forums, every hour, from BuyerFinder's whole list** (191 forums in 52
  niches, the feed survey of 2026-11-01): "by default it uses existing
  forums list, and rotate every hour", then "12 forums from different niche
  hourly, so all niche can get evenly". Each run takes the next 12 niches,
  each at its next forum: a niche every ~4.3 hours.
- **Browser Use with our proxy first**, Bright Data after a browser failure
  (BuyerFinder's `LOOKOUT_FORUM_FETCHER=browser`).
- **The free phrase filter first**, as for X and the Reddit keyword search.
  Most forum threads are not product requests.
- **X posts are hidden at once**, on the page, the emails, RSS and MCP.
- **Budget $0.75 a day** (was $1), so Reddit gets what the forums leave.
  `RADAR_DAILY_CAP_USD` is the owner's edit on the box.

## Cost

One feed read is one call: one browser, one page. Estimate, as in
BuyerFinder's `estimateBrowserMicros`: one minute of browser time ($0.02 an
hour) and 1 MB through the proxy at $0.20 + $1 a GB, about $0.0015. 12 an
hour is about $0.43 a day. Not measured for feed pages yet; the first local
run measures it against the Browser Use balance.

A XenForo feed dates a thread by its newest reply and cuts the first post.
Such a post comes as a partial post. Radar opens the thread page of each one
the model keeps (one more browser call), so the date and text are the
thread's own, and drops a thread older than the plan's window.

## Done when

- [x] Engine 0.24.1 (zod 4.6.7 with it); suite passes.
- [x] A forum plan of 12 feeds, hourly, its cost from the browser counted in
      `runs` and in the cap.
- [x] X plan removed; `SOCIALCRAWL_API_KEY` no longer required.
- [x] X posts hidden from page, emails, RSS, MCP (migration 005 sets
      `removed_at` to 2026-11-03 00:00 UTC on X rows); copy says Reddit and forums.
- [x] Forum posts show with the forum's name.
- [ ] One local run measured against the Browser Use balance.
- [ ] Owner viewed the local page; box `.env` has the forum keys; pushed on
      the owner's word.

## Log

- 2026-11-03 11:47 +08: built. Forums take 75% of each run, first in the
  list; Reddit plans 10% each, plus what forums leave. A cut post's thread
  page is read only after the model keeps it. 107 tests pass; typecheck,
  build and the worker image's imports pass. Not run against live forums yet.
