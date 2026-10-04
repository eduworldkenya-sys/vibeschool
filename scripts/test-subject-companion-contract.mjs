import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const hub = read("app/teacher/subjecthub/page.tsx");
const companion = read("components/teacher/SubjectCompanion.tsx");
const handoff = read("components/teacher/SubjectLessonHandoff.tsx");
const subjectContext = read("lib/teacher/subjectContext.ts");
const guide = read("app/teacher/teacher-guide/page.tsx");
const notes = read("app/teacher/lesson-notes/page.tsx");
const scheme = read("app/teacher/scheme/AuthoritySchemePage.jsx");
const library = read("lib/content-engine/subjectClassLibrary.ts");
const resources = read("app/teacher/resources/page.tsx");

assert.match(hub, /SubjectCompanion subject=\{activeSubject\} classes=\{classes\}/, "SubjectHub must mount the canonical subject companion");
assert.doesNotMatch(hub, /Unlink all|setImpactScore|impactScore|pts this term/, "SubjectHub must not expose unsafe unlinking or synthetic impact scores");
assert.doesNotMatch(hub, /\.from\(['"]teacher_classes['"]\)[\s\S]{0,120}\.delete\(/, "SubjectHub must not delete assignments directly");
assert.doesNotMatch(hub, /CBC Grade 6 Mathematics outcomes loaded/, "SubjectHub must not hard-code a subject or grade");
assert.match(hub, /item\.publicationId && item\.chapterId/, "Adopted subject content must expose a real open path");
assert.match(library, /publicationId: string \| null/, "Subject library contract must carry publication identity");
assert.match(library, /chapterId: string \| null/, "Subject library contract must carry chapter identity");
assert.match(resources, /searchParams\.get\('classId'\)/, "Resources must consume inherited class context");
assert.match(resources, /searchParams\.get\('subjectId'\)/, "Resources must consume inherited subject context");
assert.match(resources, /visiblePacks/, "Resources must scope ready packs to inherited subject context");

assert.match(subjectContext, /teacher_get_operating_context/, "Subject context must validate against canonical teacher operating authority");
assert.match(subjectContext, /item\.class_id === classId && item\.subject_id === subjectId/, "Subject context must validate the exact class-subject assignment");
assert.match(subjectContext, /loadTeacherTimetableForRange/, "Lesson handoff must use the canonical timetable engine");
assert.match(subjectContext, /teaching_occurrences/, "Lesson handoff must reconcile exact teaching occurrences");
assert.match(subjectContext, /lesson_plans/, "Lesson handoff must reconcile prepared lesson plans");
assert.match(subjectContext, /lifecycle !== "cancelled"/, "Cancelled teaching occurrences must not be offered");
assert.match(subjectContext, /lessonPlanId/, "Lesson notes links must carry canonical lesson plan identity");

assert.match(guide, /SubjectLessonHandoff/, "Teacher Guide must resolve an exact lesson when opened from Subject context");
assert.match(guide, /lessonPlanId=\$\{workspace\.existingPlan\?\.id\}/, "Teacher Guide must use the Lesson Notes canonical query key");
assert.doesNotMatch(guide, /lesson-notes\?planId=/, "Teacher Guide must not emit the obsolete planId query key");
assert.match(notes, /params\.get\("lessonPlanId"\) \|\| params\.get\("planId"\)/, "Lesson Notes must accept canonical identity while preserving legacy links");
assert.match(notes, /SubjectLessonHandoff/, "Lesson Notes must resolve class-subject context into a prepared lesson");
assert.match(scheme, /initial = useRef\(\{classId:searchParams\.get\('classId'\),subjectId:searchParams\.get\('subjectId'\)/, "Scheme must consume inherited class and subject context");

for (const label of [
  "Scheme of Work",
  "Learning Content",
  "Resources",
  "Lesson Plans",
  "Teacher Guide",
  "Lesson Notes / Teach",
  "Teaching Schedule",
  "Attendance",
  "Homework",
  "Assessment",
  "Markbook",
  "Students & Class Data",
  "Class Workbook",
  "Learner Progress",
]) {
  assert.ok(companion.includes(label), `Missing subject tool: ${label}`);
}

for (const route of [
  "/teacher/scheme",
  "/teacher/vibelearn",
  "/teacher/resources",
  "/teacher/lessonplan",
  "/teacher/lesson-notes",
  "/teacher/teacher-guide",
  "/teacher/timetable",
  "/teacher/attendance",
  "/teacher/classhub/",
  "/teacher/assessment",
  "/teacher/results",
]) {
  assert.ok(companion.includes(route), `Missing connected subject route: ${route}`);
}

assert.match(companion, /classId=.*subjectId=/s, "Class-scoped subject tools must carry class and subject context");
assert.match(companion, /Current context:/, "Teacher must be able to see which class context is active");
assert.match(companion, /purpose="overview"/, "Subject workspace must surface the next authoritative teaching action");

console.log("subject companion + context lifecycle contract: PASS");
