create table if not exists public.school_identity_candidates (
  id uuid primary key default gen_random_uuid(),
  directory_school_id uuid references public.schools_directory(id) on delete set null,
  canonical_school_id uuid references public.schools(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','matched','new','rejected')),
  confidence numeric(5,4),
  match_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists school_identity_candidates_status_idx on public.school_identity_candidates(status);
create index if not exists school_identity_candidates_directory_idx on public.school_identity_candidates(directory_school_id);
alter table public.school_aliases add column if not exists source_type text;
alter table public.school_aliases add column if not exists confidence numeric(5,4);
alter table public.school_aliases add column if not exists verified_at timestamptz;

create or replace function public.search_school_directory(p_query text default null,p_level text default null,p_county text default null,p_sub_county text default null,p_latitude double precision default null,p_longitude double precision default null,p_limit integer default 20)
returns table(school_id uuid,directory_id uuid,name text,county text,sub_county text,ward text,latitude double precision,longitude double precision,source text,match_score double precision,distance_km double precision,is_canonical boolean)
language sql security invoker set search_path=public as $$
with base as (
 select s.id as school_id,null::uuid as directory_id,s.name,s.county,s.sub_county,s.ward,s.gps_lat as latitude,s.gps_lng as longitude,'canonical'::text as source,true as is_canonical,
 greatest(case when p_query is null or btrim(p_query)='' then .25 when lower(s.name)=lower(btrim(p_query)) then 1 when lower(s.name) like lower(btrim(p_query))||'%' then .92 when lower(s.name) like '%'||lower(btrim(p_query))||'%' then .78 else 0 end,coalesce((select max(coalesce(a.confidence,case when a.verified then 1 else .5 end)) from school_aliases a where a.school_id=s.id and (a.verified or a.confidence>=.8) and (lower(a.alias)=lower(btrim(p_query)) or lower(a.alias) like lower(btrim(p_query))||'%' or lower(a.alias) like '%'||lower(btrim(p_query))||'%')),0))::double precision as match_score
 from schools s where s.deleted_at is null and (p_county is null or lower(s.county)=lower(p_county)) and (p_sub_county is null or lower(s.sub_county)=lower(p_sub_county))
 union all
 select null::uuid as school_id,d.id as directory_id,d.name,d.county,d.sub_county,null::text as ward,d.latitude,d.longitude,'directory'::text,false,
 case when p_query is null or btrim(p_query)='' then .2 when lower(d.name)=lower(btrim(p_query)) then .9 when lower(d.name) like lower(btrim(p_query))||'%' then .82 when lower(d.name) like '%'||lower(btrim(p_query))||'%' then .7 else 0 end::double precision
 from schools_directory d where lower(coalesce(d.status,'active'))<>'closed' and (p_county is null or lower(d.county)=lower(p_county)) and (p_sub_county is null or lower(d.sub_county)=lower(p_sub_county))
),scored as (select b.*,case when p_latitude is not null and p_longitude is not null and b.latitude is not null and b.longitude is not null then 6371*2*asin(sqrt(power(sin(radians(b.latitude-p_latitude)/2),2)+cos(radians(p_latitude))*cos(radians(b.latitude))*power(sin(radians(b.longitude-p_longitude)/2),2))) else null end as distance_km from base b),ranked as (select s.*,(s.match_score+case when s.distance_km is not null then greatest(0,.20-least(s.distance_km,100)/500.0) else 0 end) as final_score,row_number() over(partition by lower(regexp_replace(coalesce(s.name,''),'[^a-z0-9]+','','g')),lower(coalesce(s.county,'')),lower(coalesce(s.sub_county,'')) order by s.is_canonical desc,s.match_score desc) rn from scored s where p_query is null or s.match_score>0)
select school_id,directory_id,name,county,sub_county,ward,latitude,longitude,source,final_score,distance_km,is_canonical from ranked where rn=1 order by final_score desc,distance_km nulls last,name limit greatest(1,least(p_limit,100));$$;
revoke all on function public.search_school_directory(text,text,text,text,double precision,double precision,integer) from public,anon;
grant execute on function public.search_school_directory(text,text,text,text,double precision,double precision,integer) to authenticated;
