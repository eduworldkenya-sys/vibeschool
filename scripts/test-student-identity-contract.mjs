#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(
  root,
  'supabase/migrations/20260818132500_canonical_student_academic_identity.sql',
);
const completionPath = path.join(
  root,
  'supabase/migrations/20260818140000_canonical_student_rpc_identity_completion.sql',
);
const handoverPath = path.join(
  root,
  'docs/security/STUDENT_IDENTITY_CONSOLIDATION_20260818.md',
);
const productionHandoverPath = path.join(
  root,
  'docs/security/STUDENT_IDENTITY_PRODUCTION_HANDOVER_20260818.md',
);

function fail(message) {
  console.error(`student-identity-contract: ${message}`);
  process.exitCode = 1;
}

for (const file of [migrationPath, completionPath, handoverPath, productionHandoverPath]) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(root, file)}`);
}
if (process.exitCode) process.exit(process.exitCode);

const sql = fs.readFileSync(migrationPath, 'utf8');
const completion = fs.readFileSync(completionPath, 'utf8');
const handover = fs.readFileSync(handoverPath, 'utf8');
const productionHandover = fs.readFileSync(productionHandoverPath, 'utf8');

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
  if (!completion.includes(`'${table}'`)) fail(`completion certification omits ${table}`);
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

const completionRequired = [
  'student_identity_runtime_completion',
  'student_identity_runtime_drift',
  'student_identity_runtime_certification_failed',
  'student_identity_noncanonical_rows',
  'student_identity_fk_certification_failed',
  "position(p.old_text in v_def)>0",
  "position(p.new_text in v_def)=0",
  'revoke all on function public.current_student_id() from public',
  'revoke all on function public.current_student_id() from anon',
  'grant execute on function public.current_student_id() to authenticated',
  'grant execute on function public.current_student_id() to service_role',
];

for (const token of completionRequired) {
  if (!completion.toLowerCase().includes(token.toLowerCase())) {
    fail(`completion migration missing invariant token: ${token}`);
  }
}

const requiredRuntimeSignatures = [
  'student_classify_kcse_mistake(uuid,text,text)',
  'student_create_kcse_mock(text,text,uuid)',
  'student_get_kcse_adaptive_practice(text,text,integer)',
  'student_get_kcse_mastery_map()',
  'student_get_kcse_mock(uuid)',
  'student_get_revision_workspace(text,text)',
  'student_resolve_mistake(uuid)',
  'student_save_kcse_mock_answer(uuid,uuid,integer,text,integer,uuid)',
  'student_search_kcse(text)',
  'student_update_kcse_profile(date,integer,integer,jsonb,boolean)',
  'student_update_revision_item_status(uuid,text)',
  'student_update_exam_readiness(date,integer,integer)',
  'student_generate_adaptive_revision_plan_v1(date,integer)',
  'student_generate_adaptive_revision_plan(date,integer)',
  'student_get_adaptive_revision_context()',
  'student_get_exam_readiness_brief()',
  'student_get_kcse_candidate_os()',
  'student_get_kcse_progress_history()',
  'student_get_twin_state_internal()',
  'student_record_grounded_practice_answer(uuid,text,integer,uuid)',
  'student_record_vibelearn_practice_answer(uuid,integer,integer,uuid)',
  'student_refresh_twin_memory()',
  'parent_get_student_kcse_brief(uuid)',
  'teacher_get_student_kcse_brief(uuid)',
];

for (const signature of requiredRuntimeSignatures) {
  if (!completion.includes(`'${signature}'`)) {
    fail(`completion migration omits runtime identity contract ${signature}`);
  }
}

const patchRows = completion.match(/^\('.*?',\d+,'/gm) ?? [];
if (patchRows.length !== 34) {
  fail(`completion migration must preserve 34 certified identity fragments; found ${patchRows.length}`);
}

const forbiddenFinalPolicy = /create policy[\s\S]{0,500}student_id\s*=\s*\(\s*select\s+auth\.uid\(\)/gi;
if (forbiddenFinalPolicy.test(sql)) {
  fail('forward migration recreates direct auth.uid() ownership for academic student_id');
}

if (!handover.includes('**29**') || !handover.includes('public.students.id')) {
  fail('handover does not preserve corrected production evidence/invariant');
}

for (const token of ['29', '34', '24', 'Student = 1', '20260818140000']) {
  if (!productionHandover.includes(token)) {
    fail(`production handover missing certification evidence: ${token}`);
  }
}

if (!process.exitCode) {
  console.log('student-identity-contract: PASS');
  console.log(`canonical academic tables: ${canonicalTables.length}`);
  console.log(`runtime identity functions: ${requiredRuntimeSignatures.length}`);
  console.log(`certified runtime fragments: ${patchRows.length}`);
  console.log('production evidence recorded: 29 wrong-domain rows, one unique mapping');
  console.log('production parity completion migration: 20260818140000');
}
