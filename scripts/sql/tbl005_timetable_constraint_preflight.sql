/*
 * TBL-005 — Timetable constraint data preconditions
 *
 * Purpose:
 *   Stop later timetable constraint migrations when existing data would violate
 *   those constraints.
 *
 * Properties:
 *   - read-only;
 *   - no data repair;
 *   - no schema changes;
 *   - no migration-ledger changes;
 *   - produces precise failure messages and row counts.
 *
 * Run against the intended Supabase database before TBL-019–TBL-030.
 */

begin;
set transaction read only;

do $tbl005$
declare
  v_count bigint;
begin
  if to_regclass('public.timetable_slots') is null then
    raise exception
      using
        errcode = 'P0001',
        message = 'TBL-005 failed: public.timetable_slots does not exist';
  end if;

  if to_regclass('public.teacher_classes') is null then
    raise exception
      using
        errcode = 'P0001',
        message = 'TBL-005 failed: public.teacher_classes does not exist';
  end if;

  if to_regclass('public.schools') is null then
    raise exception
      using
        errcode = 'P0001',
        message = 'TBL-005 failed: public.schools does not exist';
  end if;

  if to_regclass('public.classes') is null then
    raise exception
      using
        errcode = 'P0001',
        message = 'TBL-005 failed: public.classes does not exist';
  end if;

  if to_regclass('public.subjects') is null then
    raise exception
      using
        errcode = 'P0001',
        message = 'TBL-005 failed: public.subjects does not exist';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception
      using
        errcode = 'P0001',
        message = 'TBL-005 failed: public.profiles does not exist';
  end if;

  /*
   * TBL-019 — slot school identity.
   */
  select count(*)
    into v_count
  from public.timetable_slots ts
  left join public.schools s
    on s.id = ts.school_id
  where ts.school_id is null
     or s.id is null;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-019]: %s timetable_slots rows have a missing or invalid school_id',
          v_count
        );
  end if;

  /*
   * TBL-020 — class foreign key.
   */
  select count(*)
    into v_count
  from public.timetable_slots ts
  left join public.classes c
    on c.id = ts.class_id
  where ts.class_id is null
     or c.id is null;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-020]: %s timetable_slots rows have a missing or invalid class_id',
          v_count
        );
  end if;

  /*
   * TBL-021 — subject foreign key.
   */
  select count(*)
    into v_count
  from public.timetable_slots ts
  left join public.subjects s
    on s.id = ts.subject_id
  where ts.subject_id is null
     or s.id is null;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-021]: %s timetable_slots rows have a missing or invalid subject_id',
          v_count
        );
  end if;

  /*
   * Teacher identity prerequisite.
   */
  select count(*)
    into v_count
  from public.timetable_slots ts
  left join public.profiles p
    on p.id = ts.teacher_id
  where ts.teacher_id is null
     or p.id is null;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed: %s timetable_slots rows have a missing or invalid teacher_id',
          v_count
        );
  end if;

  /*
   * TBL-019 — slot school must equal class school.
   */
  select count(*)
    into v_count
  from public.timetable_slots ts
  join public.classes c
    on c.id = ts.class_id
  where c.school_id is distinct from ts.school_id;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-019]: %s timetable_slots rows disagree with classes.school_id',
          v_count
        );
  end if;

  /*
   * TBL-019/TBL-021 — school-owned subjects must match slot school.
   * Global subjects with subjects.school_id IS NULL remain valid.
   */
  select count(*)
    into v_count
  from public.timetable_slots ts
  join public.subjects s
    on s.id = ts.subject_id
  where s.school_id is not null
    and s.school_id is distinct from ts.school_id;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-019/TBL-021]: %s timetable_slots rows disagree with subjects.school_id',
          v_count
        );
  end if;

  /*
   * TBL-022 — teacher assignment contract.
   */
  select count(*)
    into v_count
  from public.timetable_slots ts
  where not exists (
    select 1
    from public.teacher_classes tc
    where tc.school_id = ts.school_id
      and tc.teacher_id = ts.teacher_id
      and tc.class_id = ts.class_id
      and tc.subject_id = ts.subject_id
  );

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-022]: %s timetable_slots rows have no matching teacher_classes assignment',
          v_count
        );
  end if;

  /*
   * TBL-023 and assignment referential prerequisites.
   */
  select count(*)
    into v_count
  from public.teacher_classes tc
  left join public.schools s
    on s.id = tc.school_id
  left join public.profiles p
    on p.id = tc.teacher_id
  left join public.classes c
    on c.id = tc.class_id
  left join public.subjects sub
    on sub.id = tc.subject_id
  where tc.school_id is null
     or tc.teacher_id is null
     or tc.class_id is null
     or tc.subject_id is null
     or s.id is null
     or p.id is null
     or c.id is null
     or sub.id is null;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-023]: %s teacher_classes rows contain null or invalid required references',
          v_count
        );
  end if;

  select count(*)
    into v_count
  from public.teacher_classes tc
  join public.classes c
    on c.id = tc.class_id
  where c.school_id is distinct from tc.school_id;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-022/TBL-023]: %s teacher_classes rows disagree with classes.school_id',
          v_count
        );
  end if;

  select count(*)
    into v_count
  from public.teacher_classes tc
  join public.subjects s
    on s.id = tc.subject_id
  where s.school_id is not null
    and s.school_id is distinct from tc.school_id;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-022]: %s teacher_classes rows disagree with subjects.school_id',
          v_count
        );
  end if;

  /*
   * Duplicate assignment rows would prevent a canonical unique assignment
   * contract from being introduced safely.
   */
  select count(*)
    into v_count
  from (
    select
      school_id,
      teacher_id,
      class_id,
      subject_id
    from public.teacher_classes
    group by
      school_id,
      teacher_id,
      class_id,
      subject_id
    having count(*) > 1
  ) duplicates;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-022]: %s duplicate teacher-class-subject assignment groups exist',
          v_count
        );
  end if;

  /*
   * TBL-024 — canonical day domain.
   *
   * The current live application contract uses ISO weekday values:
   * Monday = 1 through Sunday = 7.
   */
  select count(*)
    into v_count
  from public.timetable_slots
  where day_of_week is null
     or day_of_week not between 1 and 7;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-024]: %s timetable_slots rows have day_of_week outside 1..7',
          v_count
        );
  end if;

  /*
   * TBL-026 — valid time range.
   */
  select count(*)
    into v_count
  from public.timetable_slots
  where start_time is null
     or end_time is null
     or start_time >= end_time;

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-026]: %s timetable_slots rows have null, zero-length, or reversed time ranges',
          v_count
        );
  end if;

  /*
   * TBL-027 — valid effective-date range.
   */
  select count(*)
    into v_count
  from public.timetable_slots
  where effective_from is null
     or (
       effective_until is not null
       and effective_until < effective_from
     );

  if v_count > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = format(
          'TBL-005 failed [TBL-027]: %s timetable_slots rows have invalid effective-date ranges',
          v_count
        );
  end if;

  raise notice 'TBL-005 PASSED: timetable constraint data preconditions are satisfied';
end
$tbl005$;

rollback;
