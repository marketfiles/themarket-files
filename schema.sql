-- Market Files database schema (Postgres 14+). Run with `npm run db:migrate`.
create table if not exists tm_events (
  id          text primary key,
  date        text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),   -- ISO date; text so years before 1000 work
  month       smallint not null check (month between 1 and 12),
  desk        text not null check (desk in ('wallst','then','global','btc','chain')),
  head        text not null check (char_length(head) <= 240),
  status      text not null default 'review' check (status in ('verified','review','pending')),
  summary     text not null default '',
  source      text not null default '',
  doc         text not null default '',
  url         text not null default '',
  link        text not null default '',          -- slug of a full Market Files article, if any
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tm_events_month_day on tm_events (month, (substring(date from 9 for 2)));
create index if not exists tm_events_date on tm_events (date);

create table if not exists newsletter_signups (
  email       text primary key,
  created_at  timestamptz not null default now()
);
