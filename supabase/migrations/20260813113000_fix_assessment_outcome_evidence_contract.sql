begin;

alter table public.competency_evidence_ledger
  drop constraint if exists competency_evidence_ledger_evidence_source_check,
  add constraint competency_evidence_ledger_evidence_source_check
  check (evidence_source = any (array[
    'lesson_observation','reading','exercise','homework','project','quiz','cat','exam','submission_mark','assessment_response'
  ]));

create or replace function public.exq_sync_attempt_outcome_evidence(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
  v_assignment public.assessment_assignments%rowtype;
  v_assessment public.assessment_definitions%rowtype;
  rows_written integer := 0;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  if not found then raise exception 'attempt_not_found'; end if;

  select * into v_assignment from public.assessment_assignments where id = v_attempt.assignment_id;
  if not found then raise exception 'assignment_not_found'; end if;
  if v_assignment.teacher_id is distinct from caller then raise exception 'attempt_not_owned'; end if;
  if v_attempt.status not in ('marked','released') then raise exception 'attempt_not_finalized'; end if;

  select * into v_assessment from public.assessment_definitions where id = v_attempt.assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;

  insert into public.competency_evidence_ledger(
    student_id, outcome_id, evidence_source, evidence_id, score, max_score,
    proficiency, observed_by, observed_at, weight, school_id, class_id, subject_id
  )
  select
    v_attempt.student_id,
    aio.outcome_id,
    'assessment_response',
    ar.id,
    ar.final_score,
    ar.max_score,
    case
      when ar.max_score is null or ar.max_score <= 0 then 'not_started'
      when (ar.final_score / ar.max_score) * 100 >= 85 then 'exceeding'
      when (ar.final_score / ar.max_score) * 100 >= 70 then 'meeting'
      when (ar.final_score / ar.max_score) * 100 >= 55 then 'developing'
      when (ar.final_score / ar.max_score) * 100 >= 40 then 'emerging'
      else 'needs_intervention'
    end,
    caller,
    coalesce(v_attempt.teacher_reviewed_at, now()),
    greatest(coalesce(aio.weight, 1), 0.000001),
    v_attempt.school_id,
    v_attempt.class_id,
    v_assessment.subject_id
  from public.assessment_responses ar
  join public.assessment_item_outcomes aio on aio.assessment_item_id = ar.assessment_item_id
  where ar.attempt_id = v_attempt.id
    and ar.final_score is not null
  on conflict (evidence_source, evidence_id, outcome_id)
  do update set
    score = excluded.score,
    max_score = excluded.max_score,
    proficiency = excluded.proficiency,
    observed_by = excluded.observed_by,
    observed_at = excluded.observed_at,
    weight = excluded.weight,
    school_id = excluded.school_id,
    class_id = excluded.class_id,
    subject_id = excluded.subject_id;
  get diagnostics rows_written = row_count;

  insert into public.student_outcome_mastery(
    student_id, outcome_id, mastery_level, mastery_score, evidence_count,
    last_evidence_at, updated_at
  )
  select
    cel.student_id,
    cel.outcome_id,
    case
      when sum(cel.max_score * cel.weight) <= 0 then 'not_started'
      when (sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100 >= 85 then 'exceeding'
      when (sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100 >= 70 then 'meeting'
      when (sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100 >= 55 then 'developing'
      when (sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100 >= 40 then 'emerging'
      else 'needs_intervention'
    end,
    case
      when sum(cel.max_score * cel.weight) > 0
        then round((sum(cel.score * cel.weight) / sum(cel.max_score * cel.weight)) * 100, 2)
      else 0
    end,
    count(*),
    max(cel.observed_at),
    now()
  from public.competency_evidence_ledger cel
  where cel.student_id = v_attempt.student_id
    and cel.outcome_id in (
      select distinct aio.outcome_id
      from public.assessment_responses ar
      join public.assessment_item_outcomes aio on aio.assessment_item_id = ar.assessment_item_id
      where ar.attempt_id = v_attempt.id
    )
  group by cel.student_id, cel.outcome_id
  on conflict (student_id, outcome_id)
  do update set
    mastery_level = excluded.mastery_level,
    mastery_score = excluded.mastery_score,
    evidence_count = excluded.evidence_count,
    last_evidence_at = excluded.last_evidence_at,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'attempt_id', v_attempt.id,
    'evidence_rows', rows_written
  );
end;
$$;

revoke all on function public.exq_sync_attempt_outcome_evidence(uuid) from public, anon;
grant execute on function public.exq_sync_attempt_outcome_evidence(uuid) to authenticated;

commit;
