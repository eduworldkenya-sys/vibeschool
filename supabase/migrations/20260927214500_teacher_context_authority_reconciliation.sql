begin;

-- Retire the legacy onboarding write path as an independent authority.
-- Keep the RPC signature for compatibility, but delegate to the canonical
-- class/subject assignment transaction used by TeacherClassForm.
create or replace function public.onboard_teacher_class(
  p_school_id uuid,
  p_teacher_id uuid,
  p_grade text,
  p_stream text,
  p_subject text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or v_uid <> p_teacher_id then
    raise exception 'unauthorized_identity' using errcode='42501';
  end if;

  return public.create_teacher_class_assignment(
    p_school_id,
    p_grade,
    p_stream,
    p_subject,
    false
  );
end;
$$;

revoke all on function public.onboard_teacher_class(uuid,uuid,text,text,text) from public, anon;
grant execute on function public.onboard_teacher_class(uuid,uuid,text,text,text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
