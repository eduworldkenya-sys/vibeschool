import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const hub = read("app/teacher/subjecthub/page.tsx");
const companion = read("components/teacher/SubjectCompanion.tsx");
const library = read("lib/content-engine/subjectClassLibrary.ts");
const resources = read("app/teacher/resources/page.tsx");

assert.match(hub, /SubjectCompanion subject=\{activeSubject\} classes=\{classes\}/, "SubjectHub must mount the canonical subject companion");
assert.doesNotMatch(hub, /title="Unlink this subject from all assigned classes"/, "SubjectHub must not expose destructive assignment unlinking as a tab action");
assert.doesNotMatch(hub, /CBC Grade 6 Mathematics outcomes loaded/, "SubjectHub must not hard-code a subject or grade");
assert.match(hub, /item\.publicationId && item\.chapterId/, "Adopted subject content must expose a real open path");
assert.match(library, /publicationId: string \| null/, "Subject library contract must carry publication identity");
assert.match(library, /chapterId: string \| null/, "Subject library contract must carry chapter identity");
assert.match(resources, /searchParams\.get\('classId'\)/, "Resources must consume inherited class context");
assert.match(resources, /searchParams\.get\('subjectId'\)/, "Resources must consume inherited subject context");
assert.match(resources, /visiblePacks/, "Resources must scope ready packs to inherited subject context");

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

console.log("subject companion contract: PASS");
