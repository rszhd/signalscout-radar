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
- **Budget $1 a day, half Reddit, half forums** (the owner first said $0.5,
  then $0.75, then "up the budget to $1 daily, 50-50 between reddit and
  forums"). `RADAR_DAILY_CAP_USD` is the owner's edit on the box.
- **8 forums an hour, threads started in the last 3 days** (owner, 2026-11-03,
  after the live run: "A, accept threads started in the last 3 days").
- **Physical goods only**: "remove software and hiring/service for now and
  focus on physical goods for niche small business". `softwareEnabled` and
  `servicesEnabled` are false; the software subreddits are gone; the forum
  niches about hosting, SEO, programming, selling online, small business,
  money, property and travel are left out (164 forums, 44 niches).
- **Filter**: "add the best/vs phrases, ensure the filters are good and
  optimized for physical products".

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
- [x] One local run measured against the Browser Use balance.
- [x] Filter tuned on 219 + 223 real forum posts; software and services off.
- [ ] Owner viewed the local page; box `.env` has the forum keys; pushed on
      the owner's word.

## Log

- 2026-11-03 11:47 +08: built. Forums take 75% of each run, first in the
  list; Reddit plans 10% each, plus what forums leave. A cut post's thread
  page is read only after the model keeps it. 107 tests pass; typecheck,
  build and the worker image's imports pass. Not run against live forums yet.
- 2026-11-03 12:07 +08: live run of one turn (12 forums, `forumsForTurn`
  498243): 10 feeds gave 219 posts (consimworld and thehulltruth none), all
  through the browser, 0 Bright Data units. Old filter passed 7 (2 requests);
  the new title and buying phrases pass 33 of 219, and 46 of 223 BuyerFinder
  forum posts (was 12). Model (Claude bridge) kept 15 of 33; 12 were cut
  posts: 4 complete and kept, 7 started before the 48-hour window, 1
  Bright Data 502. 5 saved. Engine estimate $0.0184 for the 12 pages; Browser
  Use balance $0.3136 -> $0.2931 for 24 browsers (not settled; the proxy's
  own charge is not in it). home-barista.com's feed listed replies
  (`feed.php`); Radar's copy now reads `feed.php?mode=topics`, not yet
  checked live. 20 goods subreddits probed (one page each, $0.038): 7 added.
