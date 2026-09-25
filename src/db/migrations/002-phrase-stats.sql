-- Which phrase earns its money. A phrase is searched on every run and paid for
-- on every run, so one that finds nothing costs as much as one that finds a
-- lot; this table is what tells them apart.

alter table requests add column phrase text;

create table phrase_stats (
  run_id bigint not null references runs (id) on delete cascade,
  platform text not null,
  phrase text not null,
  provider_micros bigint not null default 0,
  model_micros bigint not null default 0,
  fetched integer not null default 0,
  filtered integer not null default 0,
  kept integer not null default 0,
  errors integer not null default 0,
  primary key (run_id, platform, phrase)
);
