\set ON_ERROR_STOP on

-- Semantic certification for production migration
-- 20260812082409_close_remaining_rls_cross_tenant_gaps_v2, which was recovered
-- from the live Supabase migration ledger after blank-rebuild forensics showed
-- it was absent from GitHub.

do $$
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version::text = '20260812082409'
  ) then
    raise exception 'recovered cross-tenant security migration is missing';
  end if;
end $$;

-- School membership creation must not be directly client-writable.
do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name='school_members'
      and grantee='authenticated'
      and privilege_type='INSERT'
  ) then
    raise exception 'authenticated retains direct school_members INSERT';
  end if;
end $$;

-- Teacher mastery visibility must be earned through a current learner class
-- plus the teacher's matching class+school assignment.
do $$
declare q text;
begin
  select qual into q
  from pg_policies
  where schemaname='public'
    and tablename='student_outcome_mastery'
    and policyname='mastery_teacher_read';

  if q is null
     or q not ilike '%student_classes%'
     or q not ilike '%teacher_classes%'
     or q not ilike '%class_id%'
     or q not ilike '%school_id%'
     or q not ilike '%teacher_id%'
     or q not ilike '%is_current%'
  then
    raise exception 'teacher mastery visibility is not current enrollment + class/school assignment bound';
  end if;
end $$;

-- Meetings must be tenant-scoped and role-scoped, never public-table readable.
do $$
declare q text; wc text;
begin
  if not (select relrowsecurity from pg_class where oid='public.meetings'::regclass) then
    raise exception 'meetings RLS disabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name='meetings' and grantee='anon'
  ) then
    raise exception 'anonymous table privilege remains on meetings';
  end if;

  select qual into q from pg_policies
  where schemaname='public' and tablename='meetings' and policyname='meetings_select_authorized';
  if q is null
     or q not ilike '%created_by%'
     or q not ilike '%chair_id%'
     or q not ilike '%secretary_id%'
     or q not ilike '%school_members%'
     or q not ilike '%school_id%'
     or q not ilike '%profile_id%'
  then
    raise exception 'meeting read authority is not creator/chair/secretary/school-member bound';
  end if;

  select with_check into wc from pg_policies
  where schemaname='public' and tablename='meetings' and policyname='meetings_insert_member';
  if wc is null
     or wc not ilike '%created_by%'
     or wc not ilike '%school_members%'
     or wc not ilike '%school_id%'
     or wc not ilike '%profile_id%'
  then
    raise exception 'meeting insert authority is not creator + school-membership bound';
  end if;

  select qual into q from pg_policies
  where schemaname='public' and tablename='meetings' and policyname='meetings_update_authorized';
  select with_check into wc from pg_policies
  where schemaname='public' and tablename='meetings' and policyname='meetings_update_authorized';
  if q is null or wc is null
     or q not ilike '%created_by%'
     or q not ilike '%school_members%'
     or q not ilike '%owner%'
     or q not ilike '%admin%'
     or wc not ilike '%created_by%'
     or wc not ilike '%school_members%'
     or wc not ilike '%owner%'
     or wc not ilike '%admin%'
  then
    raise exception 'meeting update authority is not creator-or-school-admin bound';
  end if;

  select qual into q from pg_policies
  where schemaname='public' and tablename='meetings' and policyname='meetings_delete_authorized';
  if q is null
     or q not ilike '%created_by%'
     or q not ilike '%school_members%'
     or q not ilike '%owner%'
     or q not ilike '%admin%'
  then
    raise exception 'meeting delete authority is not creator-or-school-admin bound';
  end if;
end $$;

select 'RECOVERED CROSS-TENANT SECURITY SEMANTIC CERTIFICATION PASSED' as result;
