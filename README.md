# SignalScout Radar

A free public page of people asking which product to use or buy, sorted by
category. A product here is anything a person can pick: software, an app, a
gadget, a piece of gear. It lives at **radar.signalscout.run**.

Every hour a worker searches Reddit and X for posts like *"can anyone
recommend…"*, *"what do you use…"* or *"is it worth buying…"*. A free text rule
sets most of them aside. One cheap model call per remaining post decides whether
it really asks for a product, which category the product is in, and what the
person wants. The page lists what survives: the category, the platform, a short
excerpt, the age and a link to the post. Never a name or a handle.

It is also a demonstration. The fetching and the model calls are
[`@signalscout/engine`](https://www.npmjs.com/package/@signalscout/engine),
used on its own with no account, no monitor and no product profile. If you want
only the posts about *your* product, that is what
[SignalScout](https://signalscout.run) does.

## Limits it keeps

- **$2 a day**, providers and models together. The worker checks the price of
  every call before it makes it, and the day's spend is read from the database.
- **An excerpt and a link.** No username, no handle, no copied post, nothing
  older than 30 days.
- **Taken down on request.** A removed post is marked, not deleted, so the next
  run cannot put it back.

## Running it

```bash
docker compose up -d        # Radar's own Postgres on 127.0.0.1:5439
cp .env.example .env        # fill in the keys; DATABASE_URL=postgres://radar:radar@127.0.0.1:5439/radar
pnpm migrate
pnpm worker                 # a run every hour; add --once for one run
pnpm dev                    # the page on http://localhost:4321
pnpm test                   # needs the Postgres above
```

A push to `main` tests, builds one image and deploys it by digest to the box
(`.github/workflows/deploy.yml`, `scripts/deploy-remote.sh`).

## Backlog

Tickets share one id series with `signalscout-open` and `signalscout-cloud`,
and follow the rules in the open repository's
[`backlog/README.md`](https://github.com/rszhd/signalscout/blob/main/backlog/README.md).
