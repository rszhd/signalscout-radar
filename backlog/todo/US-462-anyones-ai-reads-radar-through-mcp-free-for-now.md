---
id: US-462
title: Anyone's AI reads Radar through MCP, free for now
type: feature
priority: p2
created: 2026-10-26T20:07+08:00
parent: US-416
area: radar
resolution:
---

## Context

The owner wants people to give their own Claude or ChatGPT access to read
Radar's data (owner, 2026-10-26). Both apps connect to remote MCP servers,
so one server at `radar.buyerfinder.run/mcp` serves both: a person adds one
URL as a connector and their AI searches the stored product requests.

**Free first, premium later.** Access is free and needs no sign-in for now;
it becomes a premium plan once Radar holds enough data (owner, 2026-10-26).
So this ticket builds the server without sign-in, and the later premium
ticket adds sign-in in front of the same tools.

**Tools, not SQL.** The AI calls a fixed set of tools, each one a query we
wrote. Raw SQL would expose `subscribers` and `runs`, allow any slow query,
and make the schema a public contract. The tools read `requests` only, and
never a removed post.

**The model runs on the caller's side.** A tool call costs us one Postgres
query and no model call; the caller's AI does the reading and the
reasoning.

## Acceptance

- [ ] `/mcp` on the web service answers MCP over streamable HTTP, built
      with the official TypeScript SDK, with no sign-in
- [ ] Tools: `search_requests` (text, category, tag, platform, date range),
      `get_request` (one by id), `list_categories` (with counts),
      `trends` (requests per category or tag over time); each tool's
      description says what it returns, and a test checks every schema
- [ ] The tools query through a Postgres role that can only select from
      `requests` (and `tags`), and every query skips `removed_at`
- [ ] No author is returned, the same rule as the page
- [ ] A cap on calls per IP per day and on rows per call, so one caller
      cannot read the whole table in a loop
- [ ] The tools sit behind one access check that lets every call through
      today, so premium adds sign-in there without changing a tool
- [ ] The About page says the MCP URL exists and how to add it
- [ ] Connected and used from claude.ai and from ChatGPT, shown locally to
      the owner before the push

## Notes

- Premium, later and the owner's: sign-in (the claude.ai and ChatGPT
  connector forms offered OAuth or no sign-in on 2026-10-26; check their
  docs then), the price, how a subscriber pays, and the plan's name.
- Open, the owner's: whether Reddit's and X's terms allow access to
  excerpts of their posts through an API, free or paid. Not read yet; no
  claim made either way.
- Since 2026-10-26 Radar keeps requests older than 30 days (owner); the
  page, feeds and tag pages still show only the last 30 (`shownDays` in
  `src/db/queries.ts`). The tools may reach further back. The About page
  and footer say "nothing older than 30 days": that stays true for the
  page, and the About page must say what MCP reaches.

## Log
