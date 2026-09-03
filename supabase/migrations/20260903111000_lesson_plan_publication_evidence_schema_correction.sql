begin;

-- Correction on top of the initial spine hardening migration. lesson_evidence
-- does not carry school_id; school authority is resolved through the exact
-- teaching occurrence and exact lesson plan instead of duplicating it.
create or replace function public.lesson_evidence_enforce_occurrence_authority()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_occ public.teaching_occurrences%rowtype;
  v_plan public.lesson_plans%rowtype;
begin
  if new.teaching_occurrence_id is null then
    raise exception 'lesson_evidence_occurrence_required';
  end if;

  select *
    into v_occ
    from public.teaching_occurrences
   where id = new.teaching_occurrence_id;

  if not found then
    raise exception 'lesson_evidence_occurrence_not_found';
  end if;

  if v_occ.lifecycle not in ('in_progress', 'completed') then
    raise exception 'lesson_evidence_occurrence_not_teachable';
  end if;

  select *
    into v_plan
    from public.lesson_plans
   where id = new.lesson_id
     and timetable_slot_id = v_occ.timetable_slot_id
     and taught_date = v_occ.occurrence_date
     and school_id = v_occ.school_id
     and teacher_id = v_occ.teacher_id
     and class_id = v_occ.class_id
     and subject_id = v_occ.subject_id;

  if not found then
    raise exception 'lesson_evidence_plan_occurrence_mismatch';
  end if;

  if new.teacher_id is distinct from v_occ.teacher_id then
    raise exception 'lesson_evidence_teacher_mismatch';
  end if;
  if new.class_id is distinct from v_occ.class_id then
    raise exception 'lesson_evidence_class_mismatch';
  end if;

  new.teacher_id := v_occ.teacher_id;
  new.class_id := v_occ.class_id;

  if new.student_id is not null and not exists (
    select 1
      from public.student_classes sc
     where sc.student_id = new.student_id
       and sc.school_id = v_occ.school_id
       and sc.class_id = v_occ.class_id
       and sc.is_current = true
  ) then
    raise exception 'lesson_evidence_student_not_enrolled';
  end if;

  return new;
end;
$$;

revoke all on function public.lesson_evidence_enforce_occurrence_authority() from public;
revoke all on function public.lesson_evidence_enforce_occurrence_authority() from anon;
revoke all on function public.lesson_evidence_enforce_occurrence_authority() from authenticated;

-- Learner publication and parent sharing are independent actions. published_at
-- is the durable learner-publication bit: parent-only sharing must not expose a
-- teacher's working plan to students, while a plan published to students stays
-- learner-visible if the teacher subsequently shares it with parents.
create or replace function public.lesson_plan_normalize_publication_state()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.status = 'draft' then
    new.published_at := null;
  elsif new.status = 'published' and new.published_at is null then
    new.published_at := now();
  elsif new.status = 'shared_to_parents' and tg_op = 'UPDATE' then
    new.published_at := old.published_at;
  end if;

  return new;
end;
$$;

revoke all on function public.lesson_plan_normalize_publication_state() from public;
revoke all on function public.lesson_plan_normalize_publication_state() from anon;
revoke all on function public.lesson_plan_normalize_publication_state() from authenticated;

drop trigger if exists trg_lesson_plan_normalize_publication_state on public.lesson_plans;
create trigger trg_lesson_plan_normalize_publication_state
before insert or update of status
on public.lesson_plans
for each row
execute function public.lesson_plan_normalize_publication_state();

drop policy if exists lesson_plans_student_read on public.lesson_plans;
create policy lesson_plans_student_read
on public.lesson_plans
for select
to authenticated
using (
  published_at is not null
  and status in ('published', 'shared_to_parents')
  and exists (
    select 1
      from public.student_classes sc
      join public.students s on s.id = sc.student_id
     where s.profile_id = (select auth.uid())
       and s.deleted_at is null
       and sc.school_id = lesson_plans.school_id
       and sc.class_id = lesson_plans.class_id
       and sc.is_current = true
  )
);

commit;
