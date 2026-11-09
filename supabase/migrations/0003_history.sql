-- Verified official closure history and our own prediction log (for calibration).
create table if not exists public.closure_events (
  id           bigserial primary key,
  leaid        text not null,
  district     text not null,
  school_day   date not null,
  status       text not null check (status in ('closed', 'delayed')),
  source_url   text not null,
  evidence     text not null,
  origin       text not null check (origin in ('verifier', 'district-archive')),
  verified_at  timestamptz not null default now(),
  unique (leaid, school_day, status)
);
create index if not exists closure_events_leaid_idx on public.closure_events (leaid, school_day desc);

create table if not exists public.prediction_log (
  id           bigserial primary key,
  leaid        text not null,
  school_day   date not null,
  closure_pct  int not null check (closure_pct between 0 and 100),
  delay_pct    int not null check (delay_pct between 0 and 100),
  model        text not null default 'snowday-v1',
  created_at   timestamptz not null default now(),
  unique (leaid, school_day)
);

alter table public.closure_events enable row level security;
alter table public.prediction_log enable row level security;
drop policy if exists "history is public" on public.closure_events;
create policy "history is public" on public.closure_events for select to anon, authenticated using (true);
drop policy if exists "predictions are public" on public.prediction_log;
create policy "predictions are public" on public.prediction_log for select to anon, authenticated using (true);
grant select on public.closure_events, public.prediction_log to anon, authenticated;
