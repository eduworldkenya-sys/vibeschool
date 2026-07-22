-- TBL-010B: durable subject identity bridge.
-- Replaces the name-match crossing (resolveGlobalSubjectId(name), ilike)
-- with a real FK: every school subject points at its global (CBC
-- taxonomy) parent via subjects.global_subject_id. The name match becomes
-- a one-time, guarded migration bridge — never runtime identity again.

-- 1. Column + index -----------------------------------------------------
alter table public.subjects
  add column global_subject_id uuid references public.subjects(id);

create index idx_subjects_global_subject_id
  on public.subjects (global_subject_id)
  where global_subject_id is not null;

-- 2. Single-row invariants as CHECK constraints --------------------------
-- A subject can never point at itself.
alter table public.subjects
  add constraint chk_subjects_no_self_link
  check (global_subject_id is null or global_subject_id <> id);

-- Global subjects (school_id IS NULL) are the taxonomy roots — they never
-- link onward to another global subject.
alter table public.subjects
  add constraint chk_subjects_global_no_link
  check (school_id is not null or global_subject_id is null);

-- 3. Cross-row invariant as a trigger -------------------------------------
-- "School subjects must point to a global subject" cannot be a CHECK
-- (it needs to read another row). Enforced going forward, not just at
-- backfill time, so no future writer can link a school subject to
-- another school subject.
create or replace function public.trg_subjects_global_link_target_is_global()
returns trigger
language plpgsql
as $function$
declare
  v_target_school_id uuid;
begin
  if new.global_subject_id is null then
    return new;
  end if;
  select school_id into v_target_school_id
    from public.subjects where id = new.global_subject_id;
  if v_target_school_id is not null then
    raise exception 'subjects.global_subject_id must reference a global subject (school_id IS NULL)';
  end if;
  return new;
end;
$function$;

create trigger trg_subjects_global_link_target_is_global
  before insert or update of global_subject_id on public.subjects
  for each row execute function public.trg_subjects_global_link_target_is_global();

-- 4. Guarded one-time backfill --------------------------------------------
-- Aborts the whole migration (transactional) if any school subject has
-- zero or multiple normalized-exact-name matches among global subjects —
-- per directive, ambiguity is a hard stop, not a best-effort guess.
do $$
declare
  v_missing   integer;
  v_ambiguous integer;
begin
  select count(*) into v_missing
    from public.subjects s
   where s.school_id is not null
     and not exists (
       select 1 from public.subjects g
        where g.school_id is null
          and lower(btrim(g.name)) = lower(btrim(s.name))
     );
  if v_missing > 0 then
    raise exception 'tbl010b_backfill_abort: % school subjects have zero global name matches', v_missing;
  end if;

  select count(*) into v_ambiguous
    from public.subjects s
   where s.school_id is not null
     and (
       select count(*) from public.subjects g
        where g.school_id is null
          and lower(btrim(g.name)) = lower(btrim(s.name))
     ) > 1;
  if v_ambiguous > 0 then
    raise exception 'tbl010b_backfill_abort: % school subjects have multiple global name matches', v_ambiguous;
  end if;

  update public.subjects s
     set global_subject_id = g.id
    from public.subjects g
   where s.school_id is not null
     and g.school_id is null
     and lower(btrim(g.name)) = lower(btrim(s.name));
end $$;

-- 5. Repair mis-pointed teacher_classes rows -------------------------------
-- Generic over any row referencing a global subject_id (found live: 3,
-- all one teacher/class, Science/English/Maths) — not hardcoded to those
-- ids, so this is safe to run again if the condition ever recurs.
-- Two outcomes per row, chosen by whether the correct assignment already
-- exists (uq_teacher_class_subject forbids creating a duplicate):
--   - no canonical row yet -> UPDATE the global id to the school id
--   - canonical row already exists -> DELETE the redundant global-id row
do $$
declare
  r          record;
  v_target   uuid;
  v_conflict uuid;
begin
  for r in
    select tc.id as tc_id, tc.teacher_id, tc.class_id, tc.school_id,
           tc.subject_id as global_id
      from public.teacher_classes tc
      join public.subjects g on g.id = tc.subject_id and g.school_id is null
  loop
    select sc.id into v_target
      from public.subjects sc
     where sc.school_id = r.school_id
       and sc.global_subject_id = r.global_id;

    if v_target is null then
      raise exception
        'tbl010b_repair_abort: teacher_classes % has no school subject at school % linked to global subject %',
        r.tc_id, r.school_id, r.global_id;
    end if;

    select id into v_conflict
      from public.teacher_classes
     where teacher_id = r.teacher_id
       and class_id = r.class_id
       and subject_id = v_target;

    if v_conflict is not null then
      delete from public.teacher_classes where id = r.tc_id;
    else
      update public.teacher_classes set subject_id = v_target where id = r.tc_id;
    end if;
  end loop;
end $$;

-- 6. Post-repair invariant, enforced as part of the migration itself ------
do $$
declare v_leftover integer;
begin
  select count(*) into v_leftover
    from public.teacher_classes tc
    join public.subjects s on s.id = tc.subject_id
   where s.school_id is null;
  if v_leftover > 0 then
    raise exception 'tbl010b_postcheck_failed: % teacher_classes rows still reference global subjects', v_leftover;
  end if;
end $$;
