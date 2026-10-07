---
id: US-455
title: Radar sorts posts on the owner's Claude subscription
type: feature
priority: p1
created: 2026-10-07T13:35+08:00
parent: US-416
area: radar
resolution: shipped
---

## Context

The owner wants Radar on their Claude subscription, as BuyerFinder runs its
classifier (US-452). The owner chose a bridge of Radar's own over sharing
BuyerFinder's, and `claude-sonnet-5-5` as the sorting model.

`src/bridge` is a copy of BuyerFinder's bridge: one `claude -p` per request,
no tools, no MCP servers, no settings files, and a DeepSeek fallback under its
own daily budget. The engine needs no change: `AI_PROVIDER=ollama` sends the
sort to the bridge with the schema in the prompt and records it at no cost.

Two changes in the run. A free model (`worstSortMicros: 0`) sorts every post
a search fetched, even after the searches spent the run's money; before, each
batch waited for $0.002 a call that it would never spend. And a post whose
call failed stays unseen, so a usage limit does not lose a day of posts; a
later run sorts it while its search still reaches back that far.

## Acceptance

- [x] The bridge answers Radar's sorter: a fenced answer is sorted at no
      cost, a usage limit is a failed call, and a call the engine gives up on
      is stopped (`src/bridge/bridge.test.ts`).
- [x] A free model sorts past the run's money; a failed call leaves its post
      unseen (`src/worker/run.test.ts`).
- [x] The image builds with Claude Code 2.1.290, and the bridge starts in it.
- [x] A sample of stored posts is sorted by sonnet through the bridge and
      read by hand; the owner allowed the push without reading it.
- [x] Deployed; the token, the model lines and the fallback are set in the
      box's `.env`, and the worker and bridge restarted.
- [x] The first live run on the bridge is checked: sorted, kept, no failed
      calls.

## Notes

- The fallback's spend is outside `RADAR_DAILY_CAP_USD`. Its budget defaults
  to $1 a day here, against $10 in BuyerFinder.
- Radar and BuyerFinder share one subscription limit.
- `jsonFrom` here now mends Sonnet's stray `,"` and takes a corrected object.
  BuyerFinder's copy has neither; its classify on sonnet may lose calls the
  same way. Not measured there.

## Log

- 2026-10-07T13:35+08:00 Bridge, run changes, image and compose service built
  and tested locally; 65 tests pass, typecheck clean. Not committed.
- 2026-10-07T14:48+08:00 Sample: the 36 posts of `fixtures/us-413` that pass
  the free filter, sonnet through a local bridge on the owner's login, twice
  (72 calls, all answered). Median 4.2–4.4 s a call. 4 and 3 of 36 failed the
  engine's JSON parse: Sonnet ended the object with a stray `,"`, sometimes
  followed by "Correction:" and a good object. `jsonFrom` now handles both;
  all 7 broken answers parse. By hand the sorting reads right: job ads,
  books, films, a chip shop, parking and advice refused; headphones, a
  podcast app, an iPad drawing app, a car seat, a hat maker kept. 10–14 kept
  of 36 once the broken ones count. The owner said to allow all; committed.
- 2026-10-07T14:54+08:00 Deployed in 0839a77. The `.env` on the box now
  points the model at the bridge (backup `.env.before-us455`): Radar's
  DeepSeek key and prices moved to the BRIDGE_FALLBACK_* lines, the token is
  BuyerFinder's. Worker and bridge recreated; the bridge's start line names
  the fallback and the $1 budget.
- 2026-10-07T15:20+08:00 First live runs on the bridge. Run 291 (at the
  restart, 06:54 UTC): 135 fetched, 128 sorted, 98 kept. Run 292 (07:00 UTC):
  120 fetched, 29 sorted, 8 kept. The bridge answered all 157 calls with 200,
  none through the fallback; median 7.9 s with the wait under 1 ms, longest
  20 s. Each run stopped at its budget with $0.036 spent, all on searches.
  Not seen: how many answers the engine still rejected; the worker does not
  log it. Closed.
