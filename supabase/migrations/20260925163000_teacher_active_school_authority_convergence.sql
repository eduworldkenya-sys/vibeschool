begin;

-- Canonical Teacher school scope:
-- school_members = authorization; teacher_active_school_preferences = active context;
-- profiles/teacher_profiles school_id = compatibility mirrors only.
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
 insert into public.teacher_active_school_preferences(teacher_id,school_id,updated_at)
 values(v_uid,p_school_id,clock_timestamp())
 on conflict(teacher_id) do update set school_id=excluded.school_id,updated_at=excluded.updated_at;
 update public.profiles set school_id=p_school_id,updated_at=clock_timestamp() where id=v_uid;
 insert into public.teacher_profiles(profile_id,school_id) values(v_uid,p_school_id)
 on conflict(profile_id) do update set school_id=excluded.school_id,updated_at=clock_timestamp();
 return p_school_id;
end $$;

create or replace function public.teacher_set_active_school(p_school_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,auth,extensions,pg_temp as $$
declare v_school uuid;
begin
 v_school:=public.set_my_active_teacher_school(p_school_id);
 return jsonb_build_object('teacher_id',auth.uid(),'school_id',v_school,'active_scope',true);
end $$;

create or replace function public.teacher_set_active_twin_school(p_school_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,auth,extensions,pg_temp as $$
begin
 return public.teacher_set_active_school(p_school_id);
end $$;

create or replace function public.get_my_teacher_school_context()
returns jsonb language plpgsql security definer stable
set search_path=public,auth,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_active uuid; v_memberships jsonb;
begin
 if v_uid is null then return jsonb_build_object('state','unauthenticated','active_school_id',null,'schools','[]'::jsonb); end if;
 select pref.school_id into v_active
 from public.teacher_active_school_preferences pref
 join public.school_members sm on sm.profile_id=v_uid and sm.school_id=pref.school_id and sm.role::text='teacher'
 join public.schools s on s.id=pref.school_id and s.deleted_at is null
 where pref.teacher_id=v_uid;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'status',s.status) order by s.name),'[]'::jsonb)
 into v_memberships from public.school_members sm join public.schools s on s.id=sm.school_id and s.deleted_at is null
 where sm.profile_id=v_uid and sm.role::text='teacher';
 if v_active is null then
   select sm.school_id into v_active from public.school_members sm join public.schools s on s.id=sm.school_id and s.deleted_at is null
   where sm.profile_id=v_uid and sm.role::text='teacher' order by sm.created_at nulls last,sm.school_id limit 1;
 end if;
 return jsonb_build_object('state',case when v_active is null then 'needs_school' else 'ready' end,'active_school_id',v_active,'schools',v_memberships);
end $$;

revoke all on function public.set_my_active_teacher_school(uuid) from public,anon,service_role;
revoke all on function public.teacher_set_active_school(uuid) from public,anon;
revoke all on function public.teacher_set_active_twin_school(uuid) from public,anon;
revoke all on function public.get_my_teacher_school_context() from public,anon,service_role;
grant execute on function public.set_my_active_teacher_school(uuid) to authenticated;
grant execute on function public.teacher_set_active_school(uuid) to authenticated,service_role;
grant execute on function public.teacher_set_active_twin_school(uuid) to authenticated,service_role;
grant execute on function public.get_my_teacher_school_context() to authenticated;

-- Repair only safe compatibility drift. Never manufacture authorization.
insert into public.teacher_active_school_preferences(teacher_id,school_id,updated_at)
select p.id,p.school_id,clock_timestamp() from public.profiles p
where p.role::text='teacher' and p.school_id is not null
and exists(select 1 from public.school_members sm where sm.profile_id=p.id and sm.school_id=p.school_id and sm.role::text='teacher')
and not exists(select 1 from public.teacher_active_school_preferences x where x.teacher_id=p.id)
on conflict(teacher_id) do nothing;

notify pgrst,'reload schema';
commit;