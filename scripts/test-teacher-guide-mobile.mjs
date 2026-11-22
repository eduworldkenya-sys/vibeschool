import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const guide = readFileSync("app/teacher/teacher-guide/page.tsx", "utf8");
const selector = readFileSync("components/teacher/TeacherGuideSelector.tsx", "utf8");
const handoff = readFileSync("components/teacher/SubjectLessonHandoff.tsx", "utf8");
const subject = readFileSync("lib/teacher/subjectContext.ts", "utf8");

// Only canonical context grants a lesson. No sample lesson, fabricated
// timetable or parallel teacher-guide storage is introduced.
assert.match(selector, /supabase\.auth\.getUser\(\)/);
assert.match(selector, /teacher_get_operating_context/);
assert.match(selector, /<SubjectLessonHandoff/);
assert.match(handoff, /resolveSubjectAuthority\(classId, subjectId\)/);
assert.match(subject, /loadTeacherTimetableForRange/);
assert.match(subject, /lifecycle !== "cancelled"/);
assert.doesNotMatch(selector, /Example lesson|mock|demo lesson/i);
assert.doesNotMatch(guide, /Open a guide from your teaching context|Open Subjects|Open Scheme/);

// The teacher's class/subject choices are explicit and accessible.
assert.match(selector, /aria-label="Class"/);
assert.match(selector, /aria-label="Subject"/);
assert.match(selector, /disabled=\{!classId\}/);
assert.match(selector, /setSubjectId\(forClass\.length === 1 \? forClass\[0\]\.subject_id : ""\)/);
assert.match(selector, /setRetry\(n => n \+ 1\)/);

// Previous lesson is just a per-user shortcut, and is checked against the
// current active school and assigned class/subject before being offered.
assert.match(guide, /if\(!workspace\.existingPlan && !source\?\.schemeId\) return/);
assert.match(guide, /vibeschool\.teacher-guide\.recent\.\$\{workspace\.teacherId\}/);
assert.match(selector, /stored\.schoolId === context\.school_id/);
assert.match(selector, /item\.class_id === stored\.classId && item\.subject_id === stored\.subjectId/);
assert.match(selector, /entry\.href\.startsWith\("\/teacher\/teacher-guide\?"\)/);

// Loaded guide still uses saved Scheme/Plan and certified resources, not
// an unvalidated replacement content store.
assert.match(guide, /loadSavedTeacherGuide/);
assert.match(guide, /loadLessonWorkspace/);
assert.match(guide, /certifiedContent/);
assert.match(guide, /Authority & provenance/);
assert.match(guide, /Lesson plan checks/);
assert.match(guide, /Teach \/ Notes/);
assert.match(guide, /Change lesson/);
assert.doesNotMatch(guide, /supabase\.from\(|supabase\.rpc\(/);

console.log("Teacher Guide mobile context, shortcuts and canonical content: PASS");
