begin;

-- Remove only the caller's teaching assignment, never the shared class or subject.
-- Existing dependent records are protected by their foreign keys; a failure rolls back.
create or replace function public.teacher_remove_class_subject(p_assignment_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_tc public.teacher_classes%rowtype;
begin
 if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then
   raise exception 'teacher_authority_required' using errcode='42501';
 end if;
 select tc.* into v_tc from public.teacher_classes tc
 join public.school_members sm on sm.school_id=tc.school_id and sm.profile_id=v_uid and sm.role::text='teacher'
 where tc.id=p_assignment_id and tc.teacher_id=v_uid for update of tc;
 if v_tc.id is null then raise exception 'teacher_assignment_not_authorized' using errcode='42501'; end if;
 if v_tc.is_class_teacher and not exists(
   select 1 from public.teacher_classes other
   where other.class_id=v_tc.class_id and other.school_id=v_tc.school_id
   and other.is_class_teacher and other.id<>v_tc.id
 ) then raise exception 'class_teacher_handover_required' using errcode='42501'; end if;
 begin
   delete from public.teacher_classes where id=v_tc.id and teacher_id=v_uid;
 exception when foreign_key_violation then
   raise exception 'assignment_has_history' using errcode='23503';
 end;
 return jsonb_build_object('removed',true,'assignment_id',v_tc.id,'class_id',v_tc.class_id);
end $$;
revoke all on function public.teacher_remove_class_subject(uuid) from public,anon,service_role;
grant execute on function public.teacher_remove_class_subject(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
