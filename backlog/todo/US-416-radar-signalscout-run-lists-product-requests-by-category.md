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
- [ ] No page contains an author name or handle; a test checks the rendered HTML
- [ ] Each page has a title and description a search engine can use, and a
      sitemap lists every category page
- [ ] Deploy is by push, like the cloud stacks

## Notes

- The DNS record for `radar.signalscout.run` is the owner's to add.
- Brand: `packages/ui` in the open repository.

## Log
