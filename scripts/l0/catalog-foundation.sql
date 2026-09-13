-- L0 FOUNDATION RECOVERY INSTRUMENT
-- READ-ONLY ONLY. This file must never be executed with DDL or DML.
-- Purpose: capture production catalog truth, repository-replay seed candidates,
-- dependency edges, RLS, and security metadata for evidence-based recovery.

-- 1. Public object inventory
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned_table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    WHEN 'S' THEN 'sequence'
    ELSE c.relkind::text
  END AS object_kind,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p','v','m','S')
ORDER BY object_kind, object_name;

-- 2. Public function inventory, including SECURITY DEFINER
SELECT
  n.nspname AS schema_name,
  p.oid,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.prosecdef AS security_definer,
  pg_get_function_result(p.oid) AS result_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, identity_arguments;

-- 3. RLS policies
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  pol.polname,
  pol.polcmd,
  pol.polpermissive,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expression
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, pol.polname;

-- 4. Grants for public functions. PUBLIC includes anon/authenticated in Supabase
-- unless explicit ACLs override it. This is inventory only.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  COALESCE(array_to_string(p.proacl, E'\n'), '') AS function_acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, identity_arguments;

-- 5. Dependency edges for candidate foundation objects.
-- A dependency row means objid depends on refobjid.
WITH targets AS (
  SELECT c.oid, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'schools', 'profiles', 'classes', 'subjects',
      'teacher_classes', 'timetable_slots', 'report_schedules'
    )
)
SELECT
  t.relname AS referenced_object,
  pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent_object,
  d.deptype
FROM pg_depend d
JOIN targets t ON t.oid = d.refobjid
WHERE d.deptype IN ('n','a')
ORDER BY t.relname, dependent_object;

-- 6. Exact definitions for functions referenced by the recovery seed.
-- This remains read-only and is only evidence; it does not execute the returned DDL.
SELECT
  p.oid,
  n.nspname || '.' || p.proname AS qualified_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('auth_uid', 'update_updated_at_column');

-- NOTE:
-- Foundation membership is NOT inferred from this file alone.
-- It is derived as:
--   F0 = ((R ∩ P) - C) - PLATFORM
-- followed by dependency closure over production's pg_depend graph.
-- R/C must come from a parser-based repository migration analysis.
