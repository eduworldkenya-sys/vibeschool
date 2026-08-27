-- Integrate the legacy national discovery directory with the governed public school explorer.
-- Discovery rows remain explicitly non-canonical and cannot make verified claims.

create or replace function public.schools_directory_search_public_v1(
  p_query text default null,
  p_county text default null,
  p_sub_county text default null,
  p_level text default null,
  p_limit integer default 100
)
returns table (
  directory_id uuid,
  school_name text,
  county text,
  sub_county text,
  school_level text,
  ownership_type text,
  knec_code text,
  latitude numeric,
  longitude numeric,
  is_verified boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d.id as directory_id,
    d.name as school_name,
    d.county,
    d.sub_county,
    d.type as school_level,
    d.status as ownership_type,
    d.knec_code,
    d.latitude,
    d.longitude,
    coalesce(d.is_verified, false) as is_verified
  from public.schools_directory d
  where
    (p_query is null or btrim(p_query) = '' or d.name ilike '%' || btrim(p_query) || '%')
    and (p_county is null or btrim(p_county) = '' or lower(d.county) = lower(btrim(p_county)))
    and (p_sub_county is null or btrim(p_sub_county) = '' or lower(d.sub_county) = lower(btrim(p_sub_county)))
    and (
      p_level is null or btrim(p_level) = '' or
      case upper(btrim(p_level))
        when 'PRIMARY' then lower(coalesce(d.type,'')) like '%primary%'
        when 'JUNIOR' then lower(coalesce(d.type,'')) like '%junior%'
        when 'SENIOR_SECONDARY' then (lower(coalesce(d.type,'')) like '%secondary%' or lower(coalesce(d.type,'')) like '%senior%')
        else lower(coalesce(d.type,'')) = lower(btrim(p_level))
      end
    )
  order by
    case when p_query is not null and lower(d.name) = lower(btrim(p_query)) then 0 else 1 end,
    d.name asc
  limit least(greatest(coalesce(p_limit,100),1),200);
$$;

revoke all on function public.schools_directory_search_public_v1(text,text,text,text,integer) from public;
grant execute on function public.schools_directory_search_public_v1(text,text,text,text,integer) to anon, authenticated;

comment on function public.schools_directory_search_public_v1(text,text,text,text,integer)
is 'Read-only public discovery projection over schools_directory. Results are discovery records, never canonical verification authority.';
