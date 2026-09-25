-- US-415. Radar's whole schema: what was seen, what was kept, what it cost.

-- Every post the worker has paid to fetch, kept or not. A post seen before is
-- not sent to the model again: the provider is already paid, the model is not.
create table seen_posts (
  platform text not null,
  external_id text not null,
  seen_at timestamptz not null default now(),
  primary key (platform, external_id)
);

-- A post that asks for a product. No author, ever: the page shows an excerpt
-- and a link, and a column that is not here cannot leak.
create table requests (
  id bigserial primary key,
  platform text not null,
  external_id text not null,
  url text not null,
  channel text,
  title text,
  excerpt text not null,
  wants text not null,
  category text not null,
  posted_at timestamptz not null,
  found_at timestamptz not null default now(),
  -- Set when somebody asked for the post to come down. Kept, not deleted, so
  -- the next run cannot put it back.
  removed_at timestamptz,
  unique (platform, external_id)
);

create index requests_category_posted_idx on requests (category, posted_at desc) where removed_at is null;
create index requests_posted_idx on requests (posted_at desc) where removed_at is null;

-- One row per run. The day's spend is the sum of these, so the $2 cap is read
-- from the database and survives a restart.
create table runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  provider_micros bigint not null default 0,
  model_micros bigint not null default 0,
  fetched integer not null default 0,
  filtered integer not null default 0,
  sorted integer not null default 0,
  kept integer not null default 0,
  -- Why the run ended: "done", "budget", or an error message.
  outcome text
);

create index runs_started_idx on runs (started_at);
