# SignalScout Radar

A free public page of people asking which product to use or buy, sorted by
category. A product here is anything a person can pick: software, an app, a
gadget, a piece of gear. It lives at **radar.signalscout.run**.

Every few hours a worker searches Reddit, X, LinkedIn, YouTube, TikTok and
Instagram for posts and comments like *"can anyone recommend…"*, *"what do you all use for…"* or *"which one
should I buy…"*. One cheap model call per post decides whether it really asks
for a product, and which category the product is in. The page lists what
survives: the category, the platform, a short excerpt, the age and a link to
the post. Never the author's name.

It is also a demonstration. The fetching and the model calls are
[`@signalscout/engine`](https://www.npmjs.com/package/@signalscout/engine),
used on its own with no account, no monitor and no product profile. If you want
only the posts about *your* product, that is what
[SignalScout](https://signalscout.run) does.

## Limits it keeps

- **$2 a day**, providers and models together. The worker stops at the cap.
- **An excerpt and a link, no username, no copied post.** A post deleted at the
  source disappears here on the next run.
- **Taken down on request.** A platform or an author who asks gets their posts
  removed.

## Backlog

Tickets share one id series with `signalscout-open` and `signalscout-cloud`,
and follow the rules in the open repository's
[`backlog/README.md`](https://github.com/rszhd/signalscout/blob/main/backlog/README.md).
