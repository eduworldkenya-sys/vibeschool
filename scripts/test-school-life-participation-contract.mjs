import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20261011110000_canonical_learner_school_life.sql", "utf8");
const ui = fs.readFileSync("components/teacher/SchoolLifeParticipation.tsx", "utf8");
const profile = fs.readFileSync("components/teacher/LearnerSchoolLifeStrip.tsx", "utf8");
const learnerLayout = fs.readFileSync("app/teacher/classhub/[id]/student/[studentId]/layout.tsx", "utf8");
const classPage = fs.readFileSync("app/teacher/classhub/[id]/page.tsx", "utf8");
const manager = fs.readFileSync("app/teacher/classhub/[id]/activities/page.tsx", "utf8");

for (const name of ["school_life_activities","school_life_participations","school_life_participation_history","school_life_mutation_receipts"]) {
  assert.match(sql, new RegExp(`alter table public\\.${name} enable row level security`), `${name} requires RLS`);
  assert.match(sql, new RegExp(`public\\.${name}`), `${name} is explicitly provisioned`);
}
for (const rpc of ["teacher_school_life_snapshot","teacher_save_school_life_activity","teacher_set_school_life_members"]) {
  assert.match(sql, new RegExp(`create or replace function public\\.${rpc}`));
  assert.match(sql, new RegExp(`revoke all on function public\\.${rpc}`));
  assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}`));
  assert.ok(ui.includes(rpc) || profile.includes(rpc), `Client calls ${rpc}`);
}
assert.ok(sql.includes("teacher_can_access_class(p_class_id,null,true)"), "Class teacher authority required before read");
assert.ok(sql.includes("teacher_can_access_class(sc.class_id,null,true)"), "Bulk updates check every learner class");
assert.ok(sql.includes("and sc.is_current=true"), "Participation requires current enrollment");
assert.ok(sql.includes("school_life_one_active_membership"), "One active membership per activity/learner");
assert.ok(sql.includes("p_request_id uuid"), "Bulk write carries stable retry receipt");
assert.ok(sql.includes("request_id_payload_conflict"), "Retry cannot mutate different payload");
assert.ok(sql.includes("jsonb_agg(id order by id)"), "Idempotent bulk receipt canonicalizes selected IDs");
assert.ok(sql.includes("'joined'") && sql.includes("'ended'") && sql.includes("'updated'"), "Every lifecycle change is audited");
assert.ok(sql.includes("school_scope_requires_admin"), "Class teachers cannot rewrite school-wide activity catalog");
assert.ok(!/grant (all|insert|update|delete) on public.school_life_activities[^;]*to authenticated/i.test(sql), "Clients cannot mutate ledger tables directly");
assert.ok(ui.includes("Save selected") && ui.includes("End selected"), "Bulk add/update/end exposed");
assert.ok(ui.includes("Add participation") && ui.includes("Update"), "Single learner fast edit exposed");
assert.ok(ui.includes("void reload()") && ui.includes("await reload()"), "Local state refreshes after writes");
assert.ok(profile.includes("teacher_school_life_snapshot") && profile.includes("SchoolLifeParticipation"), "Learner profile shows same canonical data");
const learnerProfilePage = fs.readFileSync("app/teacher/classhub/[id]/student/[studentId]/page.tsx", "utf8");
const relatedRecords = fs.readFileSync("components/teacher/LearnerRelatedRecords.tsx", "utf8");
assert.ok(!learnerLayout.includes("LearnerSchoolLifeStrip"), "No duplicate school-life strip above learner identity");
assert.ok(learnerProfilePage.includes('setPanel("activities")') && learnerProfilePage.includes("<LearnerRelatedRecords"), "Profile opens school-life activities in place");
assert.ok(relatedRecords.includes("<SchoolLifeParticipation"), "Activity edits still use canonical participation workflow");
assert.ok(classPage.includes("openActivitiesForSelection") && classPage.includes("activities"), "ClassHub selected learners pass to bulk editor");
assert.ok(manager.includes("SchoolLifeParticipation"), "Teacher manager reuses same editor");
console.log("PASS: school life read/write authority, history, bulk workflow and profile projections");
