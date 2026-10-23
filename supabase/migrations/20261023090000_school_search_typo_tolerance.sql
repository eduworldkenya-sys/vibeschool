-- Add typo-tolerant matching to the shared school directory search.
-- Search exact names/codes/verified aliases first; use close spelling matches only
-- when there are no direct matches. One edit per meaningful word is allowed.
-- This never creates aliases or changes school identity.
create extension if not exists fuzzystrmatch with schema extensions;
begin;

create or replace function public.search_school_directory(
  p_query text default null,
  p_level text default null,
  p_county text default null,
  p_sub_county text default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_limit integer default 30
)
returns table(
  id uuid,
  name text,
  county text,
  sub_county text,
  ward text,
  school_type text,
  school_category text,
  ownership_type text,
  gender_type text,
  accommodation_type text,
  cluster text,
  knec_code text,
  nemis_code text,
  gps_lat numeric,
  gps_lng numeric,
  levels text[],
  match_score real,
  distance_km numeric,
  source text
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $function$
with q as (
  select
    lower(regexp_replace(trim(coalesce(p_query,'')),'[^a-zA-Z0-9]+','','g')) n,
    lower(trim(coalesce(p_query,''))) raw
),
alias_matches as (
  select * from public.search_verified_school_aliases(p_query)
),
exact_search as (
  select
    exists (
      select 1 from public.schools s
      cross join q
      where s.deleted_at is null
        and s.status='active'
        and (p_county is null or lower(s.county)=lower(p_county))
        and (p_sub_county is null or lower(s.sub_county)=lower(p_sub_county))
        and (
          lower(s.name) like '%'||q.raw||'%'
          or (q.n<>'' and coalesce(s.name_normalized,'') like '%'||q.n||'%')
          or s.knec_code=trim(p_query)
          or s.nemis_code=trim(p_query)
          or exists(select 1 from alias_matches am where am.school_id=s.id)
        )
    )
    or exists (
      select 1 from public.schools_directory d
      cross join q
      where lower(coalesce(d.status,'active'))<>'closed'
        and (p_county is null or lower(d.county)=lower(p_county))
        and (p_sub_county is null or lower(d.sub_county)=lower(p_sub_county))
        and (
          lower(d.name) like '%'||q.raw||'%'
          or (q.n<>'' and lower(regexp_replace(d.name,'[^a-zA-Z0-9]+','','g')) like '%'||q.n||'%')
        )
        and not exists (
          select 1 from public.school_identity_candidates c
          where c.directory_school_id=d.id and c.status in ('matched','new')
        )
    ) as has_exact
  from q
),
canonical as (
  select
    s.id,s.name::text,s.county::text,s.sub_county::text,s.ward::text,
    s.school_type::text,s.school_category::text,s.ownership_type,s.gender_type,
    s.accommodation_type,s.cluster,s.knec_code::text,s.nemis_code::text,
    s.gps_lat,s.gps_lng,
    coalesce(array_agg(distinct sl.level) filter(where sl.level is not null),'{}'::text[]) levels,
    'CANONICAL'::text source,
    greatest(
      case
        when q.raw='' then .25
        when lower(s.name)=q.raw then 1.0
        when lower(s.name) like q.raw||'%' then .92
        when lower(s.name) like '%'||q.raw||'%' then .78
        when q.n<>'' and coalesce(s.name_normalized,'') like '%'||q.n||'%' then .78
        when not exact_search.has_exact and length(q.raw)>=4 and length(q.raw)<=80 then extensions.word_similarity(q.raw,coalesce(s.name_normalized,''))
        else 0
      end,
      coalesce((select max(am.confidence) from alias_matches am where am.school_id=s.id),0)
    )::real match_score
  from public.schools s
  cross join q
  cross join exact_search
  left join public.school_levels sl on sl.school_id=s.id
  where s.deleted_at is null
    and s.status='active'
    and (p_county is null or lower(s.county)=lower(p_county))
    and (p_sub_county is null or lower(s.sub_county)=lower(p_sub_county))
    and (
      q.raw=''
      or lower(s.name) like '%'||q.raw||'%'
      or (q.n<>'' and coalesce(s.name_normalized,'') like '%'||q.n||'%')
      or s.knec_code=trim(p_query)
      or s.nemis_code=trim(p_query)
      or exists(select 1 from alias_matches am where am.school_id=s.id)
      or (not exact_search.has_exact and length(q.raw)>=4 and length(q.raw)<=80 and exists (
          select 1 from regexp_split_to_table(q.raw,'[^a-z0-9]+') as qt(token)
          where length(qt.token)>=4
        )
        and not exists (
          select 1 from regexp_split_to_table(q.raw,'[^a-z0-9]+') as qt(token)
          where length(qt.token)>=4
            and not exists (
              select 1 from regexp_split_to_table(coalesce(s.name_normalized,''),'[^a-z0-9]+') as nt(token)
              where extensions.levenshtein_less_equal(lower(qt.token),lower(nt.token),1)<=1
            )
        ))
    )
  group by s.id,s.name,s.county,s.sub_county,s.ward,s.school_type,
    s.school_category,s.ownership_type,s.gender_type,s.accommodation_type,
    s.cluster,s.knec_code,s.nemis_code,s.gps_lat,s.gps_lng,q.raw,q.n,exact_search.has_exact
),
directory as (
  select
    d.id,d.name::text,d.county::text,d.sub_county::text,null::text ward,
    d.type::text school_type,null::text school_category,null::text ownership_type,
    null::text gender_type,null::text accommodation_type,null::text cluster,
    null::text knec_code,null::text nemis_code,
    d.latitude::numeric gps_lat,d.longitude::numeric gps_lng,
    case
      when lower(coalesce(d.type,'')) like '%junior%' then array['JUNIOR']::text[]
      when lower(coalesce(d.type,'')) like '%secondary%' or lower(coalesce(d.type,'')) like '%senior%' then array['SENIOR_SECONDARY']::text[]
      else array['PRIMARY']::text[]
    end levels,
    'DIRECTORY'::text source,
    greatest(
      case
        when q.raw='' then .2
        when lower(d.name)=q.raw then .9
        when lower(d.name) like q.raw||'%' then .82
        when lower(d.name) like '%'||q.raw||'%' then .70
        when q.n<>'' and lower(regexp_replace(d.name,'[^a-zA-Z0-9]+','','g')) like '%'||q.n||'%' then .72
        when not exact_search.has_exact and length(q.raw)>=4 and length(q.raw)<=80 then extensions.word_similarity(q.raw,d.name)
        else 0
      end
    )::real match_score
  from public.schools_directory d
  cross join q
  cross join exact_search
  where lower(coalesce(d.status,'active'))<>'closed'
    and (p_county is null or lower(d.county)=lower(p_county))
    and (p_sub_county is null or lower(d.sub_county)=lower(p_sub_county))
    and (
      q.raw=''
      or lower(d.name) like '%'||q.raw||'%'
      or (q.n<>'' and lower(regexp_replace(d.name,'[^a-zA-Z0-9]+','','g')) like '%'||q.n||'%')
      or (not exact_search.has_exact and length(q.raw)>=4 and length(q.raw)<=80         and exists (
          select 1 from regexp_split_to_table(q.raw,'[^a-z0-9]+') as qt(token)
          where length(qt.token)>=4
        )
        and not exists (
          select 1 from regexp_split_to_table(q.raw,'[^a-z0-9]+') as qt(token)
          where length(qt.token)>=4
            and not exists (
              select 1 from regexp_split_to_table(d.name,'[^a-z0-9]+') as nt(token)
              where extensions.levenshtein_less_equal(lower(qt.token),lower(nt.token),1)<=1
            )
        ))
    )
    and not exists(
      select 1 from public.school_identity_candidates c
      where c.directory_school_id=d.id and c.status in ('matched','new')
    )
),
scored as (
  select x.*,
    case
      when p_lat is not null and p_lng is not null and x.gps_lat is not null and x.gps_lng is not null then
        6371*2*asin(sqrt(
          power(sin(radians((x.gps_lat-p_lat)/2)),2)
          + cos(radians(p_lat))*cos(radians(x.gps_lat))*power(sin(radians((x.gps_lng-p_lng)/2)),2)
        ))
      else null
    end distance_km
  from (select * from canonical union all select * from directory) x
),
ranked as (
  select s.*,
    (s.match_score + case when s.distance_km is not null then greatest(0,.20-least(s.distance_km,100)/500.0) else 0 end)::real final_score
  from scored s
  where p_level is null or p_level=any(s.levels) or (p_level='JUNIOR' and 'PRIMARY'=any(s.levels))
)
select
  id,name,county,sub_county,ward,school_type,school_category,ownership_type,
  gender_type,accommodation_type,cluster,knec_code,nemis_code,gps_lat,gps_lng,
  levels,final_score,round(distance_km::numeric,2),source
from ranked
where p_query is null or match_score>0
order by final_score desc,distance_km nulls last,name
limit greatest(1,least(coalesce(p_limit,30),100));
$function$;

revoke all on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) from public, anon;
grant execute on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) to authenticated;

comment on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) is
'Authenticated bounded school discovery projection. Exact name/code/verified-alias matches take priority; typo fallback is read-only and returns only established safe school-search fields.';

create or replace function public.success_wishes_school_search_public_v1(
  p_query text,
  p_limit integer default 12
)
returns table (
  directory_id uuid,
  school_name text,
  county text,
  sub_county text
)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $function$
with q as materialized (
  select btrim(coalesce(p_query,'')) query, lower(btrim(coalesce(p_query,''))) query_lower
),
exact_matches as materialized (
  select
    d.id as directory_id,
    d.name as school_name,
    nullif(btrim(d.county), '') as county,
    nullif(btrim(d.sub_county), '') as sub_county
  from public.schools_directory d
  cross join q
  where length(q.query) >= 2
    and d.name ilike '%' || q.query || '%'
  order by case when lower(d.name)=q.query_lower then 0 else 1 end, d.name asc
  limit least(greatest(coalesce(p_limit,12),1),12)
),
typo_matches as materialized (
  select
    d.id as directory_id,
    d.name as school_name,
    nullif(btrim(d.county), '') as county,
    nullif(btrim(d.sub_county), '') as sub_county
  from public.schools_directory d
  cross join q
  where length(q.query) >= 4 and length(q.query) <= 80
    and not exists(select 1 from exact_matches)
    and exists (
      select 1 from regexp_split_to_table(q.query_lower,'[^a-z0-9]+') as qt(token)
      where length(qt.token)>=4
    )
    and not exists (
      select 1 from regexp_split_to_table(q.query_lower,'[^a-z0-9]+') as qt(token)
      where length(qt.token)>=4
        and not exists (
          select 1 from regexp_split_to_table(d.name,'[^a-z0-9]+') as nt(token)
          where extensions.levenshtein_less_equal(lower(qt.token),lower(nt.token),1)<=1
        )
    )
  order by extensions.word_similarity(q.query_lower,d.name) desc, d.name asc
  limit least(greatest(coalesce(p_limit,12),1),12)
)
select * from exact_matches
union all
select * from typo_matches
$function$;

revoke all on function public.success_wishes_school_search_public_v1(text,integer) from public;
grant execute on function public.success_wishes_school_search_public_v1(text,integer) to anon, authenticated;

comment on function public.success_wishes_school_search_public_v1(text,integer) is
'Read-only safe school label search for optional Success Wishes context. Directory results are not identity, enrollment, permission, approval, or delivery authority. Exact matches precede typo-tolerant close matches.';

commit;
