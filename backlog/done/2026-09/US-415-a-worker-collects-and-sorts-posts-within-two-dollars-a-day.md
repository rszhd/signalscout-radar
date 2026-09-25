---
id: US-415
title: A worker collects and sorts posts within two dollars a day
type: feature
priority: p1
created: 2026-09-25T22:57+08:00
parent:
area: radar
resolution: shipped
---

## Context

**The worker runs the phrases US-413 kept, on a timer, and stops at $2 a day.**
The cloud pays for every call with its instance keys, and a generic query has
no natural limit, so the cap is correctness, not a feature. A run adds up the
cost each connector and each model call reports, and stops before a call that
would pass the day's remainder.

It uses the engine directly, not `@signalscout/pipeline`. The pipeline expects
an account, a project with a product profile, credits and notifications; its
similarity filter and classifier compare each post with a product, which Radar
does not have.

Storage is one table in its own Postgres: post URL, platform, excerpt, category,
posted time, found time. No author. A post seen before is not sorted twice.

## Acceptance

- [x] A run searches, removes posts already stored, sorts the rest (US-414)
      and writes the survivors
- [x] A test proves a run stops before the call that would pass $2 in one UTC
      day, with the day's spend read from the database
- [x] The day's spend and the posts kept are written for every run, so the
      page and the owner can read them
- [x] Posts older than 30 days are deleted

## Notes

- Runs on `ssh journeys` in its own compose project, beside the cloud stacks,
  with its own Postgres container.
- The keys are the cloud's instance keys, set in this stack's own `.env` on
  the box by the owner.

## Log
- 2026-09-25T23:44+08:00 — `src/worker/run.ts` and `main.ts`, with `src/db/`. X (SocialData,
  4 phrases, up to 10 pages) and Reddit (ScrapeCreators, 6 phrases, up to 3
  pages), once an hour. Each paid call is checked at its worst case against
  the run's share of the day (the day's remainder over the runs still to
  come) before it is made. A failed search is logged and skipped, since
  US-413 saw a provider 500. Excerpts and titles lose every @handle and
  u/ name, X's entities and its t.co links. Tests: 11, on a real Postgres.
  One live run on the local database: 202 posts fetched, 74 past the free
  filter, 22 kept, $0.07 of a $0.22 share. Read by hand: 21 of 22 are real
  requests; "any suggestions for Proxy" probably is not.
