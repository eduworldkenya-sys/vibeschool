#!/usr/bin/env node
import fs from 'node:fs'

const basePath = 'supabase/migrations/20260818190000_student_one_runtime_identity_guard.sql'
const perfPath = 'supabase/migrations/20260818191500_student_one_health_catalog_performance.sql'
const sql = fs.readFileSync(basePath, 'utf8').toLowerCase().replace(/\s+/g, ' ')
const perf = fs.readFileSync(perfPath, 'utf8').toLowerCase().replace(/\s+/g, ' ')

const required = [
  'create unique index if not exists students_one_active_profile_uidx',
  'where profile_id is not null and deleted_at is null',
  'create or replace function public.current_student_id()',
  "raise exception 'ambiguous_learner_identity'",
  'create table if not exists public.student_identity_health_runs',
  'missing_student_fk_constraints',
  'duplicate_active_profile_mappings',
  'active_profile_role_mismatches',
  'active_student_profiles_without_learner',
  'create or replace function public.run_student_identity_health_check()',
  "if current_user not in ('postgres','service_role')",
  'revoke all on function public.run_student_identity_health_check() from public, anon, authenticated',
  'grant execute on function public.run_student_identity_health_check() to service_role',
  "when v_wrong_fk > 0 or v_missing_fk > 0 or v_duplicates > 0 or v_role_mismatch > 0 then 'blocked'",
  "when v_profile_without_learner > 0 then 'attention'"
]

for (const needle of required) {
  if (!sql.includes(needle)) {
    throw new Error(`Student=1 runtime identity contract missing: ${needle}`)
  }
}

const performanceRequired = [
  'create or replace function public.run_student_identity_health_check()',
  'from pg_catalog.pg_class c',
  'join pg_catalog.pg_namespace n',
  'join pg_catalog.pg_attribute a',
  'from pg_catalog.pg_constraint con',
  "con.confrelid = 'public.students'::regclass",
  "'catalog_scan','pg_catalog'",
  'revoke all on function public.run_student_identity_health_check() from public, anon, authenticated',
  'grant execute on function public.run_student_identity_health_check() to service_role'
]

for (const needle of performanceRequired) {
  if (!perf.includes(needle)) {
    throw new Error(`Student=1 health catalog performance contract missing: ${needle}`)
  }
}

if (perf.includes('information_schema.')) {
  throw new Error('Student=1 health instrumentation must not regress to information_schema catalog expansion')
}

const forbidden = [
  'return s.id from public.students s where s.profile_id = (select auth.uid()) order by',
  'limit 1; $function$'
]

for (const needle of forbidden) {
  if (sql.includes(needle) || perf.includes(needle)) {
    throw new Error(`Student=1 resolver reintroduced silent first-row selection: ${needle}`)
  }
}

console.log('Student=1 runtime identity guard contract: PASS')
