create index if not exists school_aliases_alias_normalized_trgm_idx on public.school_aliases using gin (alias_normalized extensions.gin_trgm_ops);

alter table public.school_discovery_requests add column if not exists request_type text not null default 'missing_or_new';
alter table public.school_discovery_requests add column if not exists ward text;
alter table public.school_discovery_requests add column if not exists school_code text;
alter table public.school_discovery_requests add column if not exists submitted_lat numeric;
alter table public.school_discovery_requests add column if not exists submitted_lng numeric;
alter table public.school_discovery_requests add column if not exists contact_name text;
alter table public.school_discovery_requests add column if not exists contact_phone text;
alter table public.school_discovery_requests add column if not exists alternative_name text;
create index if not exists school_discovery_requests_lookup_idx on public.school_discovery_requests(status,lower(regexp_replace(name,'[^a-zA-Z0-9]+','','g')),county,sub_county,level,created_at desc);

create or replace function public.search_school_directory(p_query text default null,p_level text default null,p_county text default null,p_sub_county text default null,p_lat numeric default null,p_lng numeric default null,p_limit integer default 30)
returns table(id uuid,name text,county text,sub_county text,ward text,school_type text,school_category text,ownership_type text,gender_type text,accommodation_type text,cluster text,knec_code text,nemis_code text,gps_lat numeric,gps_lng numeric,levels text[],match_score real,distance_km numeric,source text)
language sql stable security invoker set search_path=public as $$
with q as (select lower(regexp_replace(trim(coalesce(p_query,'')),'[^a-zA-Z0-9]+','','g')) n), canonical as (
 select s.id,s.name::text,s.county::text,s.sub_county::text,s.ward::text,s.school_type::text,s.school_category::text,s.ownership_type,s.gender_type,s.accommodation_type,s.cluster,s.knec_code::text,s.nemis_code::text,s.gps_lat,s.gps_lng,coalesce(array_agg(distinct sl.level) filter(where sl.level is not null),'{}'::text[]) levels,'CANONICAL'::text source,
 greatest(extensions.similarity(lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g')),q.n),coalesce((select max(extensions.similarity(a.alias_normalized,q.n)) from public.school_aliases a where a.school_id=s.id and a.verified),0))::real match_score
 from public.schools s cross join q left join public.school_levels sl on sl.school_id=s.id
 where s.deleted_at is null and (p_county is null or s.county=p_county) and (p_sub_county is null or s.sub_county=p_sub_county)
 and (q.n='' or s.name ilike '%'||trim(p_query)||'%' or coalesce(s.name_normalized,'') like '%'||q.n||'%' or s.knec_code=trim(p_query) or s.nemis_code=trim(p_query) or exists(select 1 from public.school_aliases a where a.school_id=s.id and a.verified and (a.alias ilike '%'||trim(p_query)||'%' or a.alias_normalized like '%'||q.n||'%')))
 group by s.id,s.name,s.county,s.sub_county,s.ward,s.school_type,s.school_category,s.ownership_type,s.gender_type,s.accommodation_type,s.cluster,s.knec_code,s.nemis_code,s.gps_lat,s.gps_lng,q.n
), directory as (
 select d.id,d.name,d.county,d.sub_county,null::text ward,d.type school_type,null::text school_category,null::text ownership_type,null::text gender_type,null::text accommodation_type,null::text cluster,null::text knec_code,null::text nemis_code,d.latitude::numeric gps_lat,d.longitude::numeric gps_lng,
 case when lower(coalesce(d.type,'')) like '%junior%' then array['JUNIOR']::text[] when lower(coalesce(d.type,'')) like '%secondary%' or lower(coalesce(d.type,'')) like '%senior%' then array['SENIOR_SECONDARY']::text[] else array['PRIMARY']::text[] end levels,'DIRECTORY'::text source,
 extensions.similarity(lower(regexp_replace(d.name,'[^a-zA-Z0-9]+','','g')),q.n)::real match_score
 from public.schools_directory d cross join q
 where lower(coalesce(d.status,'active')) <> 'closed' and (p_county is null or d.county=p_county) and (p_sub_county is null or d.sub_county=p_sub_county)
 and (q.n='' or d.name ilike '%'||trim(p_query)||'%' or lower(regexp_replace(d.name,'[^a-zA-Z0-9]+','','g')) like '%'||q.n||'%')
), unified as (select * from canonical union all select * from directory), dedup as (
 select u.*,row_number() over(partition by lower(regexp_replace(u.name,'[^a-zA-Z0-9]+','','g')),coalesce(lower(u.county),''),coalesce(lower(u.sub_county),''),coalesce(u.knec_code,''),coalesce(u.nemis_code,'') order by case when u.source='CANONICAL' then 0 else 1 end,u.match_score desc) rn
 from unified u
), ranked as (select d.* from dedup d cross join q where d.rn=1 and (p_level is null or p_level=any(d.levels) or (p_level='JUNIOR' and 'PRIMARY'=any(d.levels))))
select r.id,r.name,r.county,r.sub_county,r.ward,r.school_type,r.school_category,r.ownership_type,r.gender_type,r.accommodation_type,r.cluster,r.knec_code,r.nemis_code,r.gps_lat,r.gps_lng,r.levels,r.match_score,
case when p_lat is not null and p_lng is not null and r.gps_lat is not null and r.gps_lng is not null then round((6371*2*asin(sqrt(power(sin(radians((r.gps_lat-p_lat)/2)),2)+cos(radians(p_lat))*cos(radians(r.gps_lat))*power(sin(radians((r.gps_lng-p_lng)/2)),2))))::numeric,2) else null end distance_km,r.source
from ranked r order by r.match_score desc,case when p_lat is not null and p_lng is not null and r.gps_lat is not null and r.gps_lng is not null then 6371*2*asin(sqrt(power(sin(radians((r.gps_lat-p_lat)/2)),2)+cos(radians(p_lat))*cos(radians(r.gps_lat))*power(sin(radians((r.gps_lng-p_lng)/2)),2))) else 999999 end,r.name
limit greatest(1,least(coalesce(p_limit,30),100));
$$;
revoke all on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) from public,anon;
grant execute on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) to authenticated;

create or replace function public.submit_school_discovery_request(p_name text,p_county text default null,p_sub_county text default null,p_ward text default null,p_level text default null,p_school_code text default null,p_lat numeric default null,p_lng numeric default null,p_alternative_name text default null,p_notes text default null,p_contact_name text default null,p_contact_phone text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_name text:=trim(coalesce(p_name,'')); v_norm text:=lower(regexp_replace(v_name,'[^a-zA-Z0-9]+','','g'));
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if length(v_name)<3 then raise exception 'School name is too short'; end if;
 if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then raise exception 'Invalid education level'; end if;
 select id into v_id from public.school_discovery_requests where requested_by=v_uid and status='pending' and lower(regexp_replace(name,'[^a-zA-Z0-9]+','','g'))=v_norm and coalesce(lower(county),'')=coalesce(lower(nullif(trim(p_county),'')),'') and coalesce(lower(level),'')=coalesce(lower(p_level),'') order by created_at desc limit 1;
 if v_id is not null then return v_id; end if;
 insert into public.school_discovery_requests(requested_by,name,county,sub_county,ward,level,school_code,submitted_lat,submitted_lng,alternative_name,notes,contact_name,contact_phone,request_type,status)
 values(v_uid,v_name,nullif(trim(p_county),''),nullif(trim(p_sub_county),''),nullif(trim(p_ward),''),p_level,nullif(trim(p_school_code),''),p_lat,p_lng,nullif(trim(p_alternative_name),''),nullif(trim(p_notes),''),nullif(trim(p_contact_name),''),nullif(trim(p_contact_phone),''),'missing_or_new','pending') returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.submit_school_discovery_request(text,text,text,text,text,text,numeric,numeric,text,text,text,text) from public,anon;
grant execute on function public.submit_school_discovery_request(text,text,text,text,text,text,numeric,numeric,text,text,text,text) to authenticated;
