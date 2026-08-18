#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(
  root,
  'supabase/migrations/20260818132500_canonical_student_academic_identity.sql',
);
const handoverPath = path.join(
  root,
  'docs/security/STUDENT_IDENTITY_CONSOLIDATION_20260818.md',
);

function fail(message) {
  console.error(`student-identity-contract: ${message}`);
  process.exitCode = 1;
}

for (const file of [migrationPath, handoverPath]) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(root, file)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const sql = fs.readFileSync(migrationPath, 'utf8');
const handover = fs.readFileSync(handoverPath, 'utf8');

const canonicalTables = [
  'student_exam_readiness_state',
  'student_mistake_notebook',
  'student_practice_attempts',
  'student_revision_plan_items',
  'student_kcse_subject_confidence',
  'student_kcse_error_classifications',
  'student_kcse_retest_schedule',
  'student_kcse_mock_sessions',
];

for (const table of canonicalTables) {
  if (!sql.includes(table)) fail(`migration omits ${table}`);
  const fkPattern = new RegExp(
    `alter table public\\.${table}[\\s\\S]*?foreign key \\(student_id\\) references public\\.students\\(id\\)`,
    'i',
  );
  if (!fkPattern.test(sql)) fail(`${table}.student_id is not structurally canonical`);
}

const required = [
  'create or replace function public.current_student_id()',
  'security definer',
  'revoke all on function public.current_student_id() from public',
  'revoke all on function public.current_student_id() from anon',
  'student_identity_preflight_failed',
  'student_identity_collision',
  'student_identity_function_patch_drift',
  'student_identity_postcondition_failed',
  'student_identity_rls_postcondition_failed',
  'student_id=(select public.current_student_id())',
];

for (const token of required) {
  if (!sql.toLowerCase().includes(token.toLowerCase())) {
    fail(`missing invariant token: ${token}`);
  }
}

const forbiddenFinalPolicy = /create policy[\s\S]{0,500}student_id\s*=\s*\(\s*select\s+auth\.uid\(\)/gi;
if (forbiddenFinalPolicy.test(sql)) {
  fail('forward migration recreates direct auth.uid() ownership for academic student_id');
}

if (!handover.includes('**29**') || !handover.includes('public.students.id')) {
  fail('handover does not preserve corrected production evidence/invariant');
}

if (!process.exitCode) {
  console.log('student-identity-contract: PASS');
  console.log(`canonical academic tables: ${canonicalTables.length}`);
  console.log('production evidence recorded: 29 wrong-domain rows, one unique mapping');
}
