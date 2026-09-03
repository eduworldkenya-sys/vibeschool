begin;

-- Runtime convergence for Lesson Evidence.
-- Production drifted behind the repository's Lesson Plan spine migrations:
-- class-level evidence (student_id is null) was still blocked by legacy RLS and
-- the lesson-evidence bucket was missing. Re-assert the final intended contract
-- idempotently without depending on transient intermediate migrations.

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

-- Whole-class evidence is valid by design. Bind access to the exact owned,
-- teachable occurrence and exact lesson plan. Student-specific evidence adds
-- a current-enrolment check instead of forcing every evidence row to have a learner.
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
        join public.teaching_occurrences o2
          on o2.id = lesson_evidence.teaching_occurrence_id
         and o2.school_id = sc.school_id
         and o2.teacher_id = (select auth.uid())
       where sc.student_id = lesson_evidence.student_id
         and sc.class_id = lesson_evidence.class_id
         and sc.is_current = true
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
        join public.teaching_occurrences o2
          on o2.id = lesson_evidence.teaching_occurrence_id
         and o2.school_id = sc.school_id
         and o2.teacher_id = (select auth.uid())
       where sc.student_id = lesson_evidence.student_id
         and sc.class_id = lesson_evidence.class_id
         and sc.is_current = true
    )
  )
);

-- Alternate callers cannot spoof lesson/class/teacher identity. The exact
-- occurrence and exact lesson plan remain the authority boundary.
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

drop trigger if exists trg_lesson_evidence_enforce_occurrence_authority on public.lesson_evidence;
create trigger trg_lesson_evidence_enforce_occurrence_authority
before insert or update of lesson_id, teaching_occurrence_id, class_id, teacher_id, student_id
on public.lesson_evidence
for each row
execute function public.lesson_evidence_enforce_occurrence_authority();

commit;
