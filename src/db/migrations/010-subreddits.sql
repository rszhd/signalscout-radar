-- US-568. The subreddits Radar reads, kept here so the owner adds and removes
-- them from BuyerFinder's admin page without a deploy. The worker reads the
-- list at the start of each run. A name is unique whatever its case: Reddit
-- treats r/Aquariums and r/aquariums as one.
create table subreddits (
  name text primary key check (name ~ '^[A-Za-z0-9_]{2,21}$'),
  added_at timestamptz not null default now(),
  -- 'survey' for the first list (2026-11-11), 'admin' for one added from the page.
  added_by text not null default 'admin'
);

create unique index subreddits_name_lower_idx on subreddits (lower(name));

-- The 29 of the survey of 2026-11-11: about one fit post a day or more.
insert into subreddits (name, added_by) values
  ('bettafish', 'survey'), ('houseplants', 'survey'), ('guitarpedals', 'survey'), ('knitting', 'survey'),
  ('SkincareAddiction', 'survey'), ('fpv', 'survey'), ('synthesizers', 'survey'), ('BuyItForLife', 'survey'),
  ('FlyFishing', 'survey'), ('bikepacking', 'survey'), ('Aquariums', 'survey'), ('DogAdvice', 'survey'),
  ('ABraThatFits', 'survey'), ('Equestrian', 'survey'), ('minipainting', 'survey'), ('sewing', 'survey'),
  ('BackYardChickens', 'survey'), ('pourover', 'survey'), ('Fishing', 'survey'), ('Homebrewing', 'survey'),
  ('CatAdvice', 'survey'), ('shrimptank', 'survey'), ('puppy101', 'survey'), ('Celiac', 'survey'),
  ('PlantedTank', 'survey'), ('flashlight', 'survey'), ('reptiles', 'survey'), ('smoking', 'survey'),
  ('4Runner', 'survey');
