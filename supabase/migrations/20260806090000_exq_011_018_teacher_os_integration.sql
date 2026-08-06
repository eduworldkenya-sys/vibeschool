-- EXQ-011–018: Assessment Engine integration across the Teacher OS.
-- Live production authority applied via Supabase migration.

create table if not exists public.assessment_gradebook_entries (
  attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
  assignment_id uuid not null references public.assessment_assignments(id) on delete cascade,
  assessment_id uuid not null references public.assessment_definitions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  score numeric,
  max_score numeric,
  percentage numeric,
  assessment_type text not null,
  assessment_title text not null,
  released_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assessment_gradebook_student_subject on public.assessment_gradebook_entries(student_id, subject_id, released_at desc);
create index if not exists idx_assessment_gradebook_teacher_class on public.assessment_gradebook_entries(teacher_id, class_id, released_at desc);

alter table public.assessment_gradebook_entries enable row level security;

drop policy if exists assessment_gradebook_teacher_read on public.assessment_gradebook_entries;
create policy assessment_gradebook_teacher_read on public.assessment_gradebook_entries
for select to authenticated
using (teacher_id = auth.uid() or exists (
  select 1 from public.school_members sm
  where sm.profile_id = auth.uid() and sm.school_id = assessment_gradebook_entries.school_id and sm.role::text in ('admin','owner','headteacher')
));

drop policy if exists assessment_gradebook_student_read on public.assessment_gradebook_entries;
create policy assessment_gradebook_student_read on public.assessment_gradebook_entries
for select to authenticated
using (exists (select 1 from public.students s where s.id = student_id and s.profile_id = auth.uid()));

drop policy if exists assessment_gradebook_parent_read on public.assessment_gradebook_entries;
create policy assessment_gradebook_parent_read on public.assessment_gradebook_entries
for select to authenticated
using (exists (
  select 1 from public.parent_student_links psl
  where psl.parent_id = auth.uid() and psl.student_id = assessment_gradebook_entries.student_id
));

create or replace function public.exq_propagate_released_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_teacher uuid;
  v_subject uuid;
  v_title text;
  v_type text;
  v_now timestamptz := now();
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status <> 'released' and v_attempt.result_status <> 'released' then raise exception 'Attempt is not released'; end if;

  select aa.teacher_id, ad.subject_id, ad.title, ad.assessment_type
    into v_teacher, v_subject, v_title, v_type
  from public.assessment_assignments aa
  join public.assessment_definitions ad on ad.id = aa.assessment_id
  where aa.id = v_attempt.assignment_id;

  if v_teacher <> auth.uid() and not exists (
    select 1 from public.school_members sm where sm.profile_id = auth.uid() and sm.school_id = v_attempt.school_id and sm.role::text in ('admin','owner','headteacher')
  ) then raise exception 'Not authorized'; end if;

  insert into public.assessment_gradebook_entries(
    attempt_id, assignment_id, assessment_id, student_id, school_id, class_id,
    subject_id, teacher_id, score, max_score, percentage, assessment_type,
    assessment_title, released_at, updated_at
  ) values (
    v_attempt.id, v_attempt.assignment_id, v_attempt.assessment_id, v_attempt.student_id,
    v_attempt.school_id, v_attempt.class_id, v_subject, v_teacher, v_attempt.score,
    v_attempt.max_score, v_attempt.percentage, v_type, v_title,
    coalesce(v_attempt.teacher_reviewed_at, v_now), v_now
  )
  on conflict (attempt_id) do update set
    score = excluded.score,
    max_score = excluded.max_score,
    percentage = excluded.percentage,
    subject_id = excluded.subject_id,
    teacher_id = excluded.teacher_id,
    assessment_type = excluded.assessment_type,
    assessment_title = excluded.assessment_title,
    released_at = excluded.released_at,
    updated_at = now();

  perform public.exq_sync_attempt_outcome_evidence(v_attempt.id);

  if not exists (select 1 from public.student_learning_timeline where source_type='assessment_attempt' and source_id=v_attempt.id and event_type='assessment_released') then
    insert into public.student_learning_timeline(student_id,event_type,source_type,source_id,subject_id,title,summary,occurred_at,metadata)
    values (v_attempt.student_id,'assessment_released','assessment_attempt',v_attempt.id,v_subject,v_title,
      case when v_attempt.percentage is null then 'Assessment result released' else format('Assessment result released: %s%%', round(v_attempt.percentage,1)) end,
      coalesce(v_attempt.teacher_reviewed_at,v_now),jsonb_build_object('score',v_attempt.score,'max_score',v_attempt.max_score,'percentage',v_attempt.percentage,'assessment_type',v_type));
  end if;

  if v_subject is not null then
    insert into public.student_subject_progress(student_id,subject_id,completed_tasks,total_tasks,average_score,mastery_percentage,updated_at)
    select v_attempt.student_id,v_subject,count(*)::int,count(*)::int,avg(coalesce(g.percentage,0)),
      coalesce((select avg(som.mastery_score) from public.student_outcome_mastery som
        join public.assessment_item_outcomes aio on aio.outcome_id=som.outcome_id
        join public.assessment_items ai on ai.id=aio.assessment_item_id
        where som.student_id=v_attempt.student_id and ai.assessment_id=v_attempt.assessment_id),0),now()
    from public.assessment_gradebook_entries g where g.student_id=v_attempt.student_id and g.subject_id=v_subject
    on conflict (student_id,subject_id) do update set completed_tasks=excluded.completed_tasks,total_tasks=excluded.total_tasks,
      average_score=excluded.average_score,mastery_percentage=excluded.mastery_percentage,updated_at=now();
  end if;

  update public.report_card_subjects rcs
  set assessment_average = stats.avg_percentage,
      mastery_average = stats.avg_mastery,
      growth_percentage = stats.growth,
      evidence_snapshot = jsonb_build_object('gradebook_entries',stats.entry_count,'latest_assessment',v_title,'latest_percentage',v_attempt.percentage,'refreshed_at',now()),
      updated_at = now()
  from (
    select rc.id report_card_id,avg(g.percentage) avg_percentage,
      (select avg(som.mastery_score) from public.student_outcome_mastery som where som.student_id=rc.student_id) avg_mastery,
      max(g.percentage)-min(g.percentage) growth,count(g.*)::int entry_count
    from public.report_cards rc join public.assessment_gradebook_entries g on g.student_id=rc.student_id and g.class_id=rc.class_id
    where rc.student_id=v_attempt.student_id and rc.class_id=v_attempt.class_id group by rc.id,rc.student_id
  ) stats where rcs.report_card_id=stats.report_card_id and (rcs.subject_id=v_subject or v_subject is null);

  return jsonb_build_object('attempt_id',v_attempt.id,'gradebook_synced',true,'competency_synced',true,'timeline_synced',true,'subject_progress_synced',true,'report_card_synced',true);
end;
$$;

create or replace function public.exq_get_teacher_gradebook(p_class_id uuid default null, p_subject_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return jsonb_build_object(
    'entries',coalesce((select jsonb_agg(jsonb_build_object('attempt_id',g.attempt_id,'student_id',g.student_id,'student_name',s.name,'class_id',g.class_id,'subject_id',g.subject_id,'assessment_id',g.assessment_id,'assessment_title',g.assessment_title,'assessment_type',g.assessment_type,'score',g.score,'max_score',g.max_score,'percentage',g.percentage,'released_at',g.released_at) order by g.released_at desc)
      from public.assessment_gradebook_entries g join public.students s on s.id=g.student_id where g.teacher_id=auth.uid() and (p_class_id is null or g.class_id=p_class_id) and (p_subject_id is null or g.subject_id=p_subject_id)),'[]'::jsonb),
    'summary',coalesce((select jsonb_build_object('entry_count',count(*),'average_percentage',avg(g.percentage),'highest_percentage',max(g.percentage),'lowest_percentage',min(g.percentage)) from public.assessment_gradebook_entries g where g.teacher_id=auth.uid() and (p_class_id is null or g.class_id=p_class_id) and (p_subject_id is null or g.subject_id=p_subject_id)),'{}'::jsonb));
end;$$;

create or replace function public.exq_get_parent_assessment_summary(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists (select 1 from public.parent_student_links where parent_id=auth.uid() and student_id=p_student_id) then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'results',coalesce((select jsonb_agg(jsonb_build_object('attempt_id',g.attempt_id,'assessment_title',g.assessment_title,'assessment_type',g.assessment_type,'score',g.score,'max_score',g.max_score,'percentage',g.percentage,'released_at',g.released_at,'teacher_feedback',a.feedback,'subject_id',g.subject_id) order by g.released_at desc) from public.assessment_gradebook_entries g join public.assessment_attempts a on a.id=g.attempt_id where g.student_id=p_student_id),'[]'::jsonb),
    'progress',coalesce((select jsonb_agg(to_jsonb(sp)) from public.student_subject_progress sp where sp.student_id=p_student_id),'[]'::jsonb),
    'interventions',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'priority',i.priority,'recommendation',i.recommendation,'status',i.status,'due_at',i.due_at)) from public.assessment_interventions i where i.student_id=p_student_id and i.status<>'completed'),'[]'::jsonb));
end;$$;

create or replace function public.exq_get_learner_assessment_hub()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_student uuid;
begin
  select id into v_student from public.students where profile_id=auth.uid() limit 1;
  if v_student is null then raise exception 'Student profile not found'; end if;
  return jsonb_build_object(
    'results',coalesce((select jsonb_agg(jsonb_build_object('attempt_id',g.attempt_id,'assessment_title',g.assessment_title,'assessment_type',g.assessment_type,'score',g.score,'max_score',g.max_score,'percentage',g.percentage,'released_at',g.released_at,'feedback',a.feedback,'subject_id',g.subject_id) order by g.released_at desc) from public.assessment_gradebook_entries g join public.assessment_attempts a on a.id=g.attempt_id where g.student_id=v_student),'[]'::jsonb),
    'recommendations',coalesce((select jsonb_agg(to_jsonb(r) order by r.priority_score desc) from public.student_learning_recommendations r where r.student_id=v_student and r.status='active'),'[]'::jsonb),
    'timeline',coalesce((select jsonb_agg(to_jsonb(t) order by t.occurred_at desc) from public.student_learning_timeline t where t.student_id=v_student and t.source_type='assessment_attempt'),'[]'::jsonb));
end;$$;

create or replace function public.exq_get_teacher_pulse_summary()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return jsonb_build_object(
    'awaiting_marking',(select count(*) from public.assessment_attempts a join public.assessment_assignments aa on aa.id=a.assignment_id where aa.teacher_id=auth.uid() and a.status in ('submitted','teacher_review')),
    'partially_marked',(select count(*) from public.assessment_attempts a join public.assessment_assignments aa on aa.id=a.assignment_id where aa.teacher_id=auth.uid() and a.result_status='partially_marked'),
    'ready_to_release',(select count(*) from public.assessment_attempts a join public.assessment_assignments aa on aa.id=a.assignment_id where aa.teacher_id=auth.uid() and a.status='marked' and a.result_status<>'released'),
    'pending_moderation',(select count(*) from public.assessment_moderation_requests mr where mr.requested_by=auth.uid() and mr.status='pending'),
    'high_priority_interventions',(select count(*) from public.assessment_interventions i where i.teacher_id=auth.uid() and i.status<>'completed' and i.priority='high'));
end;$$;

revoke all on function public.exq_propagate_released_attempt(uuid) from public,anon;
revoke all on function public.exq_get_teacher_gradebook(uuid,uuid) from public,anon;
revoke all on function public.exq_get_parent_assessment_summary(uuid) from public,anon;
revoke all on function public.exq_get_learner_assessment_hub() from public,anon;
revoke all on function public.exq_get_teacher_pulse_summary() from public,anon;
grant execute on function public.exq_propagate_released_attempt(uuid) to authenticated;
grant execute on function public.exq_get_teacher_gradebook(uuid,uuid) to authenticated;
grant execute on function public.exq_get_parent_assessment_summary(uuid) to authenticated;
grant execute on function public.exq_get_learner_assessment_hub() to authenticated;
grant execute on function public.exq_get_teacher_pulse_summary() to authenticated;
