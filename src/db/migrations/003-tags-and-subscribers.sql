-- US-456. Tags, finer than a category, and the people who follow them by email.

-- A thing a seller sells ("standing-desks"), or the product a buyer wants to
-- leave ("alt-hubspot"). The listed tags come from src/sort/tags.ts and are
-- shown from the start; a tag the model proposes waits here, hidden, until
-- enough posts carry it. The slug is a URL and a subscription, so it never
-- changes. The name may.
create table tags (
  slug text primary key,
  name text not null,
  category text not null,
  kind text not null default 'product' check (kind in ('product', 'alt')),
  shown_at timestamptz,
  created_at timestamptz not null default now()
);

-- Every tag a kept post carries, shown or not, so a proposal's count is a
-- query and not a counter to keep in step.
alter table requests add column tags text[] not null default '{}';
create index requests_tags_idx on requests using gin (tags) where removed_at is null;
create index requests_found_idx on requests (found_at) where removed_at is null;

-- An address gets the confirmation email and nothing else until somebody
-- clicks the link in it. `pending_tags` are the tags asked for and not yet
-- confirmed: a stranger who types your address can send you one email, not
-- change what you get.
create table subscribers (
  id bigserial primary key,
  email text not null unique,
  token text not null unique,
  tags text[] not null default '{}',
  pending_tags text[] not null default '{}',
  ip_hash text not null,
  created_at timestamptz not null default now(),
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  -- The end of the last daily window handled, sent or empty: the next email
  -- holds the posts found after it.
  covered_until timestamptz
);

create index subscribers_ip_idx on subscribers (ip_hash, created_at);
