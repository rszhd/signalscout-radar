---
id: US-559
title: Radar finds Facebook posts by keyword, not from a group list
type: feature
priority: p2
created: 2026-11-10T13:29+08:00
parent: US-518
area: radar
resolution:
---

## Context

Radar's Facebook plan reads the groups it copies from BuyerFinder's known
list (US-518, US-547). The owner decided on 2026-11-10 that BuyerFinder and
Radar stop reading that list. Facebook posts are found by keyword through
Google instead (signalscout-open US-557).

Radar has no product, so its keywords are its buyer phrases, the ones the
Reddit keyword search uses ("which should I buy", "can anyone recommend",
"is it worth buying"). Searched as `<phrase> site:facebook.com/groups` for
the past day, a phrase of that kind found mostly buyer questions in the
2026-11-10 tests (3D printers: about 25 in 30), while a product word found
mostly sale listings.

Facebook is off today: since 2026-11-10 `RADAR_PLATFORMS` is the Reddit
keyword search alone, at $0.30 a day. Turning Facebook on, and its share of
the money, stay the owner's choice.

## Acceptance

- [x] The Facebook plan searches by keyword with the Reddit search terms, through the engine's keyword mode: one page a term, the past day, no text filter (`phrasesSkipFilter`).
- [x] The worker no longer reads `GET /admin/api/groups`; `RADAR_GROUPS_URL`, `RADAR_GROUPS_TOKEN`, the copy step and the group-page log (`facebook-log.ts`) are gone.
- [x] A Facebook post shows its group the way pages show a place today: the table's name, else the fallback `groupName` already gives.
- [x] `pnpm phrases` ranks the Facebook phrases with the others (it reads `phrase_stats`, which the run writes per platform and phrase).
- [x] The plan stays off unless `RADAR_PLATFORMS` names it.
- [x] Engine released with US-557 (0.28.0), and `@signalscout/engine` bumped here.
- [ ] The push waits for the owner's word, and the worker's pause rule (stop it after the deploy if paused) is followed.

## Notes

- Depends on signalscout-open US-557 and an engine release.
- `radar_known_groups` (migration 006) may stay for group names, or go; decide with BuyerFinder's US-558.

## Log

- 2026-11-10T13:29+08:00 — Written after the owner's decision.
- 2026-11-10T14:14+08:00 — Built, uncommitted: it needs the engine's `pagesPerPhrase`, so it ships with the release. A full read keeps the search's title, because a Facebook post read whole has none. Typecheck and 170 tests pass against signalscout-open 37fcc89 (the engine linked by hand, link restored). Facebook keeps its 0.6 weight: with `RADAR_PLATFORMS=reddit,facebook` and $0.30 a day it would take about 87% of the money, so the owner sets the weights when turning it on.
- 2026-11-10 — Owner: "0.3 on reddit, 0.3 on facebook", and a Facebook backfill of the last 3 days. Facebook now weighs 0.09, as the Reddit terms do, so a $0.60 day splits evenly; `RADAR_DAILY_CAP_USD=0.6` and `RADAR_PLATFORMS=reddit,facebook` go in the box `.env` (the owner's edit). `--backfill=facebook` searches the past week, 5 pages a term, and drops a result Google dates before three days ago (`dropBeforeSince`): Google has no three-day window. 171 tests pass.
- 2026-11-10T15:09+08:00 — Pushed (0eed483, 4dc2a08) and deployed; the owner set the box `.env`. `--backfill=facebook` ran 14:56 to about 15:00 on the box: 273 new posts, 53 requests kept, provider $0.1655, model $0 (Claude bridge). Kept by term: is it worth buying 20, best alternative to 11, which should I buy 11, upgrade from my 8, buying advice 1, can anyone recommend 1, looking for recommendations 1. The run wrote `done` but the process did not exit, so the `docker exec` stayed open (the earlier Reddit backfill did the same).
- 2026-11-10 — Why three terms kept 1 each, by title (Google in the owner's Chrome, past week, 2 pages each, free): "can anyone recommend" 20 of 20 were local services or places (plumber, hairdresser, accountant, tutor, chiropractor, driver, a winery); "looking for recommendations" the same (coach, IT services, doctors, summer camps, a photographer); "buying advice" was home and car buying (first home, mortgage, second-hand car). "is it worth buying", the control, was products (a PS5, a gardening book, a gadget). On Facebook these phrases are asked in town groups, and Radar keeps physical products only.
- 2026-11-10T17:12+08:00 — Owner: "yes drop them for facebook". Facebook searches the other four terms (`facebookTerms`); Reddit keeps all seven.
- 2026-11-10T17:46+08:00 — Owner: 3 pages a term a run (was 1), because Google ranks by relevance and every run saw much the same first page. 12 credits a run, about $0.18 a day before the full reads. Check after a day: what pages 2 and 3 add in `phrase_stats.fetched`.
