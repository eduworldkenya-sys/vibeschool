begin;

-- One canonical school per directory record. This is the database concurrency guard,
-- not an application-level check-then-insert.
create unique index if not exists schools_directory_source_ref_unique
on public.schools(directory_source_ref)
where deleted_at is null and directory_source='schools_directory' and directory_source_ref is not null;

-- Active-school preference is valid only when backed by teacher membership.
create or replace function public.set_my_active_teacher_school(p_school_id uuid)
returns uuid language plpgsql security definer
set search_path=public,auth,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
   then raise exception 'teacher_authority_required' using errcode='42501'; end if;
 if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text='teacher')
   then raise exception 'school_membership_required' using errcode='42501'; end if;
 update public.profiles set school_id=p_school_id where id=v_uid;
 insert into public.teacher_profiles(profile_id,school_id) values(v_uid,p_school_id)
 on conflict(profile_id) do update set school_id=excluded.school_id;
 return p_school_id;
end $$;
revoke all on function public.set_my_active_teacher_school(uuid) from public,anon,service_role;
grant execute on function public.set_my_active_teacher_school(uuid) to authenticated;

create or replace function public.get_my_teacher_school_context()
returns jsonb language plpgsql stable security definer
set search_path=public,auth,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_active uuid; v_memberships jsonb;
begin
 if v_uid is null then return jsonb_build_object('state','unauthenticated','active_school_id',null,'schools','[]'::jsonb); end if;
 select p.school_id into v_active from public.profiles p where p.id=v_uid and p.role::text='teacher';
 if v_active is not null and not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=v_active and sm.role::text='teacher') then v_active:=null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'status',s.status) order by s.name),'[]'::jsonb)
 into v_memberships from public.school_members sm join public.schools s on s.id=sm.school_id and s.deleted_at is null
 where sm.profile_id=v_uid and sm.role::text='teacher';
 if v_active is null then
   select sm.school_id into v_active from public.school_members sm join public.schools s on s.id=sm.school_id and s.deleted_at is null
   where sm.profile_id=v_uid and sm.role::text='teacher' order by sm.created_at nulls last,sm.school_id limit 1;
 end if;
 return jsonb_build_object('state',case when v_active is null then 'needs_school' else 'ready' end,'active_school_id',v_active,'schools',v_memberships);
end $$;
revoke all on function public.get_my_teacher_school_context() from public,anon,service_role;
grant execute on function public.get_my_teacher_school_context() to authenticated;

-- Canonical connect: membership grants authority; profile fields only select active context.
create or replace function public.connect_teacher_to_school(p_school_id uuid,p_level text default null)
returns uuid language plpgsql security definer set search_path=public,auth,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_role text; v_status text; v_anonymized boolean;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select p.role::text,p.account_status::text,coalesce(p.is_anonymized,false) into v_role,v_status,v_anonymized from public.profiles p where p.id=v_uid;
 if v_role is distinct from 'teacher' or v_status is distinct from 'active' or v_anonymized then raise exception 'teacher_authority_required' using errcode='42501'; end if;
 if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then raise exception 'invalid_education_level' using errcode='22023'; end if;
 if not exists(select 1 from public.schools s where s.id=p_school_id and s.deleted_at is null and s.status in ('pending','active')) then raise exception 'school_not_available' using errcode='22023'; end if;
 insert into public.school_members(school_id,profile_id,role) values(p_school_id,v_uid,'teacher') on conflict(school_id,profile_id) do update set role='teacher';
 perform public.set_my_active_teacher_school(p_school_id);
 -- p_level is teacher search/class context. It must not mutate the school's declared levels.
 if not exists(select 1 from public.school_members sm where sm.school_id=p_school_id and sm.profile_id=v_uid and sm.role::text='teacher') then raise exception 'school_connection_verification_failed'; end if;
 return p_school_id;
end $$;
revoke all on function public.connect_teacher_to_school(uuid,text) from public,anon,service_role;
grant execute on function public.connect_teacher_to_school(uuid,text) to authenticated;

create or replace function public.connect_teacher_to_directory_school(p_directory_id uuid,p_level text default null)
returns uuid language plpgsql security definer set search_path=public,auth,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_school uuid; v_role text; v_status text; v_anonymized boolean; v_subdomain text; d public.schools_directory%rowtype;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select p.role::text,p.account_status::text,coalesce(p.is_anonymized,false) into v_role,v_status,v_anonymized from public.profiles p where p.id=v_uid;
 if v_role is distinct from 'teacher' or v_status is distinct from 'active' or v_anonymized then raise exception 'teacher_authority_required' using errcode='42501'; end if;
 if p_level is not null and p_level not in ('PRIMARY','JUNIOR','SENIOR_SECONDARY') then raise exception 'invalid_education_level' using errcode='22023'; end if;
 select * into d from public.schools_directory where id=p_directory_id and lower(coalesce(status,'active'))<>'closed';
 if not found then raise exception 'directory_school_not_found' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_directory_id::text,0));
 select s.id into v_school from public.schools s where s.deleted_at is null and s.directory_source='schools_directory' and s.directory_source_ref=p_directory_id::text limit 1;
 if v_school is null and d.knec_code is not null then select s.id into v_school from public.schools s where s.deleted_at is null and s.knec_code=d.knec_code order by case when s.status='active' then 0 else 1 end,s.created_at limit 1; end if;
 if v_school is null then select s.id into v_school from public.schools s where s.deleted_at is null and lower(trim(s.name))=lower(trim(d.name)) and coalesce(lower(trim(s.county)),'')=coalesce(lower(trim(d.county)),'') and coalesce(lower(trim(s.sub_county)),'')=coalesce(lower(trim(d.sub_county)),'') order by case when s.status='active' then 0 else 1 end,s.created_at limit 1; end if;
 if v_school is null then
   v_subdomain:=trim(both '-' from left(regexp_replace(lower(coalesce(nullif(trim(d.name),''),'school')),'[^a-z0-9]+','-','g'),40))||'-'||left(replace(p_directory_id::text,'-',''),8);
   insert into public.schools(name,subdomain,timezone,country_code,status,created_by,requires_dual_approval,county,sub_county,gps_lat,gps_lng,knec_code,school_type,directory_source,directory_source_ref,last_verified_at)
   values(d.name,v_subdomain,'Africa/Nairobi','KE','pending',v_uid,true,d.county,d.sub_county,d.latitude,d.longitude,d.knec_code,d.type,'schools_directory',p_directory_id::text,case when d.is_verified then now() else null end)
   on conflict (directory_source_ref) where deleted_at is null and directory_source='schools_directory' and directory_source_ref is not null
   do update set directory_source_ref=excluded.directory_source_ref returning id into v_school;
 end if;
 insert into public.school_identity_candidates(directory_school_id,canonical_school_id,status,confidence,match_reason)
 values(p_directory_id,v_school,'pending',case when d.is_verified then .95 else .70 end,'Teacher-selected directory identity; pending operator reconciliation')
 on conflict(directory_school_id) where status in ('pending','matched','new') do update set canonical_school_id=excluded.canonical_school_id,match_reason=excluded.match_reason,updated_at=now();
 insert into public.school_members(school_id,profile_id,role) values(v_school,v_uid,'teacher') on conflict(school_id,profile_id) do update set role='teacher';
 perform public.set_my_active_teacher_school(v_school);
 if not exists(select 1 from public.school_members sm where sm.school_id=v_school and sm.profile_id=v_uid and sm.role::text='teacher') then raise exception 'school_connection_verification_failed'; end if;
 return v_school;
end $$;
revoke all on function public.connect_teacher_to_directory_school(uuid,text) from public,anon,service_role;
grant execute on function public.connect_teacher_to_directory_school(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;