begin;

-- Lesson Plan delivery-state hardening.
-- Student publication and parent sharing are independent durable facts. The
-- existing status remains a compatibility/last-action presentation field;
-- published_at and parent_shared_at are the authoritative channel facts.
alter table public.lesson_plans
  add column if not exists parent_shared_at timestamptz,
  add column if not exists student_recipient_count integer not null default 0,
  add column if not exists parent_recipient_count integer not null default 0;

alter table public.lesson_plans
  drop constraint if exists lesson_plans_student_recipient_count_check;
alter table public.lesson_plans
  add constraint lesson_plans_student_recipient_count_check
  check (student_recipient_count >= 0);

alter table public.lesson_plans
  drop constraint if exists lesson_plans_parent_recipient_count_check;
alter table public.lesson_plans
  add constraint lesson_plans_parent_recipient_count_check
  check (parent_recipient_count >= 0);

comment on column public.lesson_plans.published_at is
  'Durable first learner-publication time. Independent of parent sharing status.';
comment on column public.lesson_plans.parent_shared_at is
  'Most recent successful parent lesson-summary delivery time. Null means no parent recipient has received the summary.';
comment on column public.lesson_plans.student_recipient_count is
  'Number of linked learner profiles targeted by the most recent learner publication.';
comment on column public.lesson_plans.parent_recipient_count is
  'Number of active learners with parent-message delivery rows in the most recent successful parent share.';

-- Do not permit a delivered lesson to be silently returned to draft through an
-- alternate caller. A later explicit revision workflow must model revision as
-- its own operation rather than erasing delivery history.
create or replace function public.lesson_plan_guard_delivery_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'draft'
     and old.status is distinct from 'draft' then
    raise exception 'lesson_plan_delivery_cannot_return_to_draft';
  end if;
  return new;
end;
$$;

revoke all on function public.lesson_plan_guard_delivery_transition() from public;
revoke all on function public.lesson_plan_guard_delivery_transition() from anon;
revoke all on function public.lesson_plan_guard_delivery_transition() from authenticated;

drop trigger if exists trg_lesson_plan_guard_delivery_transition on public.lesson_plans;
create trigger trg_lesson_plan_guard_delivery_transition
before update of status on public.lesson_plans
for each row
execute function public.lesson_plan_guard_delivery_transition();

-- Atomic learner publication. Readiness is evaluated by the canonical client
-- validator immediately before this RPC; this database boundary owns authority,
-- recipient resolution, notification writes and publication state in one txn.
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
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select lp.* into v_plan
  from public.lesson_plans lp
  where lp.id = p_lesson_plan_id
  for update;

  if not found then
    raise exception 'lesson_plan_not_found';
  end if;

  if v_plan.teacher_id is distinct from v_uid then
    raise exception 'lesson_plan_not_owned';
  end if;

  if v_plan.school_id is distinct from p_expected_school_id then
    raise exception 'lesson_delivery_authority_mismatch';
  end if;

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
    insert into public.notifications (
      school_id,
      user_id,
      title,
      body,
      type,
      related_id
    )
    select
      v_plan.school_id,
      r.profile_id,
      'New Lesson: ' || trim(coalesce(p_topic, 'Lesson')),
      trim(coalesce(p_subject, 'Lesson')) || ' lesson plan published by ' || trim(coalesce(p_teacher_name, 'your teacher')),
      'lesson_plan',
      v_plan.id
    from recipients r
    on conflict (user_id, type, related_id) do nothing
    returning 1
  )
  select count(*)::integer into v_recipient_count
  from recipients;

  update public.lesson_plans
  set status = 'published',
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

-- Replace parent delivery with canonical current-enrollment authority and stamp
-- parent sharing only when at least one recipient was actually materialized.
create or replace function public.deliver_lesson_plan_to_parents(
  p_lesson_plan_id uuid,
  p_delivery_purpose text,
  p_subject text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.lesson_plans%rowtype;
  v_school_id uuid;
  v_recipient_count integer := 0;
  v_inserted_count integer := 0;
  v_updated_count integer := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_lesson_plan_id is null then raise exception 'lesson_plan_required'; end if;
  if p_delivery_purpose is distinct from 'lesson_summary' then raise exception 'invalid_delivery_purpose'; end if;
  if length(trim(coalesce(p_subject, ''))) = 0 then raise exception 'subject_required'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'body_required'; end if;

  select lp.* into v_plan
  from public.lesson_plans lp
  where lp.id = p_lesson_plan_id
  for update;

  if not found then raise exception 'lesson_plan_not_found'; end if;

  v_school_id := v_plan.school_id;
  if v_school_id is null then raise exception 'school_context_missing'; end if;

  if v_plan.teacher_id is distinct from v_uid
     and not public.is_school_admin(v_school_id) then
    raise exception 'not_authorized';
  end if;

  with active_students as (
    select distinct s.id as student_id
    from public.student_classes sc
    join public.students s on s.id = sc.student_id
    where sc.school_id = v_school_id
      and sc.class_id = v_plan.class_id
      and sc.is_current = true
      and s.deleted_at is null
  ), written as (
    insert into public.parent_messages (
      school_id, teacher_id, student_id, channel, subject, body,
      generated_by, sent_at, lesson_plan_id, delivery_purpose
    )
    select
      v_school_id, v_plan.teacher_id, a.student_id, 'in_app',
      trim(p_subject), trim(p_body), 'lesson_plan', clock_timestamp(),
      v_plan.id, p_delivery_purpose
    from active_students a
    on conflict (lesson_plan_id, student_id, delivery_purpose)
    where lesson_plan_id is not null
    do update set
      school_id = excluded.school_id,
      teacher_id = excluded.teacher_id,
      channel = excluded.channel,
      subject = excluded.subject,
      body = excluded.body,
      generated_by = excluded.generated_by,
      sent_at = clock_timestamp()
    returning (xmax = 0) as inserted
  )
  select
    count(*)::integer,
    count(*) filter (where inserted)::integer,
    count(*) filter (where not inserted)::integer
  into v_recipient_count, v_inserted_count, v_updated_count
  from written;

  if v_recipient_count > 0 then
    update public.lesson_plans
    set status = 'shared_to_parents',
        parent_shared_at = clock_timestamp(),
        parent_recipient_count = v_recipient_count,
        updated_at = now()
    where id = v_plan.id;
  else
    update public.lesson_plans
    set parent_recipient_count = 0,
        updated_at = now()
    where id = v_plan.id;
  end if;

  return jsonb_build_object(
    'lesson_plan_id', v_plan.id,
    'delivery_purpose', p_delivery_purpose,
    'recipient_count', v_recipient_count,
    'inserted_count', v_inserted_count,
    'updated_count', v_updated_count,
    'shared', v_recipient_count > 0
  );
end;
$$;

revoke all on function public.deliver_lesson_plan_to_parents(uuid, text, text, text) from public;
revoke all on function public.deliver_lesson_plan_to_parents(uuid, text, text, text) from anon;
grant execute on function public.deliver_lesson_plan_to_parents(uuid, text, text, text) to authenticated;

commit;
