import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const sql = read("supabase/migrations/20261109121000_independent_learner_projects.sql");
const page = read("app/student/projects/independent/page.tsx");
const school = read("app/student/projects/page.tsx");
const hub = read("components/student/LearnActivityHub.tsx");

for (const name of ["independent_owner_profile_id","independent_notes","independent_completed_at"]) {
  assert.ok(sql.includes(name), 'Canonical project column missing: ' + name);
}
assert.match(sql, /references auth\.users\(id\)/);
for (const action of ["select","insert","update"]) {
  assert.match(sql, new RegExp("projects_independent_learner_" + action));
}
assert.match(sql, /independent_owner_profile_id = \(select auth\.uid\(\)\)/);
assert.match(sql, /school_id is null and class_id is null and teacher_id is null/);
assert.doesNotMatch(sql, /create table /i, "Do not create a duplicate project table");
assert.match(page, /supabase\.auth\.getUser\(\)/);
assert.match(page, /\.eq\("independent_owner_profile_id", ownerId\)/);
assert.match(page, /\.eq\("independent_owner_profile_id", userId\)/);
assert.match(page, /status: complete \? "submitted" : "active"/);
assert.match(page, /My observations and findings/);
assert.match(page, /not teacher-marked assessments/);
assert.match(school, /\/student\/projects\/independent/);
assert.match(hub, /href: hasSchoolClass \? "\/student\/projects" : "\/student\/projects\/independent"/);
assert.doesNotMatch(page, /[\u{1F300}-\u{1FAFF}]/u);
console.log("PASS: Owner-scoped independent projects reuse the canonical projects table");
