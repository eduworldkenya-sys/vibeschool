import fs from 'node:fs';import assert from 'node:assert/strict';
const p=fs.readFileSync('app/teacher/profile/teaching-scope/page.tsx','utf8');
const m=fs.readFileSync('supabase/migrations/20261001090325_teacher_curriculum_reconciliation_authority.sql','utf8');
assert.match(p,/teacher_get_operating_context/);assert.match(p,/get_allowed_teaching_subjects/);assert.match(p,/teacher_reconcile_class_subject/);assert.match(p,/will not guess/i);assert.match(p,/does not limit the books, resources or content/i);
assert.match(m,/curriculum_state/);assert.match(m,/needs_reconciliation/);assert.match(m,/teacher_assignment_not_authorized/);assert.match(m,/invalid_subject_for_level/);
console.log('teacher curriculum reconciliation UX contract: PASS');