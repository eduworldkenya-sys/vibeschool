#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/20260818141500_student_one_downstream_authorization_hardening.sql');
const handoverPath = path.join(root, 'docs/security/STUDENT_ONE_DOWNSTREAM_CHAIN_CERTIFICATION_20260818.md');

function fail(message) {
  console.error(`student-one-downstream-contract: ${message}`);
  process.exitCode = 1;
}

for (const file of [migrationPath, handoverPath]) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(root, file)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();
const handover = fs.readFileSync(handoverPath, 'utf8');

const requiredPolicies = [
  'cbc_admin_read',
  'cbc_parent_read',
  'cbc_student_read',
  'cbc_teacher_read',
  'pol_cbc_insert',
  'homework_submissions_parent_read',
  'homework_submissions_student_insert',
  'homework_submissions_student_read',
  'homework_submissions_student_update',
  'teacher manages own lesson evidence',
  'teacher manages own lesson interventions',
  'exercise_submissions_parent_read',
  'project_submissions_parent_read',
  'teacher manages own project_submissions',
  'psl_student_read',
  'psl_teacher_read',
];

for (const policy of requiredPolicies) {
  if (!sql.includes(policy.toLowerCase())) fail(`missing hardened policy ${policy}`);
}

const requiredAuthorityTokens = [
  'for insert to authenticated',
  'from public.teacher_classes tc',
  'from public.student_classes sc',
  'join public.students s on s.id = sc.student_id',
  's.profile_id = (select auth.uid())',
  's.deleted_at is null',
  "coalesce(psl.access_level, 'full') <> 'none'",
  'student_one_downstream_public_policy_postcondition_failed',
  'student_one_downstream_cbc_authority_postcondition_failed',
];

for (const token of requiredAuthorityTokens) {
  if (!sql.includes(token)) fail(`missing downstream invariant token: ${token}`);
}

const directStudentAuth = /student_id\s*=\s*\(?\s*select\s+auth\.uid\(\)|student_id\s*=\s*auth\.uid\(\)/gi;
if (directStudentAuth.test(sql)) {
  fail('migration equates durable learner student_id directly with account auth.uid()');
}

const publicPolicyCreate = /create\s+policy[\s\S]{0,180}?\bto\s+public\b/gi;
if (publicPolicyCreate.test(sql)) {
  fail('migration recreates a downstream policy TO public');
}

for (const token of ['Student = 1', 'public.students.id', 'NOT YET PILOT-CERTIFIED']) {
  if (!handover.includes(token)) fail(`handover missing baseline certification token: ${token}`);
}

if (!process.exitCode) {
  console.log('student-one-downstream-contract: PASS');
  console.log(`hardened policy contracts: ${requiredPolicies.length}`);
  console.log('canonical learner write rule: account -> students.id');
  console.log('adult access rule: teacher assignment / parent_student_links');
}
