\set ON_ERROR_STOP on

-- Certify the canonical class-teacher transition without depending on production
-- fixture counts. Production-specific population counts are verified read-only
-- after promotion.
do $$
declare
  q text;
  wc text;
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version::text='20260818001345'
  ) then
    raise exception 'canonical class-teacher reconciliation migration missing';
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
end $$;

select 'PILOT CLASS-TEACHER CANONICAL RECONCILIATION PASSED' as result;
