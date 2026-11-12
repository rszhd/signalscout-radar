---
id: US-569
title: Radar shows only Reddit posts a small shop can answer, and hides MCP for now
type: feature
priority: p2
created: 2026-11-12T10:48+08:00
parent: US-561
area: radar
resolution:
---

## Context

The owner wants to market Radar to small businesses too (2026-11-12). Its
page should hold only posts a small shop could answer, Reddit's alone, and
MCP should be hidden for now: "hide facebook and others as well, reddit
only".

Each kept post has carried a seller-fit answer since US-561 (deployed
2026-11-11). Posts sorted before it have none. On 2026-11-12, 4,497 Reddit
posts of the 30 shown days had none; the owner chose to judge only the last
7 days' (the page counts a week) and hide the rest.

## Acceptance

- [x] One file holds the switches (`src/lib/visibility.ts`): shown platforms (Reddit), fit only, MCP off. They hide and never delete.
- [x] Every public list uses one rule (`src/db/shown.ts`): the home feed and its counts, category and tag pages, trends, RSS, the daily emails, and which proposed tags become shown. The admin counts (niches, subreddits) and the tag clean-up still see every kept post.
- [x] The feed has no platform tabs with one platform; the home, category, tag, trends, subscribe, RSS and about wording names Reddit alone and the small-shop check.
- [x] The MCP page and `/mcp` answer 404, and the menu, about page and sitemap leave MCP out. The MCP role may read `seller_fit` (migration 011), for when it comes back.
- [x] `scripts/judge-fit.ts` judges Reddit alone by default and is in the image.
- [x] Every card shows its category and its shown tags, products first, each a link to its page (owner, 2026-11-12), the category page's cards too.
- [ ] Seen locally by the owner before the push.
- [ ] After the deploy: `docker exec signalscout-radar-worker-1 node scripts/judge-fit.ts --limit 2000 --days 7` on the box, one call per post through the bridge.

## Notes
