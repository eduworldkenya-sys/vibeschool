begin;
create or replace function public.leave_my_teacher_school(p_school_id uuid)
returns boolean language plpgsql security definer
set search_path=public,auth,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_next uuid;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text='teacher')
   then raise exception 'school_membership_required' using errcode='42501'; end if;
 -- A mistaken onboarding choice can be undone only before consequential class authority exists.
 if exists(select 1 from public.teacher_classes tc where tc.teacher_id=v_uid and tc.school_id=p_school_id)
   then raise exception 'school_has_teacher_assignments' using errcode='23503'; end if;
 delete from public.school_members where profile_id=v_uid and school_id=p_school_id and role::text='teacher';
 select sm.school_id into v_next from public.school_members sm join public.schools s on s.id=sm.school_id and s.deleted_at is null
 where sm.profile_id=v_uid and sm.role::text='teacher' order by sm.created_at nulls last,sm.school_id limit 1;
 update public.profiles set school_id=v_next where id=v_uid and school_id=p_school_id;
 update public.teacher_profiles set school_id=v_next where profile_id=v_uid and school_id=p_school_id;
 return true;
end $$;
revoke all on function public.leave_my_teacher_school(uuid) from public,anon,service_role;
grant execute on function public.leave_my_teacher_school(uuid) to authenticated;
notify pgrst,'reload schema';
commit;