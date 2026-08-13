-- School Directory V2
-- Institution identity is separate from teaching level. This supports
-- primary, junior, senior secondary and combined institutions without
-- creating duplicate schools for each level.

create table if not exists public.school_levels (
  school_id uuid not null references public.schools(id) on delete cascade,
  level text not null check (level in ('PRE_PRIMARY','PRIMARY','JUNIOR','SENIOR_SECONDARY','PREVOCATIONAL','SNE')),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (school_id, level)
);

create table if not exists public.school_aliases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  alias text not null,
  alias_normalized text not null,
  source text not null default 'manual',
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists school_aliases_unique_idx on public.school_aliases (school_id, alias_normalized);
create index if not exists school_aliases_search_idx on public.school_aliases using gin (alias_normalized gin_trgm_ops);
create index if not exists schools_name_trgm_idx on public.schools using gin (name_normalized gin_trgm_ops);
create index if not exists schools_county_subcounty_idx on public.schools (county, sub_county);
create index if not exists schools_coords_idx on public.schools (gps_lat, gps_lng);

alter table public.schools add column if not exists ownership_type text;
alter table public.schools add column if not exists accommodation_type text;
alter table public.schools add column if not exists gender_type text;
alter table public.schools add column if not exists cluster text;
alter table public.schools add column if not exists directory_source text default 'manual';
alter table public.schools add column if not exists directory_source_ref text;
alter table public.schools add column if not exists location_precision text;
alter table public.schools add column if not exists last_verified_at timestamptz;

update public.schools
set name_normalized = lower(regexp_replace(trim(name), '[^a-z0-9]+', ' ', 'gi'))
where name_normalized is null or name_normalized = '';

insert into public.school_levels (school_id, level, source)
select id, 'PRIMARY', 'legacy'
from public.schools
where deleted_at is null and lower(coalesce(school_category,'')) like '%primary%'
on conflict do nothing;

-- Safe directory surface: onboarding can discover schools without exposing
-- private school administration fields through the existing schools table.
drop view if exists public.school_directory_public;
create view public.school_directory_public as
select
  s.id, s.name, s.county, s.sub_county, s.ward,
  s.school_type, s.school_category, s.ownership_type,
  s.gender_type, s.accommodation_type, s.knec_code, s.nemis_code,
  s.gps_lat, s.gps_lng,
  coalesce((select array_agg(sl.level order by sl.level)
            from public.school_levels sl where sl.school_id = s.id), '{}') as levels
from public.schools s
where s.deleted_at is null;

revoke all on public.school_directory_public from public, anon;
grant select on public.school_directory_public to authenticated;

create or replace function public.search_school_directory(
  p_query text default null,
  p_level text default null,
  p_county text default null,
  p_sub_county text default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_limit integer default 12
)
returns table (
  id uuid, name text, county text, sub_county text, ward text,
  school_type text, school_category text, ownership_type text,
  gender_type text, accommodation_type text, knec_code text,
  nemis_code text, gps_lat numeric, gps_lng numeric, levels text[],
  match_score real, distance_km numeric
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select lower(regexp_replace(coalesce(p_query,''), '[^a-z0-9]+', ' ', 'gi')) as text
  ), candidates as (
    select d.*,
      greatest(
        extensions.similarity(lower(regexp_replace(d.name,'[^a-z0-9]+',' ','gi')), q.text),
        coalesce((select max(extensions.similarity(sa.alias_normalized,q.text))
                  from public.school_aliases sa where sa.school_id=d.id), 0)
      )::real as match_score,
      case when p_lat is not null and p_lng is not null
        and d.gps_lat is not null and d.gps_lng is not null then
        6371*2*asin(sqrt(
          power(sin(radians(d.gps_lat-p_lat)/2),2) +
          cos(radians(p_lat))*cos(radians(d.gps_lat))*
          power(sin(radians(d.gps_lng-p_lng)/2),2)
        ))
      end as distance_km
    from public.school_directory_public d cross join q
    where (p_level is null or p_level = any(d.levels))
      and (p_county is null or lower(coalesce(d.county,'')) = lower(p_county))
      and (p_sub_county is null or lower(coalesce(d.sub_county,'')) = lower(p_sub_county))
  )
  select id,name,county,sub_county,ward,school_type,school_category,
    ownership_type,gender_type,accommodation_type,knec_code,nemis_code,
    gps_lat,gps_lng,levels,match_score,distance_km
  from candidates
  where trim(coalesce(p_query,'')) = '' or match_score >= 0.12
  order by match_score desc,
    case when distance_km is null then 999999 else distance_km end asc,
    name asc
  limit least(greatest(coalesce(p_limit,12),1),30);
$$;

revoke all on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) from public, anon;
grant execute on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) to authenticated;

-- Source/provenance registry for national directory imports and future reconciliation.
create table if not exists public.school_directory_sources (
  school_id uuid not null references public.schools(id) on delete cascade,
  source_name text not null,
  source_ref text,
  source_url text,
  observed_name text,
  observed_county text,
  observed_sub_county text,
  observed_lat numeric,
  observed_lng numeric,
  observed_at timestamptz not null default now(),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  primary key (school_id, source_name, source_ref)
);

create index if not exists school_directory_sources_ref_idx
  on public.school_directory_sources(source_name, source_ref);
