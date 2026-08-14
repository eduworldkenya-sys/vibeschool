-- Read-only contract verification for publication curriculum provenance.
-- Expected result: every assertion returns true.

select to_regclass('public.publication_curriculum_provenance') is not null as provenance_table_exists;

select coalesce(c.relrowsecurity, false) as provenance_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'publication_curriculum_provenance';

select count(*) = 2 as expected_policies_present
from pg_policies
where schemaname = 'public'
  and tablename = 'publication_curriculum_provenance'
  and policyname in (
    'publication_curriculum_provenance_public_verified_read',
    'publication_curriculum_provenance_author_manage'
  );

select count(*) = 0 as anon_has_no_table_privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'publication_curriculum_provenance'
  and grantee = 'anon';

select count(*) = 4 as authenticated_has_explicit_crud_only
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'publication_curriculum_provenance'
  and grantee = 'authenticated'
  and privilege_type in ('SELECT','INSERT','UPDATE','DELETE');

select pg_get_constraintdef(oid) like '%external_review_status%approved%external_reference%' as approved_requires_external_reference
from pg_constraint
where conrelid = 'public.publication_curriculum_provenance'::regclass
  and conname = 'publication_curriculum_provenance_external_reference_check';
