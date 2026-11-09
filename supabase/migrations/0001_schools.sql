-- SnowDay school directory (NCES Common Core of Data + Private School Survey).
-- Loaded by `npm run import:nces`. Public read-only; writes only with the service role.

create extension if not exists pg_trgm;

create table if not exists public.districts (
  leaid        text primary key,                      -- NCES LEA ID (7 digits)
  name         text not null,
  state        char(2) not null,
  city         text,
  zip          text,
  phone        text,
  website      text,                                  -- official district website (NCES, with verified overrides)
  lea_type     text,
  updated_at   timestamptz not null default now()
);

create table if not exists public.schools (
  id             text primary key,                    -- 'pub-<NCESSCH>' or 'pvt-<PPIN>'
  ncessch        text unique,
  ppin           text unique,
  type           text not null check (type in ('public', 'private')),
  name           text not null,
  leaid          text references public.districts (leaid) on delete set null,
  district_name  text,
  street         text,
  city           text,
  state          char(2) not null,
  zip            text,
  county         text,
  lat            double precision not null check (lat between -90 and 90),
  lon            double precision not null check (lon between -180 and 180),
  locale         text,
  website        text,
  school_year    text,
  updated_at     timestamptz not null default now()
);

create index if not exists schools_name_trgm on public.schools using gin (name gin_trgm_ops);
create index if not exists schools_district_trgm on public.schools using gin (district_name gin_trgm_ops);
create index if not exists schools_city_trgm on public.schools using gin (city gin_trgm_ops);
create index if not exists schools_zip_idx on public.schools (zip);
create index if not exists schools_state_idx on public.schools (state);
create index if not exists schools_leaid_idx on public.schools (leaid);
create index if not exists schools_latlon_idx on public.schools (lat, lon);
create index if not exists districts_name_trgm on public.districts using gin (name gin_trgm_ops);

alter table public.schools enable row level security;
alter table public.districts enable row level security;
drop policy if exists "schools are public" on public.schools;
create policy "schools are public" on public.schools for select to anon, authenticated using (true);
drop policy if exists "districts are public" on public.districts;
create policy "districts are public" on public.districts for select to anon, authenticated using (true);

-- Fuzzy search across school name, district name and city, optionally filtered by state and ZIP.
create or replace function public.search_schools(q text, st text default null, zip_code text default null, lim int default 20)
returns table (
  id text, ncessch text, ppin text, type text, name text, leaid text, district_name text,
  street text, city text, state text, zip text, county text, lat double precision, lon double precision,
  locale text, website text, district_website text, score real
)
language sql stable
set search_path = public
set pg_trgm.word_similarity_threshold = 0.35
as $$
  with params as (select nullif(trim(q), '') as q, upper(nullif(trim(st), '')) as st, nullif(trim(zip_code), '') as zip)
  select s.id, s.ncessch, s.ppin, s.type, s.name, s.leaid, s.district_name, s.street, s.city, s.state::text, s.zip,
         s.county, s.lat, s.lon, s.locale, s.website, d.website as district_website,
         case when p.q is null then 1
              else greatest(word_similarity(p.q, s.name),
                            word_similarity(p.q, coalesce(s.district_name, '')) * 0.9,
                            case when s.city ilike p.q then 0.85 else 0 end)
         end::real as score
  from public.schools s
  cross join params p
  left join public.districts d on d.leaid = s.leaid
  where (p.st is null or s.state = p.st)
    and (p.zip is null or s.zip = p.zip)
    and (p.q is not null or p.zip is not null)
    and (
      p.q is null
      or s.name ilike '%' || p.q || '%'
      or s.district_name ilike '%' || p.q || '%'
      or s.city ilike p.q
      or p.q <% s.name
      or p.q <% coalesce(s.district_name, '')
    )
  order by score desc, s.name
  limit least(greatest(coalesce(lim, 20), 1), 50);
$$;

-- Schools within radius_km of a point, nearest first.
create or replace function public.schools_near(p_lat double precision, p_lon double precision, radius_km double precision default 10, lim int default 20)
returns table (
  id text, ncessch text, ppin text, type text, name text, leaid text, district_name text,
  street text, city text, state text, zip text, county text, lat double precision, lon double precision,
  locale text, website text, district_website text, distance_km double precision
)
language sql stable
set search_path = public
as $$
  select * from (
    select s.id, s.ncessch, s.ppin, s.type, s.name, s.leaid, s.district_name, s.street, s.city, s.state::text, s.zip,
           s.county, s.lat, s.lon, s.locale, s.website, d.website as district_website,
           6371 * 2 * asin(sqrt(
             power(sin(radians(s.lat - p_lat) / 2), 2) +
             cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lon - p_lon) / 2), 2)
           )) as distance_km
    from public.schools s
    left join public.districts d on d.leaid = s.leaid
    where s.lat between p_lat - radius_km / 111.0 and p_lat + radius_km / 111.0
      and s.lon between p_lon - radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.01))
                    and p_lon + radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.01))
  ) x
  where x.distance_km <= radius_km
  order by x.distance_km
  limit least(greatest(coalesce(lim, 20), 1), 100);
$$;

grant execute on function public.search_schools(text, text, text, int) to anon, authenticated;
grant execute on function public.schools_near(double precision, double precision, double precision, int) to anon, authenticated;
grant select on public.schools, public.districts to anon, authenticated;
