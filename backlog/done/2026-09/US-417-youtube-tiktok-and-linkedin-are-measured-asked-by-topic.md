---
id: US-417
title: YouTube, TikTok and LinkedIn are measured, asked by topic
type: spike
priority: p2
created: 2026-09-26T01:24+08:00
parent:
area: radar
resolution: shipped
---

## Context

**US-413 asked every platform the same generic question, and four of them
answered with nothing.** LinkedIn returned job posts, and the comments under
YouTube and TikTok videos answered the video instead of asking. The subreddits
then showed a better way in: go where the people who ask already are. This
spike asks the other three that way — YouTube and TikTok by topic, reading the
comments under review and setup videos, and LinkedIn with a request tied to a
category — before any of them is built into the worker.

Instagram is not measured again: US-413 paid $0.63 for no comment at all.

## Acceptance

- [x] About ten topic searches on YouTube and TikTok, with the comments of the
      top videos, and about ten narrow LinkedIn phrases, run once
- [x] Every item the model calls a request is read by hand, and a sample of
      the rest
- [x] The Log gives, per platform, the requests that hold up and the cost per
      request, against X and Reddit
- [x] The Log says which, if any, go into the worker

## Notes

- `scripts/measure-social.ts`. Fixtures in `fixtures/social/`, out of git
  like US-413's: other people's words in full.
- Sorted with `deepseek-flash` locally; production sorts with `gpt-6-luna`.

## Log

- 2026-09-26T01:24+08:00 — One run, $0.28 estimated ($0.11 providers,
  $0.17 model). The model read every item, because most real requests in
  comments fail the free text filter.

  | Platform | Items | Model said request | Hold up, read by hand | Cost per one that holds up |
  |---|---|---|---|---|
  | YouTube, 6 topics × 3 videos | 219 comments | 19 | 7 strong, 9 need the video to make sense, 3 wrong | about $0.015 |
  | TikTok, 5 topics × 3 videos | 155 comments | 15 | 0 | — |
  | LinkedIn, 8 phrases | 200 posts | 2 | 1 | about $0.09 |

  For scale: X and Reddit search about $0.003 a request, the good
  subreddits about $0.0007.

  YouTube's strong ones are real and specific: a field-service CRM like
  Housecall Pro, a note app with no AI, project-management software for
  mixed teams, headphones for road noise. The weak ones are follow-ups —
  "How about Tuleap?" — that say nothing without the video above them.
  TikTok's are "Where is the case from?" and "Links?": a viewer naming the
  item on screen, which no seller can answer. LinkedIn's narrow phrases did
  no better than US-413's generic ones.

  **Decision: none of the three goes into the worker now.** At $2 a day a
  dollar buys about 70 strong YouTube requests against 300 from search and
  1,400 from the good subreddits. YouTube may come back later with a small
  share and software-comparison topics only — three of its seven strong
  requests came from those.

- 2026-09-26T02:36+08:00 — **Correction: Instagram's $0.63 above is an engine
  estimate five times too high.** The engine counts a SocialCrawl comment page
  at 25 credits instead of 5 (signalscout-open BUG-427); by the provider's
  price list the Instagram part cost about $0.15. And "no comment came back"
  was the connector, not Instagram: it drops every comment because the
  provider now sends `post_id` as the reel's shortcode (BUG-426). US-425 in
  signalscout-open read the same reels' comments at three providers.
