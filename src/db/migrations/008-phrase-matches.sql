-- A post two phrases find counts for both (owner, 2026-11-10). `fetched`
-- and `kept` count a post only for the first phrase that finds it, because a
-- seen post is never read or sorted again. `found` counts every post a
-- phrase's search returned, and `matched` those of them that are kept
-- requests, whichever phrase kept them. Neither adds to the run's totals.
alter table phrase_stats add column found integer not null default 0;
alter table phrase_stats add column matched integer not null default 0;
