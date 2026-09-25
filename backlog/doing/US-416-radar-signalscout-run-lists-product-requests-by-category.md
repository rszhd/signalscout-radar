---
id: US-416
title: radar.signalscout.run lists product requests by category
type: feature
priority: p1
created: 2026-09-25T22:57+08:00
parent:
area: radar
resolution:
---

## Context

**The page is the marketing.** One page per category, so a search for "people
asking for a CRM recommendation" or "people asking which standing desk to buy"
can land on one. Each item shows the category, the platform, a short excerpt,
the age and a link to the post. Never the author's name, never the whole post.

Each category page ends with one line to SignalScout: the posts about your own
product, as they appear.

It looks like SignalScout: the same brand as the landing and the app.

Reddit is included. If Reddit or an author objects, their posts come down; this
is not the main product (owner, 2026-09-25).

## Acceptance

- [ ] `radar.signalscout.run` serves an index page and one page per category
      from the US-415 table
- [ ] It is served on `ssh journeys` through the same Traefik as the cloud
      stacks, on `EDGE_NETWORK`
- [x] No page contains an author name or handle; a test checks the rendered HTML
- [x] Each page has a title and description a search engine can use, and a
      sitemap lists every category page
- [ ] Deploy is by push, like the cloud stacks

## Notes

- The DNS record for `radar.signalscout.run` is the owner's to add.
- Brand: `packages/ui` in the open repository.

## Log
- 2026-09-25T23:44+08:00 — The page reads the US-415 tables: home, one page per category (404
  for an unknown one), About with the removal link, `sitemap.xml`,
  `robots.txt`, `/api/health`. Astro in server mode with the Node adapter,
  cached 5 minutes. No author column exists, and `excerptOf` strips handles;
  its test checks that, not the rendered HTML. The production compose file
  (Postgres, a one-shot migrate, web, worker) ran locally under another
  project name with fake keys: migrate first, web healthy, home page served,
  worker skipped each failed search. Left for the owner: the GitHub repo and
  its deploy secrets, the DNS record, and the box's `.env`.
