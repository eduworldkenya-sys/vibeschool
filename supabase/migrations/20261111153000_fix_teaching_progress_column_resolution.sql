-- Resolve the upsert target against progress_records rather than the RETURNS TABLE variables.
CREATE OR REPLACE FUNCTION public.save_teaching_progress_record(p_occurrence_id uuid, p_what_was_taught text, p_participation_score integer DEFAULT NULL::integer, p_challenges text DEFAULT NULL::text, p_homework_set text DEFAULT NULL::text, p_teacher_remarks text DEFAULT NULL::text, p_next_steps text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, teaching_occurrence_id uuid, lesson_plan_id uuid, taught_date date, what_was_taught text, participation_score integer, challenges text, homework_set text, teacher_remarks text, next_steps text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
#variable_conflict use_column
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
$function$
;
