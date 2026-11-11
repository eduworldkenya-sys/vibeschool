import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const src = fs.readFileSync("lib/homework/eligibility.ts", "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { isLearnerAssignedHomework, isAssignedHomeworkOverdue } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const joinedAt = "2026-11-11T13:00:00+00:00";
const old = { created_at: "2026-06-01T09:00:00+00:00", due_date: "2026-06-30", target_group_id: null };
const fresh = { created_at: "2026-11-11T13:01:00+00:00", due_date: "2026-11-12", target_group_id: null };
const catchup = { ...fresh, due_date: "2026-11-10" };
assert.equal(isLearnerAssignedHomework(old, joinedAt), false, "Historic work is never assigned to a new learner");
assert.equal(isAssignedHomeworkOverdue(old, joinedAt, "2026-11-11"), false, "Historic work cannot become missing");
assert.equal(isLearnerAssignedHomework(fresh, joinedAt), true, "Work published after joining is assigned");
assert.equal(isAssignedHomeworkOverdue(fresh, joinedAt, "2026-11-11"), false, "Future work is not overdue");
assert.equal(isAssignedHomeworkOverdue(catchup, joinedAt, "2026-11-11"), true, "Assigned overdue work can be missing");
assert.equal(isLearnerAssignedHomework(fresh, null), false, "Missing enrolment evidence fails closed");
assert.equal(isLearnerAssignedHomework({ ...fresh, created_at: null }, joinedAt), false, "Missing publication evidence fails closed");
const grouped = { ...fresh, target_group_id: "group-1" };
assert.equal(isLearnerAssignedHomework(grouped, joinedAt, "2026-11-11T13:02:00+00:00"), false, "Joining group after work publication does not backdate");
assert.equal(isLearnerAssignedHomework(grouped, joinedAt, "2026-11-11T12:59:00+00:00"), true, "Existing group member receives new work");
assert.equal(isLearnerAssignedHomework(grouped, joinedAt), false, "Unknown group membership fails closed");

for (const path of [
  "app/teacher/classhub/[id]/page.tsx",
  "app/teacher/classhub/[id]/student/[studentId]/page.tsx",
  "lib/homework/useHomeworkFeed.ts",
  "lib/classroom/model.ts",
  "app/teacher/classhub/[id]/homework/page.tsx",
]) {
  assert.match(fs.readFileSync(path, "utf8"), /isLearnerAssignedHomework|isAssignedHomeworkOverdue/, path + " must use canonical eligibility");
}
const attendance = fs.readFileSync("app/teacher/attendance/page.tsx", "utf8");
assert.match(attendance, /saveRegister\(true\)/, "Partial register saving must be available");
assert.match(attendance, /Save progress/, "The partial action must be clearly labelled");
assert.match(attendance, /Submit register/, "Complete register action must remain separate");
const assessment = fs.readFileSync("app/teacher/assessment/page.tsx", "utf8");
assert.match(assessment, /uniqueStrands/, "Strands are shown once");
assert.match(assessment, /Choose from curriculum/, "Sub-strands use the curriculum taxonomy");
console.log("ClassHub homework, attendance and assessment regressions: PASS");
