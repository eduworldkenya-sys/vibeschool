\set ON_ERROR_STOP on

-- TBL-011 final-state verification.
-- Runs only against the isolated local Supabase database.

do $$
declare
  missing_tables text[];
begin
  select array_agg(required.name order by required.name)
  into missing_tables
  from (
    values
      ('public.timetable_slots'),
      ('public.teacher_classes'),
      ('public.teaching_occurrences'),
      ('public.school_periods')
  ) as required(name)
  where to_regclass(required.name) is null;

  if missing_tables is not null then
    raise exception
      'TBL-011 missing core tables: %',
      array_to_string(missing_tables, ', ');
  end if;
end
$$;

do $$
declare
  missing_rls text[];
begin
  select array_agg(c.relname order by c.relname)
  into missing_rls
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relname in (
      'timetable_slots',
      'teacher_classes',
      'teaching_occurrences',
      'school_periods'
    )
    and not c.relrowsecurity;

  if missing_rls is not null then
    raise exception
      'TBL-011 RLS disabled on: %',
      array_to_string(missing_rls, ', ');
  end if;
end
$$;

do $$
declare
  required_policy text;
  missing_policies text[] := array[]::text[];
begin
  foreach required_policy in array array[
    'timetable_slots.teachers_manage_own_slots',
    'timetable_slots.timetable_slots_admin',
    'timetable_slots.timetable_slots_student_read',
    'teacher_classes.pol_teacher_classes_select',
    'teacher_classes.teacher_classes_admin_insert',
    'teacher_classes.teacher_classes_admin_update',
    'teacher_classes.teacher_classes_admin_delete',
    'teaching_occurrences.teaching_occurrences_teacher_read',
    'teaching_occurrences.teaching_occurrences_admin_read',
    'teaching_occurrences.teaching_occurrences_no_delete',
    'school_periods.school_periods_teacher_read',
    'school_periods.school_periods_admin_all'
  ]
  loop
    if not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = split_part(required_policy, '.', 1)
        and p.policyname = split_part(required_policy, '.', 2)
    ) then
      missing_policies :=
        array_append(missing_policies, required_policy);
    end if;
  end loop;

  if cardinality(missing_policies) > 0 then
    raise exception
      'TBL-011 missing policies: %',
      array_to_string(missing_policies, ', ');
  end if;
end
$$;

do $$
declare
  unsafe_policies text[];
begin
  select array_agg(
    p.tablename || '.' || p.policyname
    order by p.tablename, p.policyname
  )
  into unsafe_policies
  from pg_policies p
  where p.schemaname = 'public'
    and (
      (
        p.tablename = 'teacher_classes'
        and p.policyname in (
          'pol_teacher_classes_insert',
          'pol_teacher_classes_update',
          'pol_teacher_classes_delete'
        )
      )
      or (
        p.tablename = 'teaching_occurrences'
        and p.policyname in (
          'teaching_occurrences_teacher_write',
          'teaching_occurrences_teacher_update'
        )
      )
    );

  if unsafe_policies is not null then
    raise exception
      'TBL-011 obsolete policies survived rebuild: %',
      array_to_string(unsafe_policies, ', ');
  end if;
end
$$;

do $$
declare
  occurrence_write_count integer;
begin
  select count(*)
  into occurrence_write_count
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'teaching_occurrences'
    and p.cmd in ('INSERT', 'UPDATE', 'ALL');

  if occurrence_write_count <> 0 then
    raise exception
      'TBL-011 direct teaching_occurrences write policies found: %',
      occurrence_write_count;
  end if;
end
$$;

select
  'TBL-011 FINAL SCHEMA VERIFICATION PASSED' as result,
  current_database() as database_name,
  current_setting('server_version') as postgres_version;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policy_count
from pg_class c
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = c.relname
where c.relnamespace = 'public'::regnamespace
  and c.relname in (
    'timetable_slots',
    'teacher_classes',
    'teaching_occurrences',
    'school_periods'
  )
group by c.relname, c.relrowsecurity
order by c.relname;
