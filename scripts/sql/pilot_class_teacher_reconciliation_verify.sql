\set ON_ERROR_STOP on

-- Certify the canonical class-teacher transition without depending on production
-- fixture counts. Production-specific population counts are verified read-only
-- after promotion.
do $$
declare
  q text;
  wc text;
  policy_roles name[];
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version::text='20260818001345'
  ) then
    raise exception 'canonical class-teacher reconciliation migration missing';
  end if;

  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version::text='20260818002145'
  ) then
    raise exception 'class-group teacher authority closure migration missing';
  end if;

  select qual,with_check into q,wc
  from pg_policies
  where schemaname='public'
    and tablename='class_join_requests'
    and policyname='join_requests_teacher';

  if q is null or wc is null then
    raise exception 'join_requests_teacher policy missing';
  end if;

  if q not ilike '%teacher_classes%'
     or q not ilike '%is_class_teacher%'
     or q not ilike '%school_members%'
     or q not ilike '%teacher_id%'
     or q not ilike '%role = ''teacher''%'
     or q not ilike '%NOT (EXISTS%teacher_classes canonical%'
  then
    raise exception 'join request teacher policy is not canonical-first with bounded teacher-only fallback';
  end if;

  if q ilike '%owner%'
     or q ilike '%admin%'
     or q ilike '%parent%'
     or wc ilike '%owner%'
     or wc ilike '%admin%'
     or wc ilike '%parent%'
  then
    raise exception 'teacher-specific join-request policy admits a non-teacher membership role';
  end if;

  if exists (
    select 1
    from public.teacher_classes tc
    join public.classes c on c.id=tc.class_id
    where tc.is_class_teacher=true
      and tc.school_id is distinct from c.school_id
  ) then
    raise exception 'canonical class-teacher assignment crosses class school boundary';
  end if;

  if exists (
    select 1
    from public.teacher_classes tc
    where tc.is_class_teacher=true
      and not exists (
        select 1
        from public.school_members sm
        where sm.school_id=tc.school_id
          and sm.profile_id=tc.teacher_id
          and sm.role='teacher'
      )
  ) then
    raise exception 'canonical class-teacher assignment lacks current teacher membership';
  end if;

  if exists (
    select 1
    from public.teacher_classes
    where is_class_teacher=true
    group by class_id
    having count(*)>1
  ) then
    raise exception 'class has more than one canonical class teacher';
  end if;

  -- Class groups must no longer derive teacher authority from classes.teacher_id.
  select qual,with_check,roles into q,wc,policy_roles
  from pg_policies
  where schemaname='public'
    and tablename='class_groups'
    and policyname='Teachers manage their class groups';

  if q is null or wc is null then
    raise exception 'class_groups teacher policy missing';
  end if;

  if policy_roles <> array['authenticated'::name]
     or q not ilike '%teacher_classes%'
     or q not ilike '%school_members%'
     or q not ilike '%role = ''teacher''%'
     or q ilike '%classes.teacher_id%'
     or wc ilike '%classes.teacher_id%'
  then
    raise exception 'class_groups teacher policy is not canonical assignment + current teacher membership bound';
  end if;

  select qual,with_check,roles into q,wc,policy_roles
  from pg_policies
  where schemaname='public'
    and tablename='class_group_members'
    and policyname='Teachers manage group members';

  if q is null or wc is null then
    raise exception 'class_group_members teacher policy missing';
  end if;

  if policy_roles <> array['authenticated'::name]
     or q not ilike '%teacher_classes%'
     or q not ilike '%school_members%'
     or q not ilike '%student_classes%'
     or q not ilike '%is_current = true%'
     or q ilike '%classes.teacher_id%'
     or wc ilike '%classes.teacher_id%'
  then
    raise exception 'class_group_members policy is not canonical teacher + current learner enrollment bound';
  end if;

  if has_table_privilege('anon','public.class_groups','SELECT')
     or has_table_privilege('anon','public.class_groups','INSERT')
     or has_table_privilege('anon','public.class_groups','UPDATE')
     or has_table_privilege('anon','public.class_groups','DELETE')
     or has_table_privilege('anon','public.class_group_members','SELECT')
     or has_table_privilege('anon','public.class_group_members','INSERT')
     or has_table_privilege('anon','public.class_group_members','UPDATE')
     or has_table_privilege('anon','public.class_group_members','DELETE')
  then
    raise exception 'anonymous class-group table privileges remain';
  end if;
end $$;

select 'PILOT CLASS-TEACHER + CLASS-GROUP AUTHORITY RECONCILIATION PASSED' as result;
