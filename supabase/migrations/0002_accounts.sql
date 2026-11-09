-- Optional accounts (Supabase Auth: Google OAuth or email + password, email confirmation disabled).
-- Every row belongs to one user and is only visible to that user (RLS).

create table if not exists public.saved_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  created_at  timestamptz not null default now(),
  unique (user_id, lat, lon)
);

create table if not exists public.saved_schools (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  school_id    text not null check (char_length(school_id) between 3 and 40),
  school_name  text not null check (char_length(school_name) between 1 and 160),
  leaid        text,
  lat          double precision not null,
  lon          double precision not null,
  created_at   timestamptz not null default now(),
  unique (user_id, school_id)
);

create table if not exists public.school_calendars (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  school_id   text not null,
  ics_url     text not null check (ics_url ~ '^https://' and char_length(ics_url) <= 1000),
  created_at  timestamptz not null default now(),
  unique (user_id, school_id)
);

create table if not exists public.notification_prefs (
  user_id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  closure_threshold   int not null default 60 check (closure_threshold between 10 and 100),
  snow_threshold_in   numeric(4,1) not null default 2.0 check (snow_threshold_in between 0.5 and 48),
  notify_official     boolean not null default true,
  enabled             boolean not null default true,
  updated_at          timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://'),
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Written by the server (service role) to avoid duplicate notifications.
create table if not exists public.notification_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  target_key  text not null,
  kind        text not null,
  local_date  date not null,
  sent_at     timestamptz not null default now(),
  unique (user_id, target_key, kind, local_date)
);

do $$
declare t text;
begin
  foreach t in array array['saved_locations','saved_schools','school_calendars','notification_prefs','push_subscriptions','notification_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner read" on public.%I', t);
    execute format('create policy "owner read" on public.%I for select to authenticated using (user_id = auth.uid())', t);
  end loop;
  foreach t in array array['saved_locations','saved_schools','school_calendars','notification_prefs','push_subscriptions'] loop
    execute format('drop policy if exists "owner write" on public.%I', t);
    execute format('create policy "owner write" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  grant select on public.notification_log to authenticated;
end $$;
