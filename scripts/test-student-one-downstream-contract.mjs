#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/20260818125323_student_one_downstream_authorization_hardening.sql');
const retargetingPath = path.join(root, 'supabase/migrations/20260818125338_student_one_downstream_retargeting_closure.sql');
const dedupPath = path.join(root, 'supabase/migrations/20260818130039_student_one_homework_policy_dedup.sql');
const vibelearnAuthorityPath = path.join(root, 'supabase/migrations/20260818130509_student_one_vibelearn_identity_authority.sql');
const vibeShellPath = path.join(root, 'components/student/VibeLearnShellWrapper.tsx');
const vibeProgressPath = path.join(root, 'components/student/VibeProgress.tsx');
const vibePointsPath = path.join(root, 'lib/vibelearn-points.ts');
const handoverPath = path.join(root, 'docs/security/STUDENT_ONE_DOWNSTREAM_CHAIN_CERTIFICATION_20260818.md');

function fail(message) {
  console.error(`student-one-downstream-contract: ${message}`);
  process.exitCode = 1;
}

const files = [migrationPath, retargetingPath, dedupPath, vibelearnAuthorityPath, vibeShellPath, vibeProgressPath, vibePointsPath, handoverPath];
for (const file of files) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(root, file)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const hardening = fs.readFileSync(migrationPath, 'utf8').toLowerCase();
const retargeting = fs.readFileSync(retargetingPath, 'utf8').toLowerCase();
const dedup = fs.readFileSync(dedupPath, 'utf8').toLowerCase();
const vibelearnAuthority = fs.readFileSync(vibelearnAuthorityPath, 'utf8').toLowerCase();
const sql = `${hardening}\n${retargeting}\n${dedup}\n${vibelearnAuthority}`;
const vibeShell = fs.readFileSync(vibeShellPath, 'utf8');
const vibeProgress = fs.readFileSync(vibeProgressPath, 'utf8');
const vibePoints = fs.readFileSync(vibePointsPath, 'utf8');
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
  'vibelearn_saved_owner', 'vibelearn_completed_read_own', 'vibelearn_completed_write_own',
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
  'student_one_homework_policy_dedup_failed_legacy_policy_remains',
  'student_award_vibelearn_points',
  'student_touch_vibelearn_streak',
  'student_one_vibelearn_public_policy_postcondition_failed',
  'student_one_vibelearn_direct_gamification_write_postcondition_failed',
];
for (const token of requiredAuthorityTokens) {
  if (!sql.includes(token)) fail(`missing downstream invariant token: ${token}`);
}

for (const [name, source] of [['hardening', hardening], ['retargeting', retargeting], ['vibelearn', vibelearnAuthority]]) {
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

const forbiddenVibeClientPatterns = [
  /\.eq\(\s*['"]student_id['"]\s*,\s*user\.id\s*\)/g,
  /student_id\s*:\s*user\.id/g,
  /from\(['"]vibelearn_points['"]\)\.insert/g,
  /from\(['"]vibelearn_streaks['"]\)\.(insert|upsert|update)/g,
];
for (const [name, source] of [['VibeLearnShellWrapper', vibeShell], ['VibeProgress', vibeProgress], ['vibelearn-points', vibePoints]]) {
  for (const pattern of forbiddenVibeClientPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) fail(`${name} contains a forbidden profile-ID/direct-gamification shortcut: ${pattern}`);
  }
}

if (!vibeShell.includes("supabase.rpc('current_student_id')")) fail('VibeLearn shell does not resolve canonical learner identity');
if (!vibeProgress.includes("supabase.rpc('current_student_id')")) fail('VibeProgress does not resolve canonical learner identity');
if (!vibePoints.includes("supabase.rpc('student_award_vibelearn_points'")) fail('VibeLearn points do not use server authority');
if (!vibePoints.includes("supabase.rpc('student_touch_vibelearn_streak'")) fail('VibeLearn streaks do not use server authority');

for (const token of ['Student = 1', 'public.students.id']) {
  if (!handover.includes(token)) fail(`handover missing certification token: ${token}`);
}

if (!process.exitCode) {
  console.log('student-one-downstream-contract: PASS');
  console.log(`hardened policy contracts: ${requiredPolicies.length}`);
  console.log('production lineage: 20260818125323 + 20260818125338 + 20260818130039 + 20260818130509');
  console.log('canonical learner write rule: account -> students.id');
  console.log('VibeLearn runtime: canonical saved/completed + server-owned points/streaks');
}
