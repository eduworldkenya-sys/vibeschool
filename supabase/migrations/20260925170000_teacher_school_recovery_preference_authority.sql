begin;

create or replace function public.leave_my_teacher_school(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_active uuid;
  v_remaining uuid[];
  v_count int;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
    then raise exception 'teacher_authority_required' using errcode='42501'; end if;
  if not exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=p_school_id and sm.role::text='teacher')
    then raise exception 'school_membership_required' using errcode='42501'; end if;

  if exists(select 1 from public.teacher_classes tc where tc.teacher_id=v_uid and tc.school_id=p_school_id)
    then raise exception 'teacher_school_has_class_assignments' using errcode='23503'; end if;

  select tap.school_id into v_active
  from public.teacher_active_school_preferences tap
  where tap.teacher_id=v_uid;

  delete from public.school_members
  where profile_id=v_uid and school_id=p_school_id and role::text='teacher';

  select coalesce(array_agg(sm.school_id order by sm.created_at nulls last,sm.school_id),'{}'::uuid[])
    into v_remaining
  from public.school_members sm
  where sm.profile_id=v_uid and sm.role::text='teacher';
  v_count:=coalesce(array_length(v_remaining,1),0);

  if v_active is distinct from p_school_id and v_active is not null
     and exists(select 1 from public.school_members sm where sm.profile_id=v_uid and sm.school_id=v_active and sm.role::text='teacher') then
    -- Non-active membership removed: preserve the canonical preference.
    update public.profiles set school_id=v_active where id=v_uid;
    update public.teacher_profiles set school_id=v_active where profile_id=v_uid;
  elsif v_count=1 then
    perform public.set_my_active_teacher_school(v_remaining[1]);
    v_active:=v_remaining[1];
  else
    delete from public.teacher_active_school_preferences where teacher_id=v_uid;
    update public.profiles set school_id=null where id=v_uid;
    update public.teacher_profiles set school_id=null where profile_id=v_uid;
    v_active:=null;
  end if;

  return jsonb_build_object(
    'state',case when v_count=0 then 'needs_school' when v_active is null then 'needs_active_school' else 'ready' end,
    'active_school_id',v_active,
    'remaining_memberships',v_count
  );
end;
$$;

revoke all on function public.leave_my_teacher_school(uuid) from public,anon,service_role;
grant execute on function public.leave_my_teacher_school(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
