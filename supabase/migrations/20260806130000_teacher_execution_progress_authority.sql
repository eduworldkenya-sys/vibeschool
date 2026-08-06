alter table public.progress_records
  add column if not exists teaching_occurrence_id uuid,
  add column if not exists teacher_remarks text,
  add column if not exists next_steps text;

alter table public.progress_records
  drop constraint if exists progress_records_teaching_occurrence_id_fkey;

alter table public.progress_records
  add constraint progress_records_teaching_occurrence_id_fkey
  foreign key (teaching_occurrence_id)
  references public.teaching_occurrences(id)
  on delete set null;

create unique index if not exists progress_records_teaching_occurrence_uidx
  on public.progress_records(teaching_occurrence_id)
  where teaching_occurrence_id is not null;

create index if not exists progress_records_teacher_date_idx
  on public.progress_records(teacher_id, taught_date desc);

create index if not exists progress_records_lesson_plan_idx
  on public.progress_records(lesson_plan_id)
  where lesson_plan_id is not null;

create or replace function public.save_teaching_progress_record(
  p_occurrence_id uuid,
  p_what_was_taught text,
  p_participation_score integer default null,
  p_challenges text default null,
  p_homework_set text default null,
  p_teacher_remarks text default null,
  p_next_steps text default null
)
returns table (
  id uuid,
  teaching_occurrence_id uuid,
  lesson_plan_id uuid,
  taught_date date,
  what_was_taught text,
  participation_score integer,
  challenges text,
  homework_set text,
  teacher_remarks text,
  next_steps text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_occ public.teaching_occurrences%rowtype;
  v_plan_id uuid;
  v_record_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_occurrence_id is null then
    raise exception 'occurrence_required';
  end if;

  if nullif(btrim(coalesce(p_what_was_taught, '')), '') is null then
    raise exception 'what_was_taught_required';
  end if;

  if p_participation_score is not null and (p_participation_score < 1 or p_participation_score > 5) then
    raise exception 'invalid_participation_score';
  end if;

  select * into v_occ
  from public.teaching_occurrences
  where teaching_occurrences.id = p_occurrence_id;

  if not found then
    raise exception 'occurrence_not_found';
  end if;

  if v_occ.teacher_id <> v_uid then
    raise exception 'occurrence_not_owned';
  end if;

  if v_occ.lifecycle <> 'completed' then
    raise exception 'occurrence_not_completed';
  end if;

  select lp.id into v_plan_id
  from public.lesson_plans lp
  where lp.timetable_slot_id = v_occ.timetable_slot_id
    and lp.taught_date = v_occ.occurrence_date
    and lp.teacher_id = v_uid
  limit 1;

  if v_plan_id is null then
    raise exception 'lesson_plan_not_found';
  end if;

  insert into public.progress_records (
    teacher_id,
    school_id,
    class_id,
    subject_id,
    lesson_plan_id,
    teaching_occurrence_id,
    taught_date,
    what_was_taught,
    participation_score,
    challenges,
    homework_set,
    teacher_remarks,
    next_steps,
    updated_at
  ) values (
    v_uid,
    v_occ.school_id,
    v_occ.class_id,
    v_occ.subject_id,
    v_plan_id,
    v_occ.id,
    v_occ.occurrence_date,
    btrim(p_what_was_taught),
    p_participation_score,
    nullif(btrim(coalesce(p_challenges, '')), ''),
    nullif(btrim(coalesce(p_homework_set, '')), ''),
    nullif(btrim(coalesce(p_teacher_remarks, '')), ''),
    nullif(btrim(coalesce(p_next_steps, '')), ''),
    clock_timestamp()
  )
  on conflict (teaching_occurrence_id) where teaching_occurrence_id is not null
  do update set
    lesson_plan_id = excluded.lesson_plan_id,
    taught_date = excluded.taught_date,
    what_was_taught = excluded.what_was_taught,
    participation_score = excluded.participation_score,
    challenges = excluded.challenges,
    homework_set = excluded.homework_set,
    teacher_remarks = excluded.teacher_remarks,
    next_steps = excluded.next_steps,
    school_id = excluded.school_id,
    class_id = excluded.class_id,
    subject_id = excluded.subject_id,
    updated_at = clock_timestamp()
  returning progress_records.id into v_record_id;

  return query
  select
    pr.id,
    pr.teaching_occurrence_id,
    pr.lesson_plan_id,
    pr.taught_date,
    pr.what_was_taught,
    pr.participation_score,
    pr.challenges,
    pr.homework_set,
    pr.teacher_remarks,
    pr.next_steps
  from public.progress_records pr
  where pr.id = v_record_id;
end;
$$;

revoke all on function public.save_teaching_progress_record(uuid, text, integer, text, text, text, text) from public;
revoke all on function public.save_teaching_progress_record(uuid, text, integer, text, text, text, text) from anon;
grant execute on function public.save_teaching_progress_record(uuid, text, integer, text, text, text, text) to authenticated;

comment on function public.save_teaching_progress_record(uuid, text, integer, text, text, text, text)
  is 'Authoritative idempotent writer for the exact completed teaching occurrence record of progress.';
