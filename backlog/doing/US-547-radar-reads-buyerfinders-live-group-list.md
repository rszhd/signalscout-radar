---
id: US-547
title: Radar reads BuyerFinder's live list of Facebook groups
type: feature
priority: p2
created: 2026-11-07T18:36+08:00
parent: US-518
area: radar
resolution:
---

## Context

BuyerFinder's known Facebook groups moved from a file into its database
(signalscout-lookout US-546), so a group its search keeps is read with no
deploy. The owner chose, 2026-11-07, that Radar uses that list too.

Radar's own database is not BuyerFinder's, so before each hourly run the
worker reads `GET https://admin.buyerfinder.run/admin/api/groups` with a
read-only token (`RADAR_GROUPS_TOKEN`) and writes the groups into
`radar_known_groups` (migration 006). It keeps only the niches Radar's
forums cover, as the old copy did: no personal finance, programming, travel
or web hosting group. A failed read, or one with no group left, leaves the
table as it was, so a BuyerFinder outage never empties Radar's list.

The web and the worker keep a copy of the table in memory, read again when
it is a minute old, so `groupName` and `placeOf` stay synchronous. Migration
006 seeds the table with the old file's groups, so Radar reads the same
groups as before until the token is set.

## Acceptance

- [x] Migration 006 creates the table with the old file's 131 groups
      (`known-groups.test.ts`).
- [ ] With the token set, an hourly run reads BuyerFinder's list, keeps
      only Radar's forum niches, and reads groups from it (seen live).
- [x] A failed read or an empty answer leaves the table as it was.
- [ ] Post pages, the feed and the emails still show each group's name
      (seen live).
- [x] Tests and the typecheck pass.

## Notes

Needs BuyerFinder US-546 deployed and `LOOKOUT_GROUPS_TOKEN` set there,
then the same value as `RADAR_GROUPS_TOKEN` in Radar's `.env`.

## Log

- 2026-11-07T18:38+08:00 — Built. 167 tests and the typecheck pass. A
  build in a separate worktree, on its own migrated local database: the
  home page and `/api/health` answer 200.
