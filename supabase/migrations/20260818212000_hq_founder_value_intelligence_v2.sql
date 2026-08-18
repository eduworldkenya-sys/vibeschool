begin;

create or replace function public.hq_founder_value_intelligence()
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'owner_authorization_required';
  end if;

  return (
    with active_learners_7d as (
      select student_id from public.student_learning_events where student_id is not null and occurred_at >= now()-interval '7 days'
      union
      select student_id from public.content_learning_events where student_id is not null and occurred_at >= now()-interval '7 days'
      union
      select student_id from public.vibe_reading_sessions where student_id is not null and last_active_at >= now()-interval '7 days'
      union
      select student_id from public.student_adaptive_learning_sessions where student_id is not null and started_at >= now()-interval '7 days'
    ),
    active_teachers_7d as (
      select teacher_id from public.lesson_plans where teacher_id is not null and created_at >= now()-interval '7 days'
      union
      select teacher_id from public.homework where teacher_id is not null and created_at >= now()-interval '7 days'
    ),
    progressing_learners_30d as (
      select student_id from public.student_adaptive_learning_sessions
      where student_id is not null and completed_at >= now()-interval '30 days'
        and mastery_before is not null and mastery_after is not null and mastery_after > mastery_before
      union
      select student_id from public.learner_outcomes
      where student_id is not null and assessed_at >= now()-interval '30 days'
        and lower(coalesce(status,'')) in ('proficient','mastered')
    ),
    teacher_activation as (
      select distinct tc.teacher_id
      from public.teacher_classes tc
      join public.profiles p on p.id=tc.teacher_id
      where p.role='teacher' and not coalesce(p.is_anonymized,false)
    ),
    school_activity_30d as (
      select school_id from public.lesson_plans where school_id is not null and created_at >= now()-interval '30 days'
      union
      select school_id from public.homework where school_id is not null and created_at >= now()-interval '30 days'
      union
      select school_id from public.platform_events where school_id is not null and occurred_at >= now()-interval '30 days'
    )
    select jsonb_build_object(
      'north_star', jsonb_build_object(
        'learners_with_learning_evidence_7d', (select count(*) from active_learners_7d),
        'learners_progressing_30d', (select count(*) from progressing_learners_30d),
        'teachers_creating_learning_value_7d', (select count(*) from active_teachers_7d)
      ),
      'activation', jsonb_build_object(
        'teacher_profiles', (select count(*) from public.profiles where role='teacher' and not coalesce(is_anonymized,false)),
        'teachers_with_class', (select count(*) from teacher_activation),
        'student_profiles', (select count(*) from public.profiles where role='student' and not coalesce(is_anonymized,false)),
        'students_with_canonical_identity', (select count(*) from public.students where profile_id is not null and deleted_at is null),
        'parent_profiles', (select count(*) from public.profiles where role='parent' and not coalesce(is_anonymized,false)),
        'parents_linked_to_student', (select count(distinct parent_id) from public.parent_student_links)
      ),
      'learning_7d', jsonb_build_object(
        'active_learners', (select count(*) from active_learners_7d),
        'student_learning_events', (select count(*) from public.student_learning_events where occurred_at >= now()-interval '7 days'),
        'content_learning_events', (select count(*) from public.content_learning_events where occurred_at >= now()-interval '7 days'),
        'reading_sessions', (select count(*) from public.vibe_reading_sessions where last_active_at >= now()-interval '7 days'),
        'adaptive_sessions', (select count(*) from public.student_adaptive_learning_sessions where started_at >= now()-interval '7 days')
      ),
      'teaching_7d', jsonb_build_object(
        'active_teachers', (select count(*) from active_teachers_7d),
        'lesson_plans_created', (select count(*) from public.lesson_plans where created_at >= now()-interval '7 days'),
        'homework_created', (select count(*) from public.homework where created_at >= now()-interval '7 days'),
        'homework_submissions', (select count(*) from public.homework_submissions where coalesce(submitted_at,created_at) >= now()-interval '7 days')
      ),
      'mastery_30d', jsonb_build_object(
        'learners_progressing', (select count(*) from progressing_learners_30d),
        'assessed_learners', (select count(distinct student_id) from public.learner_outcomes where assessed_at >= now()-interval '30 days'),
        'proficient_or_mastered_outcomes', (select count(*) from public.learner_outcomes where assessed_at >= now()-interval '30 days' and lower(coalesce(status,'')) in ('proficient','mastered')),
        'adaptive_mastery_gain_sessions', (select count(*) from public.student_adaptive_learning_sessions where completed_at >= now()-interval '30 days' and mastery_before is not null and mastery_after is not null and mastery_after > mastery_before)
      ),
      'schools', jsonb_build_object(
        'active_30d', (select count(*) from school_activity_30d),
        'with_teacher_members', (select count(distinct school_id) from public.school_members where role::text='teacher'),
        'with_learning_value_30d', (select count(distinct school_id) from public.lesson_plans where school_id is not null and created_at >= now()-interval '30 days')
      ),
      'coverage', jsonb_build_object(
        'product_event_kernel_present', to_regclass('public.platform_events') is not null,
        'learning_event_kernel_present', to_regclass('public.student_learning_events') is not null,
        'mastery_evidence_present', to_regclass('public.learner_outcomes') is not null,
        'cohort_retention_instrumented', false,
        'acquisition_attribution_instrumented', false,
        'experiment_registry_instrumented', false
      )
    )
  );
end;
$$;

revoke all on function public.hq_founder_value_intelligence() from public,anon;
grant execute on function public.hq_founder_value_intelligence() to authenticated;

commit;
