---
id: US-561
title: Radar marks the posts a small seller can answer, and counts them by niche for BuyerFinder's admin
type: feature
priority: p2
created: 2026-11-11T06:45+08:00
parent: US-456
area: radar
resolution:
---

## Context

The owner asked on 2026-11-11 whether the categories that top Radar are the
niches where BuyerFinder will find most of its customers. They are not, as
Radar stands: a count of buyer posts is not a count of sellers who would pay.
Reddit's buying phrases favour gadgets ("iPhone 16 or Pixel 10?"), where big
brands sell and a small shop has nothing to say.

The owner's decision: Radar becomes the indicator of which niche BuyerFinder
should focus on to find its customers. Steps chosen (owner, 2026-11-11):

1. Each sorted post gets a yes/no: can a small independent seller answer it
   with a product of their own? Same model call, no new one.
2. Niches are ranked by those posts, by product tag (a tag such as "dog
   harnesses" is a niche; a category such as "Pets" is too broad).
3. The ranking stays off Radar's public page and public repo output. It is
   shown on BuyerFinder's admin page (owner's choice), read from Radar with a
   token. BuyerFinder side: US-562.
4. Later: put BuyerFinder's own figures (searches, leads per 100 posts,
   paying users) beside each niche.

## Acceptance

- [x] The sorter's verdict has `sellerFit`, and the prompt says what it means; a brand- or model-locked question is no, an open need a small shop can fill is yes.
- [x] `requests.seller_fit` stores it (null for posts sorted before this change).
- [x] `GET /api/niches` returns, per product tag, posts, fit posts and judged posts for a span, for the `RADAR_NICHES_TOKEN` bearer only; unset or wrong, it is a 404.
- [x] `scripts/judge-fit.ts` can mark stored posts, with `--limit` and `--dry-run`; running it on production is the owner's call (it goes through the Claude bridge, one call a post).
- [x] The web service passes `RADAR_NICHES_TOKEN` from the box `.env`.
- [x] The prompt fixes for the two wrong answers below (owner, 2026-11-11). Judged again with the fixed prompt: the camper floor is fit, the peptide dose is not.
- [ ] The push waits for the owner's word, and the worker's pause rule is followed (paused by the owner 2026-11-11).

## Notes

2026-11-11, dry run of `scripts/judge-fit.ts` on the 40 newest local posts of
the last 90 days, `claude-sonnet-5-5` through a local bridge, nothing
written: 10 fit, 30 not, 0 failed. 30 of 40 were cars, phones, computers,
cameras and big appliances, which the search phrases bring in. Three posts
were stored twice and were judged the same both times.

Two answers look wrong:
- "Repair material for a rotted camper floor" was no; a small RV-supply
  seller could answer it. Proposed: a part, supply or repair material is fit
  even for a big-brand product.
- "Best peptide for loose belly skin, and the dose" was fit. Proposed: a
  drug, peptide or dose question is never fit.

The built server on a fresh database answered 404 without the token and
with a wrong one, and the expected counts with it.
