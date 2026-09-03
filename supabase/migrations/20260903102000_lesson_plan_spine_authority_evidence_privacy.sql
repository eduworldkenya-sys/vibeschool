begin;

-- Lesson Plan production spine hardening.
-- This migration is deliberately forward-enforcing: it does not rewrite legacy
-- lesson dates whose historical intent cannot be reconstructed safely.

-- 1) A lesson plan is school-scoped authority. Existing production rows are
-- already populated; backfill only compatibility rows that still have a valid
-- timetable slot, then make the invariant structural.
update public.lesson_plans lp
set school_id = ts.school_id
from public.timetable_slots ts
where lp.school_id is null
  and ts.id = lp.timetable_slot_id;

alter table public.lesson_plans
  alter column school_id set not null;

-- 2) Every newly-created or identity-mutated lesson plan must describe the
-- exact dated timetable occurrence it claims to represent.
create or replace function public.lesson_plan_enforce_slot_authority()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_slot public.timetable_slots%rowtype;
  v_scheme public.scheme_of_work%rowtype;
  v_week_start date;
begin
  select *
    into v_slot
    from public.timetable_slots
   where id = new.timetable_slot_id;

  if not found then
    raise exception 'lesson_plan_slot_not_found';
  end if;

  if new.teacher_id is distinct from v_slot.teacher_id then
    raise exception 'lesson_plan_teacher_mismatch';
  end if;
  if new.class_id is distinct from v_slot.class_id then
    raise exception 'lesson_plan_class_mismatch';
  end if;
  if new.subject_id is distinct from v_slot.subject_id then
    raise exception 'lesson_plan_subject_mismatch';
  end if;

  if new.school_id is null then
    new.school_id := v_slot.school_id;
  elsif new.school_id is distinct from v_slot.school_id then
    raise exception 'lesson_plan_school_mismatch';
  end if;

  if new.taught_date is null
     or extract(isodow from new.taught_date)::integer <> v_slot.day_of_week
     or new.taught_date < v_slot.effective_from
     or (v_slot.effective_until is not null and new.taught_date > v_slot.effective_until)
  then
    raise exception 'lesson_plan_invalid_occurrence_date';
  end if;

  if new.day_of_week is distinct from v_slot.day_of_week then
    raise exception 'lesson_plan_day_mismatch';
  end if;

  v_week_start := date_trunc('week', new.taught_date::timestamp)::date;
  if new.week_start is distinct from v_week_start then
    raise exception 'lesson_plan_week_mismatch';
  end if;

  if new.scheme_id is not null then
    select *
      into v_scheme
      from public.scheme_of_work
     where id = new.scheme_id;

    if not found then
      raise exception 'lesson_plan_scheme_not_found';
    end if;

    if v_scheme.school_id is distinct from v_slot.school_id
       or v_scheme.class_id is distinct from v_slot.class_id
       or v_scheme.subject_id is distinct from v_slot.subject_id
       or (v_scheme.teacher_id is not null and v_scheme.teacher_id is distinct from v_slot.teacher_id)
    then
      raise exception 'lesson_plan_scheme_scope_mismatch';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.lesson_plan_enforce_slot_authority() from public;
revoke all on function public.lesson_plan_enforce_slot_authority() from anon;
revoke all on function public.lesson_plan_enforce_slot_authority() from authenticated;

drop trigger if exists trg_lesson_plan_enforce_slot_authority on public.lesson_plans;
create trigger trg_lesson_plan_enforce_slot_authority
before insert or update of timetable_slot_id, taught_date, school_id, teacher_id,
  class_id, subject_id, day_of_week, week_start, scheme_id
on public.lesson_plans
for each row
execute function public.lesson_plan_enforce_slot_authority();

-- 3) Draft teacher plans are private working documents. Learners only receive
-- plans after the teacher explicitly publishes/shares them.
drop policy if exists lesson_plans_student_read on public.lesson_plans;
create policy lesson_plans_student_read
on public.lesson_plans
for select
to authenticated
using (
  status in ('published', 'shared_to_parents')
  and exists (
    select 1
    from public.student_classes sc
    join public.students s on s.id = sc.student_id
    where s.profile_id = (select auth.uid())
      and s.deleted_at is null
      and sc.class_id = lesson_plans.class_id
      and sc.school_id = lesson_plans.school_id
      and sc.is_current = true
  )
);

-- 4) Classroom evidence is private. The historical migration created this
-- bucket as public; converge all environments to a private bucket and require
-- the teacher's auth UUID as the first path segment.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lesson-evidence',
  'lesson-evidence',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "teacher uploads own evidence photos" on storage.objects;
drop policy if exists "teacher updates own evidence photos" on storage.objects;
drop policy if exists "anyone reads evidence photos" on storage.objects;
drop policy if exists "teacher reads own lesson evidence media" on storage.objects;
drop policy if exists "teacher deletes own lesson evidence media" on storage.objects;

create policy "teacher uploads own evidence photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lesson-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "teacher reads own lesson evidence media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lesson-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "teacher deletes own lesson evidence media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lesson-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- 5) Whole-class evidence has student_id = NULL by design. Authorize it from
-- the exact owned occurrence + exact plan, not from a fabricated learner row.
-- Student-specific evidence retains an enrollment check.
drop policy if exists "teacher manages own lesson evidence" on public.lesson_evidence;
create policy "teacher manages own lesson evidence"
on public.lesson_evidence
for all
to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1
      from public.teaching_occurrences o
      join public.lesson_plans lp
        on lp.id = lesson_evidence.lesson_id
       and lp.timetable_slot_id = o.timetable_slot_id
       and lp.taught_date = o.occurrence_date
       and lp.school_id = o.school_id
       and lp.teacher_id = o.teacher_id
       and lp.class_id = o.class_id
       and lp.subject_id = o.subject_id
     where o.id = lesson_evidence.teaching_occurrence_id
       and o.teacher_id = (select auth.uid())
       and o.class_id = lesson_evidence.class_id
       and o.lifecycle in ('in_progress', 'completed')
  )
  and (
    student_id is null
    or exists (
      select 1
        from public.student_classes sc
       where sc.student_id = lesson_evidence.student_id
         and sc.class_id = lesson_evidence.class_id
         and sc.is_current = true
         and exists (
           select 1
             from public.teaching_occurrences o2
            where o2.id = lesson_evidence.teaching_occurrence_id
              and o2.school_id = sc.school_id
              and o2.teacher_id = (select auth.uid())
         )
    )
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1
      from public.teaching_occurrences o
      join public.lesson_plans lp
        on lp.id = lesson_evidence.lesson_id
       and lp.timetable_slot_id = o.timetable_slot_id
       and lp.taught_date = o.occurrence_date
       and lp.school_id = o.school_id
       and lp.teacher_id = o.teacher_id
       and lp.class_id = o.class_id
       and lp.subject_id = o.subject_id
     where o.id = lesson_evidence.teaching_occurrence_id
       and o.teacher_id = (select auth.uid())
       and o.class_id = lesson_evidence.class_id
       and o.lifecycle in ('in_progress', 'completed')
  )
  and (
    student_id is null
    or exists (
      select 1
        from public.student_classes sc
       where sc.student_id = lesson_evidence.student_id
         and sc.class_id = lesson_evidence.class_id
         and sc.is_current = true
         and exists (
           select 1
             from public.teaching_occurrences o2
            where o2.id = lesson_evidence.teaching_occurrence_id
              and o2.school_id = sc.school_id
              and o2.teacher_id = (select auth.uid())
         )
    )
  )
);

-- Derive canonical school/teacher/class identity from the exact occurrence for
-- all new evidence writes. This protects alternate callers in addition to RLS.
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
  new.school_id := v_occ.school_id;

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

drop trigger if exists trg_lesson_evidence_enforce_occurrence_authority on public.lesson_evidence;
create trigger trg_lesson_evidence_enforce_occurrence_authority
before insert or update of lesson_id, teaching_occurrence_id, class_id, teacher_id, student_id
on public.lesson_evidence
for each row
execute function public.lesson_evidence_enforce_occurrence_authority();

commit;
