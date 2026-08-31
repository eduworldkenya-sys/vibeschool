-- Harden canonical scheme generation so an unassigned class cannot be claimed
-- merely by knowing its UUID. Authorization must come from school-admin authority,
-- direct class ownership, or the canonical teacher_classes assignment for the subject.

alter function public.generate_scheme_from_curriculum(uuid,uuid,uuid,boolean)
  rename to generate_scheme_from_curriculum_internal;
revoke all on function public.generate_scheme_from_curriculum_internal(uuid,uuid,uuid,boolean)
  from public, anon, authenticated;

create or replace function public.generate_scheme_from_curriculum(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_replace_planned boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_class_teacher_id uuid;
  v_allowed boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;

  select c.school_id,c.teacher_id
    into v_school_id,v_class_teacher_id
  from public.classes c
  where c.id=p_class_id;
  if v_school_id is null then
    return jsonb_build_object('ok',false,'reason','class_not_found');
  end if;

  v_allowed := public.is_school_admin(v_school_id)
    or v_class_teacher_id=v_uid
    or exists(
      select 1
      from public.teacher_classes tc
      where tc.school_id=v_school_id
        and tc.teacher_id=v_uid
        and tc.class_id=p_class_id
        and tc.subject_id=p_subject_id
    );

  if not v_allowed then
    return jsonb_build_object('ok',false,'reason','not_authorized');
  end if;

  return public.generate_scheme_from_curriculum_internal(
    p_class_id,p_subject_id,p_academic_term_id,p_replace_planned
  );
end;
$$;

grant execute on function public.generate_scheme_from_curriculum(uuid,uuid,uuid,boolean)
  to authenticated;

alter function public.ensure_scheme_from_curriculum(uuid,uuid,uuid)
  rename to ensure_scheme_from_curriculum_internal;
revoke all on function public.ensure_scheme_from_curriculum_internal(uuid,uuid,uuid)
  from public, anon, authenticated;

create or replace function public.ensure_scheme_from_curriculum(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_class_teacher_id uuid;
  v_allowed boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'reason','auth_required');
  end if;

  select c.school_id,c.teacher_id
    into v_school_id,v_class_teacher_id
  from public.classes c
  where c.id=p_class_id;
  if v_school_id is null then
    return jsonb_build_object('ok',false,'reason','class_not_found');
  end if;

  v_allowed := public.is_school_admin(v_school_id)
    or v_class_teacher_id=v_uid
    or exists(
      select 1
      from public.teacher_classes tc
      where tc.school_id=v_school_id
        and tc.teacher_id=v_uid
        and tc.class_id=p_class_id
        and tc.subject_id=p_subject_id
    );

  if not v_allowed then
    return jsonb_build_object('ok',false,'reason','not_authorized');
  end if;

  return public.ensure_scheme_from_curriculum_internal(
    p_class_id,p_subject_id,p_academic_term_id
  );
end;
$$;

grant execute on function public.ensure_scheme_from_curriculum(uuid,uuid,uuid)
  to authenticated;
