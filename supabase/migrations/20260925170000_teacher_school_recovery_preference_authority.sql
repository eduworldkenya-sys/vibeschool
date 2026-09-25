begin;
create or replace function public.leave_my_teacher_school(p_school_id uuid)
returns boolean language plpgsql security definer
set search_path=public,auth,extensions,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_active uuid; v_next uuid; v_count int;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
   then raise exception 'teacher_authority_required' using errcode='42501'; end if;
 if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text='teacher')
   then raise exception 'school_membership_required' using errcode='42501'; end if;
 if exists(select 1 from public.teacher_classes tc where tc.teacher_id=v_uid and tc.school_id=p_school_id)
   then raise exception 'school_has_teacher_assignments' using errcode='23503'; end if;

 select tap.school_id into v_active from public.teacher_active_school_preferences tap where tap.teacher_id=v_uid;
 delete from public.school_members where profile_id=v_uid and school_id=p_school_id and role::text='teacher';

 select count(*), min(sm.school_id) into v_count,v_next
 from public.school_members sm where sm.profile_id=v_uid and sm.role::text='teacher';

 if v_active is distinct from p_school_id and v_active is not null
    and exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=v_active and sm.role::text='teacher') then
   update public.profiles set school_id=v_active where id=v_uid;
   update public.teacher_profiles set school_id=v_active where profile_id=v_uid;
 elsif v_count=1 then
   perform public.set_my_active_teacher_school(v_next);
 else
   delete from public.teacher_active_school_preferences where teacher_id=v_uid;
   update public.profiles set school_id=null where id=v_uid;
   update public.teacher_profiles set school_id=null where profile_id=v_uid;
 end if;
 return true;
end $$;
revoke all on function public.leave_my_teacher_school(uuid) from public,anon,service_role;
grant execute on function public.leave_my_teacher_school(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
