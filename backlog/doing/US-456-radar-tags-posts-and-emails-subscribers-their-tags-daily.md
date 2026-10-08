---
id: US-456
title: Radar tags posts and emails subscribers their tags daily
type: feature
priority: p1
created: 2026-10-08T12:20+08:00
parent: US-416
area: radar
resolution:
---

## Context

A category is too broad to follow: "Home office" holds desks, chairs, mice and
monitor arms. The owner wants specific tags on every post, as many as
possible, and a way for a visitor to follow tags by email (owner,
2026-10-08): pick one or more tags, enter an address, get one email a day
with the new posts under those tags.

**The reader is a seller.** The owner wants this useful for businesses and
people selling something (2026-10-08): a tag is a thing someone sells, and
the email is a list of buyers to answer, not a newsletter. So a tag names a
product type a seller would recognise as theirs ("standing desks", "password
managers"), and each post in the email carries what the buyer wants — budget,
use, what they replace — with a link to answer it while it is fresh.

**Tags come from the same sort call.** Since US-455 the sort runs on the
owner's Claude subscription, so tagging in the call that already decides
the category adds output tokens, not money or calls. The model gives 1–3
tags per kept post.

**A closed list per category, drawn from real posts.** A subscription needs
tags that keep their name: free tags drift ("crm", "CRM software",
"crm-tool") and a subscriber to one misses the others. So each category
gets its own list, written from the `wants` lines already stored, the way
US-414 drew the categories. The model may also propose a tag that is not on
the list; a proposal is stored, not shown, and joins the list once enough
posts carry it. This is how the list grows without drift.

**"Alternative to" tags.** A post that names a product the author wants to
leave ("alternative to HubSpot") is a lead for every competitor of that
product. A product named often enough gets its own tag, `alt-<product>`,
grown the same way as proposed tags (owner, 2026-10-08).

**Each tag is a page too.** `/t/<slug>` lists the tag's posts, like a
category page, so a search for "people asking which standing desk to buy"
can land on a page that holds only that.

## Acceptance

- [x] Every offered category has a tag list drawn from stored posts; each
      tag has a slug that never changes and a name that may
- [x] The sort returns 1–3 tags from the post's category list, and any
      proposed new tag; a test checks the schema and the prompt
- [x] Kept posts store their tags; a proposed tag is counted, not shown
- [x] The sort names the product a post wants to leave, if any; a product
      named often enough becomes an `alt-<product>` tag
- [ ] Stored posts get tags once, by a script, in batches the owner sized
- [x] `/t/<slug>` lists a tag's posts; each category page links its tags;
      the sitemap lists every tag with posts
- [x] A visitor picks tags, enters an address and gets a confirmation
      email; no email is sent to an address that was not confirmed
- [x] Once a day, each confirmed subscriber gets one email with the posts
      found since the last email under their tags; no posts, no email
- [x] Each post in the email shows its tag, platform, age, the `wants`
      line and a link to the post; the email ends with one line to
      SignalScout for posts about the seller's own product
- [x] Every email has a one-click unsubscribe link and the
      `List-Unsubscribe` headers; unsubscribing needs no login
- [x] The subscribe form refuses floods: one address, one pending
      confirmation, a limit per IP
- [ ] Shown locally to the owner before the push

## Notes

- Mail: copy BuyerFinder's `src/lib/email.ts` and SMTP settings. The box
  reaches Resend on 2465 only.
- The sender address and its DNS records (Resend domain) are the owner's.
- The About page names what is stored for a subscriber: the address, the
  tags, and when it confirmed.
- The daily email goes out at 08:00 UTC for everyone (owner, 2026-10-08).
- Business services are back on (owner, 2026-10-08), with their own tags.
- Open: how many stored posts the back-fill covers, and the sender address.

## Log
- 2026-10-08T12:39+08:00 — Built locally, not committed. Migration 003
  (`tags`, `requests.tags`, `subscribers`); the listed tags in
  `src/sort/tags.ts`, about 170 over 25 categories, a first draft checked
  against the 387 local posts of 2026-09-25 and to be redrawn from
  production's `wants` lines. The sort returns tags, a new tag and the
  product left; proposals are stored hidden and shown at 5 live posts.
  Subscribe form on category and tag pages and `/subscribe`; confirm, change
  tags and unsubscribe pages; daily email after the first run from 08:00 UTC.
  Astro's origin check moved to `src/middleware.ts` so a mail app's one-click
  unsubscribe (no Origin) is not refused. 91 tests pass, typecheck and build
  clean. Against Mailpit: confirmation sent, a GET changes nothing, a foreign
  POST is 403, the daily email carries the List-Unsubscribe headers, the
  one-click POST unsubscribes. The digest preview used 4 local posts tagged
  by hand; no model call was made. `scripts/tag-stored.ts` is written, not run.
- 2026-10-08T12:46+08:00 — The owner said yes to the sample, turned services
  back on and left the rest to me; push and box edits stay theirs. Tag list
  redrawn from the 1,204 posts in the public category feeds (no production
  read): 280 tags over all 35 categories, services included, none shared.
  Sample: 40 of those posts, one or two per category, Sonnet through a local
  bridge on the owner's login: 40 answered, none failed, median 4.9 s, longest
  10.7 s. Read by hand: the tags fit; 8 named a product left, 2 wrongly (an
  owned bottle brand, an outgrown coat); 10 proposed a new tag, 2 already
  covered ("Power banks" under chargers) because the prompt listed slugs
  only. The prompt now lists each slug with its name and narrows "leaving";
  the 8 weak cases re-run (8 calls): 7 right, the bottle brand still named.
  A call now reads about 7,000 tokens, against 4,800 with slugs only. No
  service post was in the sample: services were off while the feeds filled.
  The form, its nav link, `/subscribe` and the About section hide while the
  web service has no SMTP_HOST and SMTP_FROM, so a push before the box's
  .env has them shows only the tags. 90 tests pass, 1 skipped (services-off).
