-- Canonical LearningCheckpoint authority
-- Inline textbook checkpoints reuse content learning events + competency evidence/mastery.
-- Formal assigned quizzes/tests/exams continue to use assessment_attempts/responses.

create or replace function public.record_learning_checkpoint_attempt(
  publication_id_input uuid,
  chapter_id_input uuid,
  block_id_input uuid,
  checkpoint_id_input text,
  checkpoint_type_input text,
  response_input jsonb,
  is_correct_input boolean,
  misconception_label_input text default null,
  remediation_target_input text default null,
  outcome_ids_input uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid := public.current_student_id();
  v_event_id uuid;
  v_outcome_id uuid;
  v_evidence_id uuid;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if v_student_id is null then raise exception 'canonical learner identity required'; end if;
  if checkpoint_type_input not in ('multiple_choice','sequence_builder','source_analysis','structured_response','essay_evaluation') then
    raise exception 'invalid checkpoint type';
  end if;
  if not exists (
    select 1 from public.vibe_chapters c
    where c.id = chapter_id_input and c.publication_id = publication_id_input
  ) then raise exception 'checkpoint chapter lineage mismatch'; end if;
  if block_id_input is null or not exists (
    select 1 from public.content_blocks b
    where b.id = block_id_input
      and b.publication_id = publication_id_input
      and b.chapter_id = chapter_id_input
      and b.status = 'published'
      and b.is_teacher_only = false
  ) then raise exception 'checkpoint block lineage mismatch'; end if;

  v_event_id := public.record_content_learning_event(
    publication_id_input,
    chapter_id_input,
    block_id_input,
    null,
    case when is_correct_input then 'question_correct' else 'question_incorrect' end,
    null,
    jsonb_build_object(
      'interaction_kind', 'learning_checkpoint',
      'checkpoint_id', checkpoint_id_input,
      'checkpoint_type', checkpoint_type_input,
      'response', coalesce(response_input, '{}'::jsonb),
      'is_correct', is_correct_input,
      'misconception_label', nullif(btrim(misconception_label_input), ''),
      'remediation_target', nullif(btrim(remediation_target_input), '')
    )
  );

  foreach v_outcome_id in array coalesce(outcome_ids_input, '{}'::uuid[]) loop
    if exists (
      select 1
      from public.content_block_outcome_links l
      join public.curriculum_learning_outcomes o on o.id = l.outcome_id and o.status = 'verified'
      where l.content_block_id = block_id_input and l.outcome_id = v_outcome_id
    ) then
      insert into public.competency_evidence_ledger(
        student_id, outcome_id, evidence_source, evidence_id,
        score, max_score, proficiency, observed_by, observed_at, notes, weight
      ) values (
        v_student_id,
        v_outcome_id,
        'quiz',
        v_event_id,
        case when is_correct_input then 1 else 0 end,
        1,
        case when is_correct_input then 'meeting' else 'needs_intervention' end,
        v_uid,
        now(),
        'Inline LearningCheckpoint evidence',
        1
      ) returning id into v_evidence_id;

      perform public.ce_refresh_student_outcome_mastery(v_student_id, v_outcome_id);
    end if;
  end loop;

  return v_event_id;
end;
$$;

revoke all on function public.record_learning_checkpoint_attempt(uuid,uuid,uuid,text,text,jsonb,boolean,text,text,uuid[]) from public, anon;
grant execute on function public.record_learning_checkpoint_attempt(uuid,uuid,uuid,text,text,jsonb,boolean,text,text,uuid[]) to authenticated, service_role;
