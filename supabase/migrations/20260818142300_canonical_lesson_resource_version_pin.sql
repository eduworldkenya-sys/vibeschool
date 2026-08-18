-- R3.5 exact canonical-version pin for contextual lesson plans.
-- The canonical payload remains reusable inventory; the lesson plan remains the
-- teacher's contextual occurrence. This relation records exactly which immutable
-- version produced that contextual plan.

begin;

create or replace function public.cla_pin_lesson_plan_resource_version(
  p_lesson_plan_id uuid,
  p_resource_id uuid,
  p_resource_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan_teacher uuid;
  v_version public.learning_resource_versions%rowtype;
  v_link public.teaching_resource_links%rowtype;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='CLA_AUTH_REQUIRED';
  end if;

  select lp.teacher_id
  into v_plan_teacher
  from public.lesson_plans lp
  where lp.id = p_lesson_plan_id;

  if v_plan_teacher is null then
    raise exception using errcode='P0002', message='CLA_LESSON_PLAN_NOT_FOUND';
  end if;

  if v_plan_teacher <> v_uid then
    raise exception using errcode='42501', message='CLA_LESSON_PLAN_NOT_OWNED';
  end if;

  select * into v_version
  from public.learning_resource_versions v
  where v.id = p_resource_version_id;

  if v_version.id is null then
    raise exception using errcode='P0002', message='CLA_RESOURCE_VERSION_NOT_FOUND';
  end if;

  if v_version.resource_id <> p_resource_id then
    raise exception using errcode='23514', message='CLA_RESOURCE_VERSION_PIN_MISMATCH';
  end if;

  -- A certified hit is universally reusable. A fresh candidate/verified row
  -- may only be pinned by the same teacher who requested/generated it; this
  -- preserves exact provenance without exposing unverified payloads globally.
  if v_version.lifecycle_status = 'certified' then
    null;
  elsif v_version.lifecycle_status = any(array['candidate','verified']::text[])
        and v_version.created_by = v_uid then
    null;
  else
    raise exception using errcode='42501', message='CLA_RESOURCE_VERSION_NOT_PINNABLE';
  end if;

  select * into v_link
  from public.teaching_resource_links t
  where t.resource_id = p_resource_id
    and t.lesson_plan_id = p_lesson_plan_id
    and t.usage_role = 'source'
  limit 1
  for update;

  if v_link.id is null then
    insert into public.teaching_resource_links(
      resource_id,
      resource_version_id,
      target_type,
      lesson_plan_id,
      usage_role,
      sequence,
      section_refs,
      exercise_refs,
      created_by
    ) values (
      p_resource_id,
      p_resource_version_id,
      'lesson_plan',
      p_lesson_plan_id,
      'source',
      1,
      '[]'::jsonb,
      '[]'::jsonb,
      v_uid
    )
    returning * into v_link;
  else
    update public.teaching_resource_links
    set resource_version_id = p_resource_version_id,
        updated_at = now()
    where id = v_link.id
    returning * into v_link;
  end if;

  return jsonb_build_object(
    'ok',true,
    'link_id',v_link.id,
    'lesson_plan_id',p_lesson_plan_id,
    'resource_id',p_resource_id,
    'resource_version_id',p_resource_version_id,
    'lifecycle_status',v_version.lifecycle_status
  );
end;
$$;

revoke all on function public.cla_pin_lesson_plan_resource_version(uuid,uuid,uuid)
  from public, anon, service_role;
grant execute on function public.cla_pin_lesson_plan_resource_version(uuid,uuid,uuid)
  to authenticated;

comment on function public.cla_pin_lesson_plan_resource_version(uuid,uuid,uuid) is
  'Pins one teacher-owned contextual lesson plan to the exact canonical version that produced it. Certified versions are reusable; candidate/verified pins are restricted to their requesting teacher.';

commit;
