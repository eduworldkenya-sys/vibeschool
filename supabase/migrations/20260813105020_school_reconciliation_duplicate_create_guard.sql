create or replace function public.hq_review_school_identity_candidate(p_candidate_id uuid,p_action text,p_canonical_school_id uuid default null,p_alias text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare c record;v_school uuid;v_uid uuid:=auth.uid();v_alias text:=nullif(trim(p_alias),'');v_count integer:=0;
begin
 if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
 if p_action not in ('matched','new','rejected') then raise exception 'invalid_action'; end if;
 select * into c from public.school_identity_candidates where id=p_candidate_id for update; if not found then raise exception 'candidate_not_found'; end if;
 if p_action='matched' then
   if p_canonical_school_id is null or not exists(select 1 from public.schools where id=p_canonical_school_id and deleted_at is null and status in ('pending','active')) then raise exception 'canonical_school_required'; end if;
   v_school:=p_canonical_school_id;
 elsif p_action='new' then
   if c.directory_school_id is null then raise exception 'directory_school_required'; end if;
   select count(*),min(s.id) into v_count,v_school from public.schools s join public.schools_directory d on d.id=c.directory_school_id
   where s.deleted_at is null and s.status in ('pending','active')
     and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g'))=lower(regexp_replace(d.name,'[^a-zA-Z0-9]+','','g'))
     and lower(coalesce(s.county,''))=lower(coalesce(d.county,'')) and lower(coalesce(s.sub_county,''))=lower(coalesce(d.sub_county,''));
   if v_count>1 then raise exception 'canonical_school_ambiguous'; end if;
   if v_school is null then
     insert into public.schools(name,timezone,country_code,status,created_by,requires_dual_approval,county,sub_county,gps_lat,gps_lng,school_type,directory_source,directory_source_ref,last_verified_at)
     select d.name,'Africa/Nairobi','KE','pending',v_uid,true,d.county,d.sub_county,d.latitude,d.longitude,d.type,'SCHOOL_DIRECTORY',d.id::text,now() from public.schools_directory d where d.id=c.directory_school_id returning id into v_school;
     if v_school is null then raise exception 'directory_school_not_found'; end if;
   end if;
 end if;
 update public.school_identity_candidates set canonical_school_id=case when p_action='rejected' then null else v_school end,status=case when p_action='new' and v_count>0 then 'matched' else p_action end,confidence=case when p_action='matched' or (p_action='new' and v_count>0) then 1 when p_action='new' then .99 else confidence end,match_reason=coalesce(nullif(trim(p_note),''),case when p_action='matched' or (p_action='new' and v_count>0) then 'Platform owner verified canonical match' when p_action='new' then 'Platform owner approved new canonical school' else 'Platform owner rejected identity match' end),reviewed_by=v_uid,reviewed_at=now(),updated_at=now() where id=p_candidate_id;
 if p_action in ('matched','new') then
   if v_alias is not null then insert into public.school_aliases(school_id,alias,alias_normalized,source,verified,source_type,confidence,verified_at) values(v_school,v_alias,lower(regexp_replace(v_alias,'[^a-zA-Z0-9]+','','g')),'SCHOOL_IDENTITY_REVIEW',true,'operator',1,now()) on conflict do nothing; end if;
   if p_action='new' then insert into public.school_levels(school_id,level) select v_school,case when lower(coalesce(d.type,'')) like '%junior%' then 'JUNIOR' when lower(coalesce(d.type,'')) like '%secondary%' or lower(coalesce(d.type,'')) like '%senior%' then 'SENIOR_SECONDARY' else 'PRIMARY' end from public.schools_directory d join public.school_identity_candidates c2 on c2.id=p_candidate_id where c2.directory_school_id=d.id on conflict do nothing; end if;
   return v_school;
 end if;
 return null;
end;$$;
revoke all on function public.hq_review_school_identity_candidate(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.hq_review_school_identity_candidate(uuid,text,uuid,text,text) to authenticated;

create or replace function public.hq_resolve_school_discovery_request(p_request_id uuid,p_action text,p_canonical_school_id uuid default null,p_school_name text default null,p_alias text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare r record;v_school uuid;v_uid uuid:=auth.uid();v_name text;v_count integer:=0;
begin
 if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
 if p_action not in ('matched','created','rejected') then raise exception 'invalid_action'; end if;
 select * into r from public.school_discovery_requests where id=p_request_id for update; if not found then raise exception 'request_not_found'; end if;
 if p_action='matched' then
   if p_canonical_school_id is null or not exists(select 1 from public.schools where id=p_canonical_school_id and deleted_at is null and status in ('pending','active')) then raise exception 'canonical_school_required'; end if;
   v_school:=p_canonical_school_id;
 elsif p_action='created' then
   v_name:=trim(coalesce(nullif(p_school_name,''),r.name)); if length(v_name)<3 then raise exception 'invalid_school_name'; end if;
   select count(*),min(s.id) into v_count,v_school from public.schools s where s.deleted_at is null and s.status in ('pending','active')
     and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g'))=lower(regexp_replace(v_name,'[^a-zA-Z0-9]+','','g'))
     and lower(coalesce(s.county,''))=lower(coalesce(r.county,'')) and lower(coalesce(s.sub_county,''))=lower(coalesce(r.sub_county,''));
   if v_count>1 then raise exception 'canonical_school_ambiguous'; end if;
   if v_school is null then
     insert into public.schools(name,timezone,country_code,status,created_by,requires_dual_approval,county,sub_county,ward,gps_lat,gps_lng,knec_code,directory_source,last_verified_at,name_normalized)
     values(v_name,'Africa/Nairobi','KE','pending',v_uid,true,r.county,r.sub_county,r.ward,r.submitted_lat,r.submitted_lng,r.school_code,'DISCOVERY_REQUEST',now(),lower(regexp_replace(v_name,'[^a-zA-Z0-9]+','','g'))) returning id into v_school;
     if r.level is not null then insert into public.school_levels(school_id,level) values(v_school,r.level) on conflict do nothing; end if;
   end if;
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
