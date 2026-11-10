-- A backfill run (`--backfill`) has its own budget and does not count against
-- the day's cap: at $0.30 a day, one 3-day backfill would otherwise leave the
-- hourly runs nothing until midnight UTC (2026-11-10).
alter table runs add column backfill boolean not null default false;
