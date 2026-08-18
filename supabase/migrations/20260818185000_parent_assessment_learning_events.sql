-- Parent Command Center R1: close released-result and published-learning-summary delivery.
-- No new browser-facing tables are introduced here; events are emitted into
-- public.parent_events through the private governed emitter created by R1.

create or replace function private.parent_event_from_assessment_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent record;
  v_title text;
  v_released_at timestamptz;
begin
  if new.student_id is null then return new; end if;
  if new.status <> 'released' or new.result_status <> 'released' then return new; end if;
  if tg_op = 'UPDATE'
     and old.status = 'released'
     and old.result_status = 'released'
     and old.percentage is not distinct from new.percentage
     and old.feedback is not distinct from new.feedback then
    return new;
  end if;

  select ad.title into v_title
  from public.assessment_definitions ad
  where ad.id = new.assessment_id;

  v_released_at := coalesce(new.released_at, new.updated_at, now());

  for v_parent in
    select psl.parent_id
    from public.parent_student_links psl
    where psl.student_id = new.student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_parent.parent_id,
      new.student_id,
      new.school_id,
      'assessment',
      case when new.percentage is not null and new.percentage < 50 then 'warning' else 'success' end,
      'Assessment result released',
      coalesce(v_title, 'Assessment') || case when new.percentage is not null then ' · ' || round(new.percentage)::text || '%' else '' end,
      'assessment_attempts',
      new.id,
      'assessment-release:' || new.id::text || ':' || v_released_at::text,
      '/parent/assessments?studentId=' || new.student_id::text,
      jsonb_build_object(
        'assessment_id', new.assessment_id,
        'assignment_id', new.assignment_id,
        'title', v_title,
        'score', new.score,
        'max_score', new.max_score,
        'percentage', new.percentage,
        'feedback', new.feedback,
        'attempt_number', new.attempt_number
      ),
      v_released_at
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.parent_event_from_assessment_release() from public, anon, authenticated;

drop trigger if exists trg_parent_event_assessment_release on public.assessment_attempts;
create trigger trg_parent_event_assessment_release
after insert or update of status, result_status, percentage, feedback on public.assessment_attempts
for each row execute function private.parent_event_from_assessment_release();

create or replace function private.parent_event_from_learning_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent record;
begin
  if new.student_id is null or new.published_at is null then return new; end if;
  if tg_op = 'UPDATE'
     and old.published_at is not null
     and old.published_at = new.published_at
     and old.summary is not distinct from new.summary
     and old.strengths is not distinct from new.strengths
     and old.focus_areas is not distinct from new.focus_areas
     and old.teacher_comment is not distinct from new.teacher_comment then
    return new;
  end if;

  for v_parent in
    select psl.parent_id
    from public.parent_student_links psl
    where psl.student_id = new.student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_parent.parent_id,
      new.student_id,
      new.school_id,
      'learning',
      'info',
      'New learning summary',
      'A learning update for ' || new.period_start::text || ' to ' || new.period_end::text || ' is ready.',
      'parent_learning_summaries',
      new.id,
      'learning-summary:' || new.id::text || ':' || new.published_at::text,
      '/parent/learn?studentId=' || new.student_id::text,
      jsonb_build_object(
        'period_start', new.period_start,
        'period_end', new.period_end,
        'strengths', new.strengths,
        'focus_areas', new.focus_areas,
        'teacher_comment', new.teacher_comment
      ),
      new.published_at
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.parent_event_from_learning_summary() from public, anon, authenticated;

drop trigger if exists trg_parent_event_learning_summary on public.parent_learning_summaries;
create trigger trg_parent_event_learning_summary
after insert or update of published_at, summary, strengths, focus_areas, teacher_comment on public.parent_learning_summaries
for each row execute function private.parent_event_from_learning_summary();
