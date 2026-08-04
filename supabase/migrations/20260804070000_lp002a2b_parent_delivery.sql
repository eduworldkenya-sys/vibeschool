-- LP-002A2B — canonical, idempotent parent lesson delivery
--
-- Additive only:
-- - existing parent messages remain untouched;
-- - historical rows retain lesson_plan_id = null;
-- - new lesson-plan deliveries go through one guarded RPC;
-- - one canonical row is maintained per lesson, learner and purpose.

alter table public.parent_messages
  add column if not exists lesson_plan_id uuid
    references public.lesson_plans(id) on delete set null,
  add column if not exists delivery_purpose text;

comment on column public.parent_messages.lesson_plan_id is
  'Canonical lesson plan that caused this parent delivery. Null for historical or non-lesson messages.';

comment on column public.parent_messages.delivery_purpose is
  'Stable idempotency purpose for system-generated deliveries. Null for historical or manual messages.';

alter table public.parent_messages
  drop constraint if exists parent_messages_channel_check;

alter table public.parent_messages
  add constraint parent_messages_channel_check
  check (
    channel in ('sms', 'whatsapp', 'email', 'in_app')
  );

alter table public.parent_messages
  drop constraint if exists parent_messages_generated_by_check;

alter table public.parent_messages
  add constraint parent_messages_generated_by_check
  check (
    generated_by in ('manual', 'twin', 'lesson_plan')
  );

alter table public.parent_messages
  drop constraint if exists parent_messages_lesson_delivery_identity_check;

alter table public.parent_messages
  add constraint parent_messages_lesson_delivery_identity_check
  check (
    (
      lesson_plan_id is null
      and delivery_purpose is null
    )
    or
    (
      lesson_plan_id is not null
      and delivery_purpose in ('lesson_summary')
    )
  );

create unique index if not exists
  uq_parent_messages_lesson_student_purpose
on public.parent_messages (
  lesson_plan_id,
  student_id,
  delivery_purpose
)
where lesson_plan_id is not null;

create index if not exists
  idx_parent_messages_lesson_plan_id
on public.parent_messages (lesson_plan_id)
where lesson_plan_id is not null;

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
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_lesson_plan_id is null then
    raise exception 'lesson_plan_required';
  end if;

  if p_delivery_purpose is distinct from 'lesson_summary' then
    raise exception 'invalid_delivery_purpose';
  end if;

  if length(trim(coalesce(p_subject, ''))) = 0 then
    raise exception 'subject_required';
  end if;

  if length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'body_required';
  end if;

  select lp.*
  into v_plan
  from public.lesson_plans lp
  where lp.id = p_lesson_plan_id;

  if not found then
    raise exception 'lesson_plan_not_found';
  end if;

  select coalesce(v_plan.school_id, c.school_id)
  into v_school_id
  from public.classes c
  where c.id = v_plan.class_id;

  if v_school_id is null then
    raise exception 'school_context_missing';
  end if;

  if
    v_plan.teacher_id is distinct from v_uid
    and not public.is_school_admin(v_school_id)
  then
    raise exception 'not_authorized';
  end if;

  with active_students as (
    select s.id as student_id
    from public.students s
    where s.class_id = v_plan.class_id
      and s.deleted_at is null
  ),
  written as (
    insert into public.parent_messages (
      school_id,
      teacher_id,
      student_id,
      channel,
      subject,
      body,
      generated_by,
      sent_at,
      lesson_plan_id,
      delivery_purpose
    )
    select
      v_school_id,
      v_plan.teacher_id,
      active_students.student_id,
      'in_app',
      trim(p_subject),
      trim(p_body),
      'lesson_plan',
      clock_timestamp(),
      v_plan.id,
      p_delivery_purpose
    from active_students
    on conflict (
      lesson_plan_id,
      student_id,
      delivery_purpose
    )
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
  into
    v_recipient_count,
    v_inserted_count,
    v_updated_count
  from written;

  return jsonb_build_object(
    'lesson_plan_id', v_plan.id,
    'delivery_purpose', p_delivery_purpose,
    'recipient_count', v_recipient_count,
    'inserted_count', v_inserted_count,
    'updated_count', v_updated_count
  );
end;
$$;

revoke all on function public.deliver_lesson_plan_to_parents(
  uuid,
  text,
  text,
  text
) from public;

revoke all on function public.deliver_lesson_plan_to_parents(
  uuid,
  text,
  text,
  text
) from anon;

grant execute on function public.deliver_lesson_plan_to_parents(
  uuid,
  text,
  text,
  text
) to authenticated;

comment on function public.deliver_lesson_plan_to_parents(
  uuid,
  text,
  text,
  text
) is
  'LP-002A2B guarded idempotent delivery of one lesson-plan summary to every active learner in the authoritative lesson class.';
