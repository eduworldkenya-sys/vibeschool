begin;

create unique index if not exists school_identity_candidates_one_active_directory_idx
  on public.school_identity_candidates(directory_school_id)
  where directory_school_id is not null and status in ('pending','matched','new');
create index if not exists school_identity_candidates_status_created_idx
  on public.school_identity_candidates(status, created_at desc);

drop function if exists public.search_school_directory(text,text,text,text,double precision,double precision,integer);

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
  id uuid,name text,county text,sub_county text,ward text,school_type text,school_category text,ownership_type text,
  gender_type text,accommodation_type text,cluster text,knec_code text,nemis_code text,gps_lat numeric,gps_lng numeric,
  levels text[],match_score real,distance_km numeric,source text
)
language sql stable security invoker set search_path=public,extensions
as $$
with q as (
  select lower(regexp_replace(trim(coalesce(p_query,'')),'[^a-zA-Z0-9]+','','g')) n, lower(trim(coalesce(p_query,''))) raw
), canonical as (
  select s.id,s.name::text,s.county::text,s.sub_county::text,s.ward::text,s.school_type::text,s.school_category::text,
    s.ownership_type,s.gender_type,s.accommodation_type,s.cluster,s.knec_code::text,s.nemis_code::text,s.gps_lat,s.gps_lng,
    coalesce(array_agg(distinct sl.level) filter(where sl.level is not null),'{}'::text[]) levels,'CANONICAL'::text source,
    greatest(
      case when q.raw='' then .25 when lower(s.name)=q.raw then 1.0 when lower(s.name) like q.raw||'%' then .92
           when lower(s.name) like '%'||q.raw||'%' then .78 when q.n<>'' and coalesce(s.name_normalized,'') like '%'||q.n||'%' then .78 else 0 end,
      coalesce((select max(coalesce(a.confidence,case when a.verified then 1 else .5 end)) from public.school_aliases a
        where a.school_id=s.id and (a.verified or a.confidence>=.8)
          and (lower(a.alias)=q.raw or lower(a.alias) like q.raw||'%' or lower(a.alias) like '%'||q.raw||'%' or (q.n<>'' and a.alias_normalized like '%'||q.n||'%'))),0)
    )::real match_score
  from public.schools s cross join q left join public.school_levels sl on sl.school_id=s.id
  where s.deleted_at is null and s.status in ('pending','active')
    and (p_county is null or lower(s.county)=lower(p_county)) and (p_sub_county is null or lower(s.sub_county)=lower(p_sub_county))
    and (q.raw='' or lower(s.name) like '%'||q.raw||'%' or (q.n<>'' and coalesce(s.name_normalized,'') like '%'||q.n||'%')
      or s.knec_code=trim(p_query) or s.nemis_code=trim(p_query)
      or exists(select 1 from public.school_aliases a where a.school_id=s.id and (a.verified or a.confidence>=.8)
        and (lower(a.alias) like '%'||q.raw||'%' or (q.n<>'' and a.alias_normalized like '%'||q.n||'%'))))
  group by s.id,s.name,s.county,s.sub_county,s.ward,s.school_type,s.school_category,s.ownership_type,s.gender_type,s.accommodation_type,s.cluster,
           s.knec_code,s.nemis_code,s.gps_lat,s.gps_lng,q.raw,q.n
), directory as (
  select d.id,d.name::text,d.county::text,d.sub_county::text,null::text ward,d.type::text school_type,null::text school_category,
    null::text ownership_type,null::text gender_type,null::text accommodation_type,null::text cluster,null::text knec_code,null::text nemis_code,
    d.latitude::numeric gps_lat,d.longitude::numeric gps_lng,
    case when lower(coalesce(d.type,'')) like '%junior%' then array['JUNIOR']::text[]
         when lower(coalesce(d.type,'')) like '%secondary%' or lower(coalesce(d.type,'')) like '%senior%' then array['SENIOR_SECONDARY']::text[]
         else array['PRIMARY']::text[] end levels,'DIRECTORY'::text source,
    case when q.raw='' then .2 when lower(d.name)=q.raw then .9 when lower(d.name) like q.raw||'%' then .82 when lower(d.name) like '%'||q.raw||'%' then .70 else 0 end::real match_score
  from public.schools_directory d cross join q
  where lower(coalesce(d.status,'active'))<>'closed'
    and (p_county is null or lower(d.county)=lower(p_county)) and (p_sub_county is null or lower(d.sub_county)=lower(p_sub_county))
    and (q.raw='' or lower(d.name) like '%'||q.raw||'%')
    and not exists(select 1 from public.school_identity_candidates c where c.directory_school_id=d.id and c.status in ('matched','new') and c.canonical_school_id is not null)
), scored as (
  select x.*,case when p_lat is not null and p_lng is not null and x.gps_lat is not null and x.gps_lng is not null then
    6371*2*asin(sqrt(power(sin(radians((x.gps_lat-p_lat)/2)),2)+cos(radians(p_lat))*cos(radians(x.gps_lat))*power(sin(radians((x.gps_lng-p_lng)/2)),2))) else null end distance_km
  from (select * from canonical union all select * from directory) x
), ranked as (
  select s.*,(s.match_score+case when s.distance_km is not null then greatest(0,.20-least(s.distance_km,100)/500.0) else 0 end)::real final_score
  from scored s where p_level is null or p_level=any(s.levels) or (p_level='JUNIOR' and 'PRIMARY'=any(s.levels))
)
select id,name,county,sub_county,ward,school_type,school_category,ownership_type,gender_type,accommodation_type,cluster,knec_code,nemis_code,gps_lat,gps_lng,levels,final_score,round(distance_km::numeric,2),source
from ranked where p_query is null or match_score>0 order by final_score desc,distance_km nulls last,name limit greatest(1,least(coalesce(p_limit,30),100));
$$;
revoke all on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) from public,anon;
grant execute on function public.search_school_directory(text,text,text,text,numeric,numeric,integer) to authenticated;

create or replace function public.connect_teacher_to_directory_school(p_directory_id uuid,p_level text default null)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); d record; v_school uuid; v_match_count integer:=0; v_reason text;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then raise exception 'Invalid education level'; end if;
 select * into d from public.schools_directory where id=p_directory_id and lower(coalesce(status,'active'))<>'closed';
 if not found then raise exception 'Directory school not found'; end if;
 select c.canonical_school_id into v_school from public.school_identity_candidates c where c.directory_school_id=p_directory_id and c.status in ('matched','new') and c.canonical_school_id is not null order by case when c.status='matched' then 0 else 1 end,c.updated_at desc limit 1;
 if v_school is null then
   select count(*),min(s.id) into v_match_count,v_school from public.schools s where s.deleted_at is null and s.status in ('pending','active')
     and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g'))=lower(regexp_replace(d.name,'[^a-zA-Z0-9]+','','g'))
     and lower(coalesce(s.county,''))=lower(coalesce(d.county,'')) and lower(coalesce(s.sub_county,''))=lower(coalesce(d.sub_county,''));
   if v_match_count=1 then v_reason:='Unique normalized name + county + sub-county match'; else v_school:=null; end if;
 end if;
 if v_school is null then
   insert into public.school_identity_candidates(directory_school_id,status,confidence,match_reason) values(p_directory_id,'pending',0,'No unambiguous canonical school match')
   on conflict (directory_school_id) where status in ('pending','matched','new') do update set updated_at=now(),match_reason=excluded.match_reason;
   raise exception 'school_identity_review_required';
 end if;
 insert into public.school_identity_candidates(directory_school_id,canonical_school_id,status,confidence,match_reason,reviewed_by,reviewed_at)
 values(p_directory_id,v_school,'matched',1,coalesce(v_reason,'Existing trusted reconciliation'),v_uid,now())
 on conflict (directory_school_id) where status in ('pending','matched','new') do update set canonical_school_id=excluded.canonical_school_id,status='matched',confidence=excluded.confidence,match_reason=excluded.match_reason,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,updated_at=now();
 insert into public.school_members(school_id,profile_id,role) values(v_school,v_uid,'teacher') on conflict(school_id,profile_id) do nothing;
 update public.profiles set school_id=v_school where id=v_uid;
 insert into public.teacher_profiles(profile_id,school_id) values(v_uid,v_school) on conflict(profile_id) do update set school_id=excluded.school_id;
 if p_level is not null then insert into public.school_levels(school_id,level) values(v_school,p_level) on conflict do nothing; end if;
 return v_school;
end;$$;
revoke all on function public.connect_teacher_to_directory_school(uuid,text) from public,anon;
grant execute on function public.connect_teacher_to_directory_school(uuid,text) to authenticated;

create or replace function public.hq_list_school_identity_queue(p_status text default 'pending',p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
 if p_status not in ('pending','matched','new','rejected','resolved') then raise exception 'invalid_status'; end if;
 return jsonb_build_object(
  'candidates',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select c.id,c.status,c.confidence,c.match_reason,c.created_at,c.updated_at,c.directory_school_id,c.canonical_school_id,d.name directory_name,d.county directory_county,d.sub_county directory_sub_county,s.name canonical_name,s.county canonical_county,s.sub_county canonical_sub_county from public.school_identity_candidates c left join public.schools_directory d on d.id=c.directory_school_id left join public.schools s on s.id=c.canonical_school_id where c.status=p_status order by c.created_at desc limit greatest(1,least(coalesce(p_limit,50),200))) x),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select r.id,r.status,r.request_type,r.name,r.county,r.sub_county,r.ward,r.level,r.school_code,r.submitted_lat,r.submitted_lng,r.alternative_name,r.notes,r.requested_by,r.created_at from public.school_discovery_requests r where r.status=p_status order by r.created_at desc limit greatest(1,least(coalesce(p_limit,50),200))) x),'[]'::jsonb)
 );
end;$$;
revoke all on function public.hq_list_school_identity_queue(text,integer) from public,anon;
grant execute on function public.hq_list_school_identity_queue(text,integer) to authenticated;

create or replace function public.hq_review_school_identity_candidate(p_candidate_id uuid,p_action text,p_canonical_school_id uuid default null,p_alias text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare c record;v_school uuid;v_uid uuid:=auth.uid();v_alias text:=nullif(trim(p_alias),'');
begin
 if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
 if p_action not in ('matched','new','rejected') then raise exception 'invalid_action'; end if;
 select * into c from public.school_identity_candidates where id=p_candidate_id for update; if not found then raise exception 'candidate_not_found'; end if;
 if p_action='matched' then
   if p_canonical_school_id is null or not exists(select 1 from public.schools where id=p_canonical_school_id and deleted_at is null and status in ('pending','active')) then raise exception 'canonical_school_required'; end if;
   v_school:=p_canonical_school_id;
 elsif p_action='new' then
   if c.directory_school_id is null then raise exception 'directory_school_required'; end if;
   insert into public.schools(name,timezone,country_code,status,created_by,requires_dual_approval,county,sub_county,gps_lat,gps_lng,school_type,directory_source,directory_source_ref,last_verified_at)
   select d.name,'Africa/Nairobi','KE','pending',v_uid,true,d.county,d.sub_county,d.latitude,d.longitude,d.type,'SCHOOL_DIRECTORY',d.id::text,now() from public.schools_directory d where d.id=c.directory_school_id returning id into v_school;
   if v_school is null then raise exception 'directory_school_not_found'; end if;
 end if;
 update public.school_identity_candidates set canonical_school_id=case when p_action='rejected' then null else v_school end,status=p_action,confidence=case when p_action='matched' then 1 when p_action='new' then .99 else confidence end,match_reason=coalesce(nullif(trim(p_note),''),case when p_action='matched' then 'Platform owner verified canonical match' when p_action='new' then 'Platform owner approved new canonical school' else 'Platform owner rejected identity match' end),reviewed_by=v_uid,reviewed_at=now(),updated_at=now() where id=p_candidate_id;
 if p_action in ('matched','new') then
   if v_alias is not null then insert into public.school_aliases(school_id,alias,alias_normalized,source,verified,source_type,confidence,verified_at) values(v_school,v_alias,lower(regexp_replace(v_alias,'[^a-zA-Z0-9]+','','g')),'SCHOOL_IDENTITY_REVIEW',true,'operator',1,now()) on conflict do nothing; end if;
   return v_school;
 end if;
 return null;
end;$$;
revoke all on function public.hq_review_school_identity_candidate(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.hq_review_school_identity_candidate(uuid,text,uuid,text,text) to authenticated;

create or replace function public.hq_resolve_school_discovery_request(p_request_id uuid,p_action text,p_canonical_school_id uuid default null,p_school_name text default null,p_alias text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare r record;v_school uuid;v_uid uuid:=auth.uid();v_name text;
begin
 if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
 if p_action not in ('matched','created','rejected') then raise exception 'invalid_action'; end if;
 select * into r from public.school_discovery_requests where id=p_request_id for update; if not found then raise exception 'request_not_found'; end if;
 if p_action='matched' then
   if p_canonical_school_id is null or not exists(select 1 from public.schools where id=p_canonical_school_id and deleted_at is null and status in ('pending','active')) then raise exception 'canonical_school_required'; end if;
   v_school:=p_canonical_school_id;
 elsif p_action='created' then
   v_name:=trim(coalesce(nullif(p_school_name,''),r.name)); if length(v_name)<3 then raise exception 'invalid_school_name'; end if;
   insert into public.schools(name,timezone,country_code,status,created_by,requires_dual_approval,county,sub_county,ward,gps_lat,gps_lng,knec_code,directory_source,last_verified_at,name_normalized)
   values(v_name,'Africa/Nairobi','KE','pending',v_uid,true,r.county,r.sub_county,r.ward,r.submitted_lat,r.submitted_lng,r.school_code,'DISCOVERY_REQUEST',now(),lower(regexp_replace(v_name,'[^a-zA-Z0-9]+','','g'))) returning id into v_school;
 end if;
 update public.school_discovery_requests set status=case when p_action='rejected' then 'rejected' else 'resolved' end,resolved_at=now(),notes=case when nullif(trim(p_note),'') is null then notes else concat_ws(E'\n',notes,'Operator: '||trim(p_note)) end where id=p_request_id;
 if p_action in ('matched','created') then
   if nullif(trim(coalesce(r.alternative_name,'')),'') is not null then insert into public.school_aliases(school_id,alias,alias_normalized,source,verified,source_type,confidence,verified_at) values(v_school,trim(r.alternative_name),lower(regexp_replace(trim(r.alternative_name),'[^a-zA-Z0-9]+','','g')),'DISCOVERY_REQUEST',true,'operator',1,now()) on conflict do nothing; end if;
   if nullif(trim(coalesce(p_alias,'')),'') is not null then insert into public.school_aliases(school_id,alias,alias_normalized,source,verified,source_type,confidence,verified_at) values(v_school,trim(p_alias),lower(regexp_replace(trim(p_alias),'[^a-zA-Z0-9]+','','g')),'DISCOVERY_REQUEST',true,'operator',1,now()) on conflict do nothing; end if;
   return v_school;
 end if;
 return null;
end;$$;
revoke all on function public.hq_resolve_school_discovery_request(uuid,text,uuid,text,text,text) from public,anon;
grant execute on function public.hq_resolve_school_discovery_request(uuid,text,uuid,text,text,text) to authenticated;

commit;
