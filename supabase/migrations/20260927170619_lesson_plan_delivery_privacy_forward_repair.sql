begin;

-- Forward repair after 20260927170142. Production inspection proved the live
-- learner SELECT policy did not require publication evidence, and content
-- revision did not clear published_at. Keep learner visibility and delivery
-- evidence aligned with the actual delivered revision.

create or replace function public.lesson_plan_guard_delivery_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'draft'
     and old.status is distinct from 'draft' then
    if new.body is not distinct from old.body
       and new.title is not distinct from old.title
       and new.topic is not distinct from old.topic then
      raise exception 'lesson_plan_delivery_status_only_draft_rollback_denied';
    end if;

    new.published_at := null;
    new.parent_shared_at := null;
    new.student_recipient_count := 0;
    new.parent_recipient_count := 0;
  end if;

  return new;
end;
$$;

revoke all on function public.lesson_plan_guard_delivery_transition() from public;
revoke all on function public.lesson_plan_guard_delivery_transition() from anon;
revoke all on function public.lesson_plan_guard_delivery_transition() from authenticated;

create or replace function public.publish_lesson_plan_to_students(
  p_lesson_plan_id uuid,
  p_expected_school_id uuid,
  p_topic text,
  p_subject text,
  p_teacher_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.lesson_plans%rowtype;
  v_recipient_count integer := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select lp.* into v_plan
  from public.lesson_plans lp
  where lp.id = p_lesson_plan_id
  for update;

  if not found then raise exception 'lesson_plan_not_found'; end if;
  if v_plan.teacher_id is distinct from v_uid then raise exception 'lesson_plan_not_owned'; end if;
  if v_plan.school_id is distinct from p_expected_school_id then raise exception 'lesson_delivery_authority_mismatch'; end if;

  with recipients as (
    select distinct s.profile_id
    from public.student_classes sc
    join public.students s on s.id = sc.student_id
    where sc.school_id = v_plan.school_id
      and sc.class_id = v_plan.class_id
      and sc.is_current = true
      and s.deleted_at is null
      and s.profile_id is not null
  ), written as (
    insert into public.notifications (school_id,user_id,title,body,type,related_id)
    select v_plan.school_id,r.profile_id,
      'New Lesson: ' || trim(coalesce(p_topic, 'Lesson')),
      trim(coalesce(p_subject, 'Lesson')) || ' lesson plan published by ' || trim(coalesce(p_teacher_name, 'your teacher')),
      'lesson_plan',v_plan.id
    from recipients r
    on conflict (user_id, type, related_id) do nothing
    returning 1
  )
  select count(*)::integer into v_recipient_count from recipients;

  update public.lesson_plans
  set status = 'published',
      published_at = coalesce(published_at, clock_timestamp()),
      student_recipient_count = v_recipient_count,
      updated_at = now()
  where id = v_plan.id;

  return jsonb_build_object(
    'lesson_plan_id', v_plan.id,
    'published', true,
    'recipient_count', v_recipient_count
  );
end;
$$;

revoke all on function public.publish_lesson_plan_to_students(uuid, uuid, text, text, text) from public;
revoke all on function public.publish_lesson_plan_to_students(uuid, uuid, text, text, text) from anon;
grant execute on function public.publish_lesson_plan_to_students(uuid, uuid, text, text, text) to authenticated;

drop policy if exists lesson_plans_student_read on public.lesson_plans;
create policy lesson_plans_student_read
on public.lesson_plans
for select
to authenticated
using (
  published_at is not null
  and status in ('published', 'shared_to_parents')
  and exists (
    select 1
    from public.student_classes sc
    join public.students s on s.id = sc.student_id
    where s.profile_id = (select auth.uid())
      and s.deleted_at is null
      and sc.is_current = true
      and sc.school_id = lesson_plans.school_id
      and sc.class_id = lesson_plans.class_id
  )
);

commit;
