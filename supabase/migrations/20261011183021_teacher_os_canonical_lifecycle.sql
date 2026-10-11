begin;

-- One immutable curriculum identity from planning through delivery.
alter table public.scheme_of_work add column if not exists curriculum_outcome_id uuid references public.curriculum_learning_outcomes(id) on delete restrict;
alter table public.lesson_plans add column if not exists curriculum_outcome_id uuid references public.curriculum_learning_outcomes(id) on delete restrict;
alter table public.lesson_evidence add column if not exists outcome_id uuid references public.curriculum_learning_outcomes(id) on delete restrict;
alter table public.lesson_evidence add column if not exists success_criterion_id uuid;
alter table public.lesson_evidence add column if not exists judgement text check (judgement is null or judgement in ('mastered','developing','needs_support'));
alter table public.lesson_evidence add column if not exists max_score numeric check (max_score is null or max_score > 0);
alter table public.lesson_evidence add constraint lesson_evidence_score_has_scale check (score is null or (max_score is not null and score between 0 and max_score)) not valid;

create index if not exists scheme_of_work_outcome_idx on public.scheme_of_work(curriculum_outcome_id);
create index if not exists lesson_plans_outcome_idx on public.lesson_plans(curriculum_outcome_id);
create index if not exists lesson_evidence_outcome_idx on public.lesson_evidence(outcome_id);

-- Keep the protected timetable/occurrence authority structurally stable. The
-- immutable curriculum binding is a one-to-one relation, not a second lifecycle.
-- authorization-test: public.teaching_occurrence_outcomes teacher assignment and cross-school denial
create table if not exists public.teaching_occurrence_outcomes (
  teaching_occurrence_id uuid primary key references public.teaching_occurrences(id) on delete cascade,
  curriculum_outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  lesson_plan_id uuid not null references public.lesson_plans(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  bound_at timestamptz not null default now()
);
alter table public.teaching_occurrence_outcomes enable row level security;
create policy teaching_occurrence_outcomes_teacher_read on public.teaching_occurrence_outcomes for select to authenticated
  using(teacher_id=auth.uid() and exists(select 1 from public.teaching_occurrences o where o.id=teaching_occurrence_id and o.school_id=teaching_occurrence_outcomes.school_id and o.teacher_id=auth.uid()));
grant select on public.teaching_occurrence_outcomes to authenticated;

create or replace function public.teacher_os_bind_outcome_lineage()
returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_scheme_outcome uuid;
begin
  if tg_table_name='lesson_plans' then
    if new.scheme_id is not null then
      select curriculum_outcome_id into v_scheme_outcome from public.scheme_of_work where id=new.scheme_id;
      if v_scheme_outcome is null then raise exception 'scheme_outcome_required'; end if;
      if new.curriculum_outcome_id is not null and new.curriculum_outcome_id<>v_scheme_outcome then raise exception 'lesson_plan_outcome_mismatch'; end if;
      new.curriculum_outcome_id:=v_scheme_outcome;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.teacher_os_bind_outcome_lineage() from public,anon,authenticated;
drop trigger if exists lesson_plan_bind_outcome_lineage on public.lesson_plans;
create trigger lesson_plan_bind_outcome_lineage before insert or update of scheme_id,curriculum_outcome_id on public.lesson_plans for each row execute function public.teacher_os_bind_outcome_lineage();

create or replace function public.bind_teaching_occurrence_outcome(p_occurrence_id uuid,p_lesson_plan_id uuid)
returns public.teaching_occurrence_outcomes language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_o public.teaching_occurrences; v_lp public.lesson_plans; v_result public.teaching_occurrence_outcomes;
begin
  select * into v_o from public.teaching_occurrences where id=p_occurrence_id and teacher_id=auth.uid() for update;
  if not found then raise exception 'occurrence_not_owned'; end if;
  select * into v_lp from public.lesson_plans where id=p_lesson_plan_id and teacher_id=auth.uid();
  if not found then raise exception 'lesson_plan_not_owned'; end if;
  if v_lp.curriculum_outcome_id is null then raise exception 'lesson_plan_outcome_required'; end if;
  if v_lp.school_id is distinct from v_o.school_id or v_lp.class_id is distinct from v_o.class_id or v_lp.subject_id is distinct from v_o.subject_id or v_lp.timetable_slot_id is distinct from v_o.timetable_slot_id or v_lp.taught_date is distinct from v_o.occurrence_date then raise exception 'occurrence_plan_identity_mismatch'; end if;
  insert into public.teaching_occurrence_outcomes(teaching_occurrence_id,curriculum_outcome_id,lesson_plan_id,school_id,teacher_id)
    values(v_o.id,v_lp.curriculum_outcome_id,v_lp.id,v_o.school_id,v_o.teacher_id)
    on conflict(teaching_occurrence_id) do update set
      curriculum_outcome_id=case when teaching_occurrence_outcomes.curriculum_outcome_id=excluded.curriculum_outcome_id then excluded.curriculum_outcome_id else teaching_occurrence_outcomes.curriculum_outcome_id end,
      lesson_plan_id=case when teaching_occurrence_outcomes.curriculum_outcome_id=excluded.curriculum_outcome_id then excluded.lesson_plan_id else teaching_occurrence_outcomes.lesson_plan_id end
    returning * into v_result;
  if v_result.curriculum_outcome_id<>v_lp.curriculum_outcome_id then raise exception 'occurrence_outcome_immutable'; end if;
  return v_result;
end $$;
revoke all on function public.bind_teaching_occurrence_outcome(uuid,uuid) from public,anon;
grant execute on function public.bind_teaching_occurrence_outcome(uuid,uuid) to authenticated;

-- Start and immutable outcome binding share one transaction. Any binding
-- failure rolls the legacy occurrence transition back as well.
create or replace function public.start_teaching_occurrence_v2(p_timetable_slot_id uuid,p_occurrence_date date)
returns public.teaching_occurrences language plpgsql security invoker set search_path='public','pg_temp' as $$
declare v_o public.teaching_occurrences; v_plan_id uuid;
begin
  select * into v_o from public.start_teaching_occurrence(p_timetable_slot_id,p_occurrence_date);
  select id into v_plan_id from public.lesson_plans
    where timetable_slot_id=p_timetable_slot_id and taught_date=p_occurrence_date and teacher_id=auth.uid()
    order by updated_at desc nulls last,created_at desc limit 1;
  if v_plan_id is null then raise exception 'lesson_plan_required'; end if;
  perform public.bind_teaching_occurrence_outcome(v_o.id,v_plan_id);
  return v_o;
end $$;
revoke all on function public.start_teaching_occurrence_v2(uuid,date) from public,anon;
grant execute on function public.start_teaching_occurrence_v2(uuid,date) to authenticated;

-- Canonical task authority. Legacy homework/assessment rows may be linked during
-- transition, but assignment, submission and marking identity lives here.
-- authorization-test: public.learning_tasks teacher ownership, learner assignment, school admin isolation
-- authorization-test: public.learning_task_outcomes task-owner write and cross-school denial
-- authorization-test: public.learning_task_submissions teacher/learner/admin/parent role boundaries
create table if not exists public.learning_tasks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teaching_occurrence_id uuid references public.teaching_occurrences(id) on delete restrict,
  lesson_plan_id uuid references public.lesson_plans(id) on delete restrict,
  task_type text not null check (task_type in ('classwork','exercise','homework','quiz','cat','examination','project','practical')),
  title text not null check (btrim(title)<>''), instructions text,
  status text not null default 'draft' check (status in ('draft','assigned','closed','archived')),
  due_at timestamptz, answer_key jsonb not null default '{}'::jsonb, rubric jsonb not null default '{}'::jsonb,
  recipient_summary jsonb not null default '{}'::jsonb,
  legacy_homework_id uuid references public.homework(id) on delete set null,
  legacy_assessment_id uuid references public.assessment_definitions(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.learning_task_outcomes (
  task_id uuid not null references public.learning_tasks(id) on delete cascade,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  primary key(task_id,outcome_id)
);
create table if not exists public.learning_task_submissions (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.learning_tasks(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'awaiting_submission' check(status in ('awaiting_submission','submitted','marking','marked','released')),
  response jsonb not null default '{}'::jsonb, submitted_at timestamptz, score numeric, max_score numeric,
  judgement text check(judgement is null or judgement in ('mastered','developing','needs_support')),
  feedback text, marked_by uuid references public.profiles(id), marked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(task_id,student_id),
  check(score is null or (max_score>0 and score between 0 and max_score))
);
alter table public.learning_tasks enable row level security;
alter table public.learning_task_outcomes enable row level security;
alter table public.learning_task_submissions enable row level security;
create policy learning_tasks_teacher_manage on public.learning_tasks for all to authenticated
  using (teacher_id=auth.uid() and exists(select 1 from public.teacher_classes tc where tc.teacher_id=auth.uid() and tc.school_id=learning_tasks.school_id and tc.class_id=learning_tasks.class_id and tc.subject_id=learning_tasks.subject_id))
  with check (teacher_id=auth.uid() and exists(select 1 from public.teacher_classes tc where tc.teacher_id=auth.uid() and tc.school_id=learning_tasks.school_id and tc.class_id=learning_tasks.class_id and tc.subject_id=learning_tasks.subject_id));
create policy learning_task_outcomes_teacher_manage on public.learning_task_outcomes for all to authenticated
  using(exists(select 1 from public.learning_tasks t where t.id=task_id and t.teacher_id=auth.uid()))
  with check(exists(select 1 from public.learning_tasks t where t.id=task_id and t.teacher_id=auth.uid()));
create policy learning_task_submissions_teacher_manage on public.learning_task_submissions for all to authenticated
  using(exists(select 1 from public.learning_tasks t where t.id=task_id and t.teacher_id=auth.uid()))
  with check(exists(select 1 from public.learning_tasks t where t.id=task_id and t.teacher_id=auth.uid()));
create policy learning_task_submissions_learner_read on public.learning_task_submissions for select to authenticated
  using(exists(select 1 from public.students s where s.id=student_id and s.profile_id=auth.uid()));
create policy learning_tasks_learner_read on public.learning_tasks for select to authenticated
  using(status in ('assigned','closed') and exists(select 1 from public.students s join public.student_classes sc on sc.student_id=s.id where s.profile_id=auth.uid() and sc.school_id=learning_tasks.school_id and sc.class_id=learning_tasks.class_id and sc.is_current));
create policy learning_tasks_admin_read on public.learning_tasks for select to authenticated using(public.is_school_admin(school_id));
create policy learning_task_submissions_admin_read on public.learning_task_submissions for select to authenticated
  using(exists(select 1 from public.learning_tasks t where t.id=task_id and public.is_school_admin(t.school_id)));
create policy learning_task_submissions_parent_read on public.learning_task_submissions for select to authenticated
  using(status='released' and exists(select 1 from public.parent_student_links p where p.parent_id=auth.uid() and p.student_id=learning_task_submissions.student_id));
grant select,insert,update on public.learning_tasks to authenticated;
grant select,insert,update on public.learning_task_outcomes to authenticated;
grant select,insert,update on public.learning_task_submissions to authenticated;

create or replace function public.learning_task_enforce_authority()
returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_o public.teaching_occurrences;
begin
  if new.teaching_occurrence_id is not null then
    select * into v_o from public.teaching_occurrences where id=new.teaching_occurrence_id;
    if not found then raise exception 'task_occurrence_not_found'; end if;
    if new.school_id<>v_o.school_id or new.teacher_id<>v_o.teacher_id or new.class_id<>v_o.class_id or new.subject_id<>v_o.subject_id then
      raise exception 'task_occurrence_identity_mismatch';
    end if;
    if new.lesson_plan_id is not null and not exists(select 1 from public.lesson_plans lp where lp.id=new.lesson_plan_id and lp.timetable_slot_id=v_o.timetable_slot_id and lp.taught_date=v_o.occurrence_date) then
      raise exception 'task_lesson_plan_mismatch';
    end if;
  end if;
  if new.status='assigned' and not exists(select 1 from public.learning_task_outcomes x where x.task_id=new.id) then
    raise exception 'academic_task_outcome_required';
  end if;
  return new;
end $$;
revoke all on function public.learning_task_enforce_authority() from public,anon,authenticated;
drop trigger if exists learning_task_authority_trigger on public.learning_tasks;
create constraint trigger learning_task_authority_trigger after insert or update of status,teaching_occurrence_id,lesson_plan_id,school_id,teacher_id,class_id,subject_id on public.learning_tasks deferrable initially deferred for each row execute function public.learning_task_enforce_authority();

-- Shared day projection for Pulse, Today and Timetable.
create or replace function public.get_teacher_day(p_date date default current_date)
returns table(occurrence_id uuid,timetable_slot_id uuid,occurrence_date date,school_id uuid,teacher_id uuid,class_id uuid,subject_id uuid,start_time time,end_time time,lifecycle text,lesson_plan_id uuid,curriculum_outcome_id uuid,attendance_state text,evidence_count bigint,awaiting_submission bigint,awaiting_marking bigint)
language sql security invoker set search_path='pg_catalog','public' stable as $$
  select o.id,o.timetable_slot_id,o.occurrence_date,o.school_id,o.teacher_id,o.class_id,o.subject_id,s.start_time,s.end_time,o.lifecycle,lp.id,coalesce(too.curriculum_outcome_id,lp.curriculum_outcome_id),
    case when count(distinct a.student_id)=0 then 'not_started' when count(distinct a.student_id)<count(distinct sc.student_id) then 'incomplete' else 'complete' end,
    count(distinct e.id),
    count(distinct ts.id) filter(where ts.status='awaiting_submission'),
    count(distinct ts.id) filter(where ts.status in ('submitted','marking'))
  from public.teaching_occurrences o join public.timetable_slots s on s.id=o.timetable_slot_id
  left join public.lesson_plans lp on lp.timetable_slot_id=o.timetable_slot_id and lp.taught_date=o.occurrence_date
  left join public.teaching_occurrence_outcomes too on too.teaching_occurrence_id=o.id
  left join public.student_classes sc on sc.school_id=o.school_id and sc.class_id=o.class_id and sc.is_current
  left join public.attendance a on a.teaching_occurrence_id=o.id and a.student_id=sc.student_id
  left join public.lesson_evidence e on e.teaching_occurrence_id=o.id
  left join public.learning_tasks t on t.teaching_occurrence_id=o.id
  left join public.learning_task_submissions ts on ts.task_id=t.id
  where o.teacher_id=auth.uid() and o.occurrence_date=p_date
  group by o.id,s.start_time,s.end_time,lp.id,too.curriculum_outcome_id order by s.start_time
$$;
revoke all on function public.get_teacher_day(date) from public,anon;
grant execute on function public.get_teacher_day(date) to authenticated;

-- Completion review is one transaction and makes every missing record explicit.
create or replace function public.finalize_teaching_occurrence_v2(
  p_occurrence_id uuid,p_outcome text,p_what_was_taught text,p_reflection text,
  p_attendance_unavailable_reason text default null,p_no_evidence_reason text default null,
  p_follow_up_decision text default null,p_next_steps text default null
) returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_o public.teaching_occurrences; v_lp public.lesson_plans; v_expected int; v_marked int; v_evidence int; v_progress uuid; v_scheme uuid; v_status text;
begin
  select * into v_o from public.teaching_occurrences where id=p_occurrence_id and teacher_id=auth.uid() for update;
  if not found then raise exception 'occurrence_not_owned'; end if;
  if v_o.lifecycle<>'in_progress' then raise exception 'occurrence_not_started'; end if;
  if p_outcome not in ('covered','partial','not_covered','postponed','reteach') then raise exception 'coverage_decision_required'; end if;
  if nullif(btrim(coalesce(p_what_was_taught,'')),'') is null then raise exception 'what_was_taught_required'; end if;
  if nullif(btrim(coalesce(p_reflection,'')),'') is null then raise exception 'reflection_required'; end if;
  if p_follow_up_decision not in ('none','existing_task','create_task') then raise exception 'follow_up_decision_required'; end if;
  select count(*) into v_expected from public.student_classes where school_id=v_o.school_id and class_id=v_o.class_id and is_current;
  select count(distinct student_id) into v_marked from public.attendance where teaching_occurrence_id=v_o.id;
  if v_marked<v_expected and nullif(btrim(coalesce(p_attendance_unavailable_reason,'')),'') is null then raise exception 'attendance_resolution_required'; end if;
  select count(*) into v_evidence from public.lesson_evidence where teaching_occurrence_id=v_o.id;
  if v_evidence=0 and nullif(btrim(coalesce(p_no_evidence_reason,'')),'') is null then raise exception 'evidence_resolution_required'; end if;
  select * into v_lp from public.lesson_plans where timetable_slot_id=v_o.timetable_slot_id and taught_date=v_o.occurrence_date;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  perform public.complete_teaching_occurrence(v_o.timetable_slot_id,v_o.occurrence_date);
  select id into v_progress from public.save_teaching_progress_record(v_o.id,p_what_was_taught,null,null,null,
    concat_ws(' · ','Coverage: '||p_outcome,case when v_marked<v_expected then 'Attendance unavailable: '||p_attendance_unavailable_reason end,case when v_evidence=0 then 'No evidence: '||p_no_evidence_reason end,'Follow-up: '||p_follow_up_decision),p_next_steps);
  insert into public.lesson_reflections(lesson_id,lesson_plan_id,teaching_occurrence_id,teacher_id,class_id,school_id,what_worked,challenges,next_steps)
    values(v_lp.id,v_lp.id,v_o.id,v_o.teacher_id,v_o.class_id,v_o.school_id,p_reflection,null,p_next_steps)
    on conflict(teaching_occurrence_id) where teaching_occurrence_id is not null do update set what_worked=excluded.what_worked,next_steps=excluded.next_steps,updated_at=now();
  if p_outcome='covered' then select m.scheme_id,m.status into v_scheme,v_status from public.mark_scheme_item_covered(v_o.id)m; end if;
  return jsonb_build_object('occurrence_id',v_o.id,'progress_record_id',v_progress,'scheme_id',v_scheme,'scheme_status',v_status,'coverage_decision',p_outcome);
end $$;
revoke all on function public.finalize_teaching_occurrence_v2(uuid,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.finalize_teaching_occurrence_v2(uuid,text,text,text,text,text,text,text) to authenticated;

commit;
