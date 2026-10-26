-- US-462. What an AI reads through /mcp, and how often it may ask.

-- The tools run inside a read-only transaction as this role, so a bug in a
-- tool's query can read the shown columns of two tables and nothing else:
-- no subscriber, no run, no phrase. Roles belong to the whole server, not to
-- one database, so a second database (each test makes one) finds it there.
do $$
begin
  create role radar_reader nologin;
exception
  -- Two migrations at once (parallel test files) can race to unique_violation.
  when duplicate_object or unique_violation then null;
end $$;

grant usage on schema public to radar_reader;
grant select (id, platform, url, channel, title, excerpt, wants, category, posted_at, tags, removed_at)
  on requests to radar_reader;
grant select (slug, name, category, kind, shown_at) on tags to radar_reader;

-- Tool calls per hashed IP per UTC day. Access is free and needs no sign-in,
-- so this is the only thing that stops one caller from reading in a loop.
create table mcp_calls (
  ip_hash text not null,
  day date not null,
  calls integer not null default 0,
  primary key (ip_hash, day)
);
