import assert from "node:assert/strict";
import fs from "node:fs";
const migration = fs.readFileSync("supabase/migrations/20261016163000_learner_evidence_visibility_release_774.sql", "utf8");
const profile = fs.readFileSync("app/teacher/classhub/[id]/student/[studentId]/page.tsx", "utf8");
assert.match(migration, /alter policy assessment_gradebook_parent_read[\s\S]*?released_at is not null/i);
assert.match(migration, /alter policy assessment_gradebook_student_read[\s\S]*?released_at is not null/i);
for (const name of ["assessment_gradebook_class_teacher_read", "cbc_assessments_class_teacher_read"]) {
  assert.ok(migration.includes(name), name);
}
assert.match(migration, /teacher_can_access_class\(class_id, null::uuid, true\)/);
assert.match(migration, /sc\.is_current is true/);
assert.match(profile, /gradebookQuery\.eq\("subject_id", requestedSubjectId\)/);
assert.match(profile, /cbcQuery\.eq\("subject_id", requestedSubjectId\)/);
assert.match(profile, /examQuery\.eq\("subject_id", requestedSubjectId\)/);
console.log("Learner RLS and class/subject evidence contract: PASS");