import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const hub = read("components/student/LearnActivityHub.tsx");
const reading = read("app/student/vibelearn/reading/page.tsx");
const shared = read("components/learn/SchoolLearnLibrary.tsx");
const catalog = read("lib/learn/schoolCatalog.ts");
const layout = read("app/student/vibelearn/layout.tsx");
const form4 = read("app/student/vibelearn/page.tsx");
const projects = read("app/student/projects/page.tsx");
const exams = read("app/student/vibelearn/exams/page.tsx");
const practice = read("app/student/vibelearn/practice/page.tsx");
const nav = read("components/student/BottomNav.tsx");

const classTools = read("app/teacher/classhub/[id]/page.tsx");
const taskPlanner = read("app/student/tasks/page.tsx");
for (const label of ["Homework", "Classwork", "Exercises", "Projects", "Assessment"]) {
  assert.match(classTools, new RegExp("id: '" + label.toLowerCase() + "', label: '" + label + "'"), "Class tools need an equal entry for " + label);
}
for (const [label, route] of [
  ["Homework", "/student/homework"],
  ["Classwork", "/student/assessment"],
  ["Exercises", "/student/exercises"],
]) {
  assert.match(hub, new RegExp('title: "' + label + '"'), "Learn must expose " + label);
  assert.ok(hub.includes('href: "' + route + '"'), "Reuse existing learner destination: " + route);
  assert.ok(taskPlanner.includes("'" + label + "','" + route + "'"), "My Tasks should expose " + label);
}
assert.equal((hub.match(/title: "Homework"/g) ?? []).length, 1, "Homework should have one equal activity tile, not a duplicated feature");
assert.match(classTools, /if \(a\.id === 'projects'\) route = `\/teacher\/classhub\/\$\{classId\}\/projects`/, "Class projects retain the existing workspace");
assert.match(classTools, /if \(a\.id === 'exercises'\) route = `\/teacher\/classhub\/\$\{classId\}\/exercises`/, "Class exercises retain the existing workspace");
for (const title of ["Read", "Topic Practice", "Exams", "Projects", "My Work", "Revision", "My Tuition"]) {
  assert.match(hub, new RegExp('title:\\s*["\\\']' + title + '["\\\']'), 'Learn destination missing: ' + title);
}
assert.match(hub, /from "lucide-react"/, "Learn icons must be SVG");
assert.doesNotMatch(hub, /[\u{1F300}-\u{1FAFF}]/u, "Learn tiles must not use emoji");
assert.match(hub, /href: "\/learn"/, 'Read must open unified Learn');
assert.match(hub, /href:\s*hasSchoolClass\s*\?\s*"\/student\/projects"\s*:\s*"\/student\/projects\/independent"/);
assert.match(hub, /hasSchoolClass/, "School and independent project navigation must be differentiated");
assert.match(hub, /Coming soon/);
assert.match(hub, />Lessons</, "Lessons must remain discoverable as upcoming");
assert.match(hub, />Activities</, "Activities must remain discoverable as upcoming");
assert.match(shared, /\.eq\('status', 'published'\)/, 'Reading must not include unpublished content');
assert.match(shared, /\.eq\('format', 'vibetextbook'\)/, 'Reading must use canonical textbooks');
assert.match(shared, /\/read\/textbook\//, 'Reading must use canonical reader');
assert.match(shared, /cbc_grade/, 'Reading needs grade selection');
assert.match(shared, /return \(\) => \{ active = false \}/, 'Reading must cancel stale loads');
assert.match(reading, /StudentLearnLegacyRedirect/, 'Old reading URL must converge on Learn');
assert.match(catalog, /readersForSubject/, 'Known published readers must be discoverable');
assert.match(form4, /redirect\('\\/student\\/study'\)/, 'All learners enter their protected study desk');
assert.match(layout, /return <>\{children\}<\/>/, 'Nested exams, practice and revision routes must pass through unchanged');
assert.match(read('app/student/study/page.tsx'), /getVibeLearnWorkstation/, 'The personal learning workspace retains canonical backend');
assert.doesNotMatch(layout, /identity\.independent \|\| pathname/, "Independent learners must use the same grade workstation");
assert.match(projects, /from\("projects"\)/);
assert.match(exams, /listMyAssessmentAssignments/, "Do not replace exam engine");
assert.match(practice, /recordGroundedPracticeAnswer/, "Keep canonical grounded practice");
assert.match(nav, /path\.startsWith\("\/student\/projects"\)/);
assert.ok(existsSync("app/student/vibelearn/exams/page.tsx"));
assert.ok(existsSync("app/student/vibelearn/revision/page.tsx"));
console.log("PASS: Learn navigation, published Reading, grade routing and exam regression source contracts");
