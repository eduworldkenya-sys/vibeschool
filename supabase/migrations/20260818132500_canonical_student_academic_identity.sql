-- Canonical Student Academic Identity
-- Supersedes mixed profile/auth-keyed student_id semantics preserved by
-- 20260818013000_pilot_identity_domain_semantic_repair.sql.
--
-- Invariant:
--   * durable learner academic/evidence rows: student_id = public.students.id
--   * account/viewer telemetry may remain profile/auth keyed, but must not be
--     treated as canonical learner identity.
--
-- Production preflight on 2026-08-18 found one unambiguous bridge:
-- profile 0bfe3177-6fdb-4e02-8fb1-2802f0b6116e
--   -> student 4e3fa6ea-a023-444e-8c0f-98b7d62417c3
-- affecting 29 rows (16 mistakes, 10 practice attempts, 2 retests, 1 readiness).
-- This migration does not hard-code those IDs; it derives every mapping.

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = 'public','pg_temp'
as $$
  select s.id
  from public.students s
  where s.profile_id = (select auth.uid())
    and s.deleted_at is null
  order by s.created_at, s.id
  limit 1
$$;

revoke all on function public.current_student_id() from public;
revoke all on function public.current_student_id() from anon;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.current_student_id() to service_role;

-- Fail closed before touching constraints or data.
do $$
declare
  v_table text;
  v_unmapped bigint;
begin
  foreach v_table in array array[
    'student_exam_readiness_state',
    'student_mistake_notebook',
    'student_practice_attempts',
    'student_revision_plan_items',
    'student_kcse_subject_confidence',
    'student_kcse_error_classifications',
    'student_kcse_retest_schedule',
    'student_kcse_mock_sessions'
  ]
  loop
    execute format(
      'select count(*) from public.%I t
       where not exists (select 1 from public.students s where s.id=t.student_id)
         and (select count(*) from public.students s
              where s.profile_id=t.student_id and s.deleted_at is null) <> 1',
      v_table
    ) into v_unmapped;

    if v_unmapped <> 0 then
      raise exception 'student_identity_preflight_failed: table %, % unmapped/ambiguous student_id rows',
        v_table, v_unmapped;
    end if;
  end loop;
end $$;

-- Collision guards: mapping profile IDs to canonical students must not collapse
-- two logical rows into one uniqueness key.
do $$
begin
  if exists (
    select 1
    from public.student_mistake_notebook t
    join public.students s on s.profile_id=t.student_id and s.deleted_at is null
    join public.student_mistake_notebook c
      on c.student_id=s.id
     and c.exam_question_id is not distinct from t.exam_question_id
     and c.id<>t.id
    where not exists (select 1 from public.students x where x.id=t.student_id)
  ) then raise exception 'student_identity_collision: student_mistake_notebook'; end if;

  if exists (
    select 1
    from public.student_exam_readiness_state t
    join public.students s on s.profile_id=t.student_id and s.deleted_at is null
    join public.student_exam_readiness_state c on c.student_id=s.id
    where not exists (select 1 from public.students x where x.id=t.student_id)
  ) then raise exception 'student_identity_collision: student_exam_readiness_state'; end if;

  if exists (
    select 1
    from public.student_revision_plan_items t
    join public.students s on s.profile_id=t.student_id and s.deleted_at is null
    join public.student_revision_plan_items c
      on c.student_id=s.id
     and c.plan_date=t.plan_date
     and c.subject=t.subject
     and c.topic=t.topic
     and c.activity_type=t.activity_type
     and c.id<>t.id
    where not exists (select 1 from public.students x where x.id=t.student_id)
  ) then raise exception 'student_identity_collision: student_revision_plan_items'; end if;

  if exists (
    select 1
    from public.student_kcse_subject_confidence t
    join public.students s on s.profile_id=t.student_id and s.deleted_at is null
    join public.student_kcse_subject_confidence c
      on c.student_id=s.id and c.subject=t.subject
    where not exists (select 1 from public.students x where x.id=t.student_id)
  ) then raise exception 'student_identity_collision: student_kcse_subject_confidence'; end if;

  if exists (
    select 1
    from public.student_kcse_error_classifications t
    join public.students s on s.profile_id=t.student_id and s.deleted_at is null
    join public.student_kcse_error_classifications c
      on c.student_id=s.id and c.mistake_id=t.mistake_id and c.id<>t.id
    where not exists (select 1 from public.students x where x.id=t.student_id)
  ) then raise exception 'student_identity_collision: student_kcse_error_classifications'; end if;

  if exists (
    select 1
    from public.student_kcse_retest_schedule t
    join public.students s on s.profile_id=t.student_id and s.deleted_at is null
    join public.student_kcse_retest_schedule c
      on c.student_id=s.id and c.subject=t.subject and c.topic=t.topic and c.id<>t.id
    where not exists (select 1 from public.students x where x.id=t.student_id)
  ) then raise exception 'student_identity_collision: student_kcse_retest_schedule'; end if;
end $$;

-- Remove profile/auth-domain FKs before rewriting IDs.
alter table public.student_exam_readiness_state
  drop constraint if exists student_exam_readiness_state_student_id_fkey;
alter table public.student_mistake_notebook
  drop constraint if exists student_mistake_notebook_student_id_fkey;
alter table public.student_practice_attempts
  drop constraint if exists student_practice_attempts_student_id_fkey;
alter table public.student_revision_plan_items
  drop constraint if exists student_revision_plan_items_student_id_fkey;

-- Canonicalize every existing academic student_id that still stores a profile ID.
update public.student_exam_readiness_state t
set student_id=s.id
from public.students s
where s.profile_id=t.student_id
  and s.deleted_at is null
  and not exists (select 1 from public.students x where x.id=t.student_id);

update public.student_mistake_notebook t
set student_id=s.id
from public.students s
where s.profile_id=t.student_id
  and s.deleted_at is null
  and not exists (select 1 from public.students x where x.id=t.student_id);

update public.student_practice_attempts t
set student_id=s.id
from public.students s
where s.profile_id=t.student_id
  and s.deleted_at is null
  and not exists (select 1 from public.students x where x.id=t.student_id);

update public.student_revision_plan_items t
set student_id=s.id
from public.students s
where s.profile_id=t.student_id
  and s.deleted_at is null
  and not exists (select 1 from public.students x where x.id=t.student_id);

update public.student_kcse_subject_confidence t
set student_id=s.id
from public.students s
where s.profile_id=t.student_id
  and s.deleted_at is null
  and not exists (select 1 from public.students x where x.id=t.student_id);

update public.student_kcse_error_classifications t
set student_id=s.id
from public.students s
where s.profile_id=t.student_id
  and s.deleted_at is null
  and not exists (select 1 from public.students x where x.id=t.student_id);

update public.student_kcse_retest_schedule t
set student_id=s.id
from public.students s
where s.profile_id=t.student_id
  and s.deleted_at is null
  and not exists (select 1 from public.students x where x.id=t.student_id);

update public.student_kcse_mock_sessions t
set student_id=s.id
from public.students s
where s.profile_id=t.student_id
  and s.deleted_at is null
  and not exists (select 1 from public.students x where x.id=t.student_id);

-- Make the invariant structural: every durable academic student_id references
-- the canonical learner row.
alter table public.student_exam_readiness_state
  add constraint student_exam_readiness_state_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.student_mistake_notebook
  add constraint student_mistake_notebook_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.student_practice_attempts
  add constraint student_practice_attempts_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.student_revision_plan_items
  add constraint student_revision_plan_items_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

alter table public.student_kcse_subject_confidence
  drop constraint if exists student_kcse_subject_confidence_student_id_fkey;
alter table public.student_kcse_subject_confidence
  add constraint student_kcse_subject_confidence_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

alter table public.student_kcse_error_classifications
  drop constraint if exists student_kcse_error_classifications_student_id_fkey;
alter table public.student_kcse_error_classifications
  add constraint student_kcse_error_classifications_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

alter table public.student_kcse_retest_schedule
  drop constraint if exists student_kcse_retest_schedule_student_id_fkey;
alter table public.student_kcse_retest_schedule
  add constraint student_kcse_retest_schedule_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

alter table public.student_kcse_mock_sessions
  drop constraint if exists student_kcse_mock_sessions_student_id_fkey;
alter table public.student_kcse_mock_sessions
  add constraint student_kcse_mock_sessions_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

-- RLS resolves the signed-in account to the canonical learner once.
drop policy if exists student_exam_readiness_insert_own on public.student_exam_readiness_state;
drop policy if exists student_exam_readiness_select_own on public.student_exam_readiness_state;
drop policy if exists student_exam_readiness_update_own on public.student_exam_readiness_state;
create policy student_exam_readiness_insert_own on public.student_exam_readiness_state
for insert to authenticated with check (student_id=(select public.current_student_id()));
create policy student_exam_readiness_select_own on public.student_exam_readiness_state
for select to authenticated using (student_id=(select public.current_student_id()));
create policy student_exam_readiness_update_own on public.student_exam_readiness_state
for update to authenticated
using (student_id=(select public.current_student_id()))
with check (student_id=(select public.current_student_id()));

drop policy if exists student_mistakes_select_own on public.student_mistake_notebook;
create policy student_mistakes_select_own on public.student_mistake_notebook
for select to authenticated using (student_id=(select public.current_student_id()));

drop policy if exists student_practice_attempts_select_own on public.student_practice_attempts;
create policy student_practice_attempts_select_own on public.student_practice_attempts
for select to authenticated using (student_id=(select public.current_student_id()));

drop policy if exists student_revision_plan_select_own on public.student_revision_plan_items;
create policy student_revision_plan_select_own on public.student_revision_plan_items
for select to authenticated using (student_id=(select public.current_student_id()));

drop policy if exists student_kcse_subject_confidence_select on public.student_kcse_subject_confidence;
drop policy if exists student_kcse_subject_confidence_insert on public.student_kcse_subject_confidence;
drop policy if exists student_kcse_subject_confidence_update on public.student_kcse_subject_confidence;
create policy student_kcse_subject_confidence_select on public.student_kcse_subject_confidence
for select to authenticated using (student_id=(select public.current_student_id()));
create policy student_kcse_subject_confidence_insert on public.student_kcse_subject_confidence
for insert to authenticated with check (student_id=(select public.current_student_id()));
create policy student_kcse_subject_confidence_update on public.student_kcse_subject_confidence
for update to authenticated
using (student_id=(select public.current_student_id()))
with check (student_id=(select public.current_student_id()));

drop policy if exists student_kcse_error_classifications_select on public.student_kcse_error_classifications;
drop policy if exists student_kcse_error_classifications_insert on public.student_kcse_error_classifications;
drop policy if exists student_kcse_error_classifications_update on public.student_kcse_error_classifications;
create policy student_kcse_error_classifications_select on public.student_kcse_error_classifications
for select to authenticated using (student_id=(select public.current_student_id()));
create policy student_kcse_error_classifications_insert on public.student_kcse_error_classifications
for insert to authenticated with check (student_id=(select public.current_student_id()));
create policy student_kcse_error_classifications_update on public.student_kcse_error_classifications
for update to authenticated
using (student_id=(select public.current_student_id()))
with check (student_id=(select public.current_student_id()));

drop policy if exists student_kcse_retest_schedule_select on public.student_kcse_retest_schedule;
create policy student_kcse_retest_schedule_select on public.student_kcse_retest_schedule
for select to authenticated using (student_id=(select public.current_student_id()));

drop policy if exists student_kcse_mock_sessions_select on public.student_kcse_mock_sessions;
create policy student_kcse_mock_sessions_select on public.student_kcse_mock_sessions
for select to authenticated using (student_id=(select public.current_student_id()));

drop policy if exists student_kcse_mock_answers_select on public.student_kcse_mock_answers;
create policy student_kcse_mock_answers_select on public.student_kcse_mock_answers
for select to authenticated
using (
  exists (
    select 1
    from public.student_kcse_mock_sessions s
    where s.id=student_kcse_mock_answers.session_id
      and s.student_id=(select public.current_student_id())
  )
);

-- Existing RPCs are numerous and have accumulated mixed identity semantics over
-- several migrations. Patch only explicit, asserted fragments. The migration
-- aborts if a historical definition has drifted instead of silently applying a
-- partial repair.
create temporary table student_identity_function_patches (
  signature text not null,
  ordinal integer not null,
  old_text text not null,
  new_text text not null,
  primary key (signature, ordinal)
) on commit drop;

insert into student_identity_function_patches(signature,ordinal,old_text,new_text) values
('student_classify_kcse_mistake(uuid,text,text)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_create_kcse_mock(text,text,uuid)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_get_kcse_adaptive_practice(text,text,integer)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_get_kcse_mastery_map()',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_get_kcse_mock(uuid)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_get_revision_workspace(text,text)',1,'v_student uuid:=auth.uid()','v_student uuid:=public.current_student_id()'),
('student_resolve_mistake(uuid)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_save_kcse_mock_answer(uuid,uuid,integer,text,integer,uuid)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_search_kcse(text)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_update_kcse_profile(date,integer,integer,jsonb,boolean)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_update_revision_item_status(uuid,text)',1,'v_uid uuid := auth.uid()','v_uid uuid := public.current_student_id()'),

('student_update_exam_readiness(date,integer,integer)',1,'values(auth.uid(), p_exam_date','values(public.current_student_id(), p_exam_date'),


('student_generate_adaptive_revision_plan_v1(date,integer)',1,'student_id in (v_student_id,v_uid)','student_id=v_student_id'),
('student_generate_adaptive_revision_plan_v1(date,integer)',2,'student_id=v_uid','student_id=v_student_id'),
('student_generate_adaptive_revision_plan_v1(date,integer)',3,'values(v_uid,v_date','values(v_student_id,v_date'),

('student_generate_adaptive_revision_plan(date,integer)',1,'student_id in (v_student_id,v_uid)','student_id=v_student_id'),
('student_generate_adaptive_revision_plan(date,integer)',2,'p.student_id=v_uid','p.student_id=v_student_id'),

('student_get_adaptive_revision_context()',1,'student_id in (v_student_id,v_uid)','student_id=v_student_id'),
('student_get_adaptive_revision_context()',2,'r.student_id=v_uid','r.student_id=v_student_id'),

('student_get_exam_readiness_brief()',1,'values (v_user)','values (v_student)'),
('student_get_exam_readiness_brief()',2,'r.student_id = v_user','r.student_id = v_student'),

('student_get_kcse_candidate_os()',1,'student_id in (v_user,v_student)','student_id=v_student'),
('student_get_kcse_candidate_os()',2,'student_id=v_user','student_id=v_student'),
('student_get_kcse_candidate_os()',3,'values(v_user)','values(v_student)'),

('student_get_kcse_progress_history()',1,'student_id=v_user','student_id=v_student'),

('student_get_twin_state_internal()',1,'r.student_id in (v_student.id,v_uid)','r.student_id=v_student.id'),

('student_record_grounded_practice_answer(uuid,text,integer,uuid)',1,'m.student_id=v_profile_id','m.student_id=v_student_id'),
('student_record_grounded_practice_answer(uuid,text,integer,uuid)',2,'values(v_profile_id,null','values(v_student_id,null'),

('student_record_vibelearn_practice_answer(uuid,integer,integer,uuid)',1,'student_id=v_user','student_id=v_student'),
('student_record_vibelearn_practice_answer(uuid,integer,integer,uuid)',2,'values(v_user,','values(v_student,'),

('student_refresh_twin_memory()',1,'student_id=v_uid','student_id=v_student_id'),

('parent_get_student_kcse_brief(uuid)',1,'student_id=v_profile','student_id=p_student_id'),
('parent_get_student_kcse_brief(uuid)',2,'student_id in (v_profile,p_student_id)','student_id=p_student_id'),
('teacher_get_student_kcse_brief(uuid)',1,'student_id=v_profile','student_id=p_student_id');

do $$
declare
  r record;
  p record;
  v_oid oid;
  v_def text;
  v_before text;
begin
  for r in
    select signature
    from student_identity_function_patches
    group by signature
    order by signature
  loop
    v_oid := to_regprocedure(r.signature);
    if v_oid is null then
      raise exception 'student_identity_function_missing: %', r.signature;
    end if;

    v_def := pg_get_functiondef(v_oid);

    for p in
      select old_text,new_text
      from student_identity_function_patches
      where signature=r.signature
      order by ordinal
    loop
      v_before := v_def;
      v_def := replace(v_def,p.old_text,p.new_text);
      if v_def=v_before then
        raise exception 'student_identity_function_patch_drift: % missing fragment %',
          r.signature, p.old_text;
      end if;
    end loop;

    execute v_def;
  end loop;
end $$;

-- Privilege boundary for the resolver after function recreation work.
revoke all on function public.current_student_id() from public;
revoke all on function public.current_student_id() from anon;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.current_student_id() to service_role;

-- Certification: all repaired rows must now be canonical, all eight academic
-- tables must have a student FK to public.students, and legacy dual-domain
-- predicates may not survive in affected runtime functions.
do $$
declare
  v_table text;
  v_bad bigint;
begin
  foreach v_table in array array[
    'student_exam_readiness_state',
    'student_mistake_notebook',
    'student_practice_attempts',
    'student_revision_plan_items',
    'student_kcse_subject_confidence',
    'student_kcse_error_classifications',
    'student_kcse_retest_schedule',
    'student_kcse_mock_sessions'
  ]
  loop
    execute format(
      'select count(*) from public.%I t
       where not exists (select 1 from public.students s where s.id=t.student_id)',
      v_table
    ) into v_bad;
    if v_bad <> 0 then
      raise exception 'student_identity_postcondition_failed: table %, % noncanonical rows',
        v_table, v_bad;
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class rel on rel.oid=c.conrelid
      join pg_namespace n on n.oid=rel.relnamespace
      join pg_class frel on frel.oid=c.confrelid
      join pg_namespace fn on fn.oid=frel.relnamespace
      where c.contype='f'
        and n.nspname='public'
        and rel.relname=v_table
        and fn.nspname='public'
        and frel.relname='students'
        and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (student_id)%'
    ) then
      raise exception 'student_identity_fk_postcondition_failed: %', v_table;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename in (
        'student_exam_readiness_state','student_mistake_notebook',
        'student_practice_attempts','student_revision_plan_items',
        'student_kcse_subject_confidence','student_kcse_error_classifications',
        'student_kcse_retest_schedule','student_kcse_mock_sessions',
        'student_kcse_mock_answers'
      )
      and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')
  ) then
    raise exception 'student_identity_rls_postcondition_failed: direct auth.uid student ownership remains';
  end if;
end $$;
