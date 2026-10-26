---
id: US-462
title: Premium subscribers let their AI read Radar through MCP
type: feature
priority: p2
created: 2026-10-26T20:07+08:00
parent: US-416
area: radar
resolution:
---

## Context

The owner wants a premium plan where a subscriber gives their own Claude or
ChatGPT access to read Radar's data (owner, 2026-10-26). Both apps connect
to remote MCP servers, so one server at `radar.buyerfinder.run/mcp` serves
both: the subscriber adds one URL as a connector, signs in, and their AI
searches the stored product requests.

**Tools, not SQL.** The AI calls a fixed set of tools, each one a query we
wrote. Raw SQL would expose `subscribers` and `runs`, allow any slow query,
and make the schema a public contract. The tools read `requests` only, and
never a removed post.

**The model runs on the subscriber's side.** A tool call costs us one
Postgres query and no model call; the subscriber's AI does the reading and
the reasoning.

**Sign-in is OAuth.** As far as known on 2026-10-26, the claude.ai and
ChatGPT connector forms offer OAuth or no sign-in, not a pasted API key. A
paid plan therefore needs an OAuth server. Check both platforms' current
docs before building; this is the largest part of the work.

## Acceptance

- [ ] `/mcp` on the web service answers MCP over streamable HTTP, built
      with the official TypeScript SDK
- [ ] Tools: `search_requests` (text, category, tag, platform, date range),
      `get_request` (one by id), `list_categories` (with counts),
      `trends` (requests per category or tag over time); each tool's
      description says what it returns, and a test checks every schema
- [ ] The tools query through a Postgres role that can only select from
      `requests` (and `tags`), and every query skips `removed_at`
- [ ] No author is returned, the same rule as the page
- [ ] A subscriber signs in by OAuth from claude.ai and from ChatGPT; a
      call without a valid token, or from a lapsed subscriber, is refused
- [ ] Each subscriber has a cap on calls per day and rows per call
- [ ] Connected and used from claude.ai and from ChatGPT, shown locally to
      the owner before the push

## Notes

- Open, the owner's: the price, how a subscriber pays (Stripe, as in
  SignalScout?), and the plan's name.
- Open, the owner's: whether Reddit's and X's terms allow paid access to
  excerpts of their posts. Not read yet; no claim made either way.
- History: `forgetOld` (`src/db/queries.ts`) deletes requests older than 30
  days. Premium with history needs that rule changed; a back-fill (probe
  proposed 2026-10-26) waits on the same change.
- A cheaper first test of demand was offered: a premium CSV export or a
  filtered daily email, with no OAuth. The owner asked for this ticket.

## Log
