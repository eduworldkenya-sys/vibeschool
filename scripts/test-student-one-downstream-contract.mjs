#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/20260818125323_student_one_downstream_authorization_hardening.sql');
const retargetingPath = path.join(root, 'supabase/migrations/20260818125338_student_one_downstream_retargeting_closure.sql');
const handoverPath = path.join(root, 'docs/security/STUDENT_ONE_DOWNSTREAM_CHAIN_CERTIFICATION_20260818.md');

function fail(message) {
  console.error(`student-one-downstream-contract: ${message}`);
  process.exitCode = 1;
}

for (const file of [migrationPath, retargetingPath, handoverPath]) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(root, file)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const hardening = fs.readFileSync(migrationPath, 'utf8').toLowerCase();
const retargeting = fs.readFileSync(retargetingPath, 'utf8').toLowerCase();
const sql = `${hardening}\n${retargeting}`;
const handover = fs.readFileSync(handoverPath, 'utf8');

const requiredPolicies = [
  'cbc_admin_read', 'cbc_parent_read', 'cbc_student_read', 'cbc_teacher_read',
  'pol_cbc_insert', 'pol_cbc_update',
  'homework_submissions_parent_read', 'homework_submissions_student_insert',
  'homework_submissions_student_read', 'homework_submissions_student_update',
  'teacher manages own lesson evidence', 'teacher manages own lesson interventions',
  'exercise_submissions_parent_read', 'project_submissions_parent_read',
  'project_submissions_student_insert', 'teacher manages own project_submissions',
  'pol_psl_update', 'psl_student_read', 'psl_teacher_read',
];
for (const policy of requiredPolicies) {
  if (!sql.includes(policy)) fail(`missing hardened policy ${policy}`);
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
  'student_one_cbc_update_retargeting_postcondition_failed',
  'student_one_project_submission_authority_postcondition_failed',
  'student_one_parent_link_retargeting_postcondition_failed',
];
for (const token of requiredAuthorityTokens) {
  if (!sql.includes(token)) fail(`missing downstream invariant token: ${token}`);
}

for (const [name, source] of [['hardening', hardening], ['retargeting', retargeting]]) {
  const directStudentAuth = /student_id\s*=\s*\(?\s*select\s+auth\.uid\(\)|student_id\s*=\s*auth\.uid\(\)/gi;
  if (directStudentAuth.test(source)) fail(`${name} migration equates durable learner student_id directly with account auth.uid()`);

  const publicPolicyCreate = /create\s+policy[\s\S]{0,180}?\bto\s+public\b/gi;
  if (publicPolicyCreate.test(source)) fail(`${name} migration recreates a downstream policy TO public`);
}

const retargetingRequired = [
  'create policy pol_cbc_update',
  'create policy project_submissions_student_insert',
  'create policy pol_psl_update',
  'join public.projects p',
  'p.class_id = sc.class_id',
  'p.school_id = sc.school_id',
  'from public.school_members sm',
];
for (const token of retargetingRequired) {
  if (!retargeting.includes(token)) fail(`retargeting migration missing invariant token: ${token}`);
}

for (const token of ['Student = 1', 'public.students.id']) {
  if (!handover.includes(token)) fail(`handover missing certification token: ${token}`);
}

if (!process.exitCode) {
  console.log('student-one-downstream-contract: PASS');
  console.log(`hardened policy contracts: ${requiredPolicies.length}`);
  console.log('production lineage: 20260818125323 + 20260818125338');
  console.log('canonical learner write rule: account -> students.id');
  console.log('retargeting closure: CBC update + project submission + parent link');
}
