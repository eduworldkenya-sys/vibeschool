import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const migration=readFileSync("supabase/migrations/20261114063000_vibetutor_private_teaching_unification.sql","utf8");
const student=readFileSync("app/student/tutoring/page.tsx","utf8");
const tutor=readFileSync("app/teacher/tutoring/students/page.tsx","utf8");
const tasks=readFileSync("app/student/tasks/page.tsx","utf8");
const ui=readFileSync("components/vibetutor/PrivateTutorTasks.tsx","utf8");
const groups=readFileSync("components/vibetutor/PrivateTutorGroups.tsx","utf8");

test("Private tutor onboarding cannot publish a public listing implicitly",()=>{
  assert.match(migration,/perform public\.vibetutor_ensure_private_tutor\(\)/);
  assert.match(migration,/role::text = 'teacher'/);
  assert.match(migration,/account_status::text = 'active'/);
  assert.match(migration,/values \(auth\.uid\(\), coalesce\(v_name, 'VibeSchool Teacher'\), 'paused'/);
});
test("Private task RPCs enforce accepted connection and separate learner/tutor permissions",()=>{
  assert.match(migration,/create or replace function public\.vibetutor_assign_private_task/);
  assert.match(migration,/public\.vibetutor_private_access\(p_invitation\)/);
  assert.match(migration,/a\.student_profile_id=auth\.uid\(\)/);
  assert.match(migration,/t\.tutor_id=auth\.uid\(\)/);
  assert.match(migration,/alter table public\.vibetutor_private_tasks enable row level security/);
  assert.match(migration,/revoke all on public\.vibetutor_private_tasks from public, anon, authenticated/);
  assert.match(migration,/from public,anon;/);
});
test("Group membership and group task fan out require tutor ownership and accepted connections",()=>{
  assert.match(migration,/public\.vibetutor_create_private_group/);
  assert.match(migration,/public\.vibetutor_add_private_group_member/);
  assert.match(migration,/public\.vibetutor_remove_private_group_member/);
  assert.match(migration,/public\.vibetutor_assign_private_group_task/);
  assert.match(migration,/i\.status='accepted'/);
  assert.match(migration,/g\.tutor_id=auth\.uid\(\)/);
});
test("Private tasks are visible from the canonical learner task screen",()=>{
  assert.match(tasks,/vibetutor_my_private_tasks/);
  assert.match(tasks,/Private tutoring assignments/);
  assert.match(tasks,/student\/tutoring/);
  assert.match(student,/PrivateTutorTasks/);
  assert.match(tutor,/PrivateTutorTasks/);
  assert.match(tutor,/Tasks & feedback/);
  assert.match(tutor,/PrivateTutorGroups/);
  assert.match(ui,/vibetutor_review_private_task/);
  assert.match(groups,/vibetutor_assign_private_group_task/);
});
