---
id: US-429
title: Radar lists people asking to hire a business service
type: feature
priority: p1
created: 2026-09-26T03:14+08:00
parent:
area: radar
resolution:
---

## Context

**People who sell services are SignalScout's audience as much as people who
sell software, and Radar shows them nothing.** A post asking for "a web
designer for a small bakery" or "an agency to run our Google Ads" is sorted as
not a request, because the prompt counts products only. Leadverse's public
sample (leadverse.ai/reddit-leads) is mostly services: web design, AI
automation agencies, SEO, virtual assistants, paid ads.

The owner's decisions, 2026-09-26:

- **Business services only**: someone hired for work — an agency, a
  freelancer, a consultant, an accountant, a developer, a virtual assistant.
  Not local consumer services such as a plumber, a tutor or a restaurant.
- **Freelance and contract work counts; a full-time job ad does not.** A
  one-off gig is a sale for a freelancer or an agency; employment is
  recruiting.
- **The budget is set after measuring.** Services get a share of the $2 once
  their requests per dollar are known.

**Hiring posts carry contact details** — emails, phone numbers, Discord and
Telegram handles — more often than product questions do. The page promises no
names, so excerpts must drop them as they drop @handles.

## Acceptance

- [x] The sort prompt and schema accept a business service, with service
      categories beside the product ones, and still refuse employment and
      local consumer services
- [x] Hiring subreddits and service phrases are measured once on Reddit and
      X; every request the model keeps is read by hand, and a sample of the
      rest; the Log gives requests, cost and cost per request per input
- [x] Excerpts drop emails, phone numbers and chat handles; a test proves it
- [x] The inputs that pay are added to the worker with a share the Log
      justifies, and the page shows a "Services" group
- [ ] Deployed, and one production run's services requests read by hand

## Notes

- Sort step: `src/sort/categorize.ts`, `categories.ts`, `phrases.ts`.
- Probe cost estimate before running: about $0.20.

## Log

- 2026-09-26T03:23+08:00 — Sort step widened: `isRequest` replaces `asksForProduct`, nine service
  categories (kind `services`), and the prompt refuses full-time job ads,
  offers, local consumer services, and anything deceptive. Excerpts drop
  emails, phone numbers, chat links and handles; tests cover each.

  `scripts/measure-services.ts`, one run, $0.16 (engine estimate:
  providers $0.06, model $0.10). Every accepted item and every rejected
  post from the hiring subreddits read by hand.

  | Input | Posts | Requests | Of them services |
  |---|---|---|---|
  | r/forhire | 25 | 5 | 5 |
  | r/hiring | 25 | 3 | 3 |
  | r/slavelabour | 25 | 4 | 4 |
  | r/HireaWriter | 24 | 5 | 5 |
  | r/DesignJobs | 25 | 6 | 6 |
  | r/webdev | 24 | 7 | 3 (the rest products) |
  | r/Entrepreneur, r/startups, r/shopify, r/SEO | 24 each | 1–2 each | 0–1 each |
  | r/smallbusiness | 25 | 0 | 0 |
  | r/freelance_forhire | 0 | — | — |
  | 6 phrases on Reddit and 6 on X | 162 | 2 | 2 |

  **About three posts in four in the hiring subreddits are offers**
  ("[For Hire]", "[Offer]", "[Hire Me]"), and the model refused every one.
  `offersWork` now refuses them before the model, free, which should bring
  a hiring-subreddit request from about $0.0022 to about $0.0008. The
  requests kept are real and specific: a B2B copywriter at $15–25/hour, a
  medical-spa logo for about $25, a romance ghostwriter at $0.07/word. Full-
  time roles ($148k logistics, an $85–110k on-site designer) were refused.

  **Two were fraud and were accepted**: "Need a few Google reviews, €0.50
  each" and "Edit dates in a PDF and make it look real". With the new rule
  both are refused on a re-sort; a medical-spa logo and a ghostwriter are
  still kept. One real gig flipped to refused on the re-sort (the $15–25
  copywriter): the model varies on identical posts, so it is watched in
  production rather than tuned on one case.

  Keyword searches found 2 service requests in 162 posts: left out.

- 2026-09-26T03:43+08:00 — The five hiring subreddits go into the worker as their own plan,
  read every third hour with the other subreddits, one page each. Shares,
  agreed with the owner: software subreddits 20%, X 40%, services 10%,
  goods subreddits 20% (from 30%, a share rarely used up since the reads
  went to every third hour), Reddit keyword search 10%. Expected cost about
  $0.15 a day. r/webdev and the general business subreddits are left out.

