---
id: US-463
title: Radar shows trends in what people ask for
type: feature
priority: p2
created: 2026-10-26T20:30+08:00
parent: US-416
area: radar
resolution:
---

## Context

The owner wants an insight and trend page with charts and statistics
(owner, 2026-10-26). The stats below were proposed in chat the same day;
the owner asked for this ticket without choosing among them, so the order
is the proposal's, and the owner may change it.

Every stat uses fields Radar already stores: `category`, `tags`,
`platform`, `channel`, `posted_at`, and the `alt-<product>` tags from
US-456. The reader is a seller, as in US-456: each chart links to the tag
or category page that holds the posts behind it.

**First, on `/trends`:**

1. **Products people want to leave.** Requests per `alt-<product>` tag:
   each post is a buyer for every competitor of that product. The main
   chart.
2. **Fastest-growing tags.** Requests per tag this week against last week,
   only for tags with enough posts to mean something. `categoryCounts`
   already does this per category.
3. **Most-requested categories and tags**, over the last 7 and 30 days.

**Then, on each tag page:**

4. **Where people ask:** the subreddits and the platform behind the tag.
5. **When people ask:** requests by weekday and hour, UTC.

**Later, each its own decision:**

6. **New tags:** proposals that reached the shown limit this week.
7. **Budgets:** the `wants` line often states one, as free text. A chart
   needs the sort to return a budget field, from the same call.

**The counts show where Radar looks, not the market.** The worker gives
60% of each run to software and X, and reads chosen subreddits only. So a
chart compares shares within what Radar read, and says so on the page,
instead of ranking raw totals across sources as if they were demand.

## Acceptance

- [ ] `/trends` shows stats 1, 2 and 3; each bar or row links to its tag
      or category page
- [ ] Each tag page shows stats 4 and 5 for that tag
- [ ] A tag or product with too few posts is left out of the growth and
      "leave" charts; the minimum is written in the code, with the reason
- [ ] Each chart says it counts the posts Radar read, and the page says
      where Radar reads
- [ ] Charts are drawn on the server (no chart script needed to read
      them), work at phone width, and read in light and dark
- [ ] The queries are tested on a test database, with fixed dates
- [ ] `/trends` is in the menu and the sitemap
- [ ] Shown locally to the owner before the push

## Notes

- Since 2026-10-26 old requests are kept (`shownDays` in
  `src/db/queries.ts`), so trends can reach back past 30 days as the data
  grows. Open, the owner's: whether a chart may count posts older than 30
  days. A count shows no post, but the About page says "nothing older than
  30 days".
- The same queries can serve the `trends` tool of US-462.
- Stat 7 changes the sort's output: it is a scan behaviour change, so the
  test is shown to the owner before the push.

## Log
