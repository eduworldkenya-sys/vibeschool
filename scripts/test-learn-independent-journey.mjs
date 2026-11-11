import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const hub = read("components/student/LearnActivityHub.tsx");
const reading = read("app/student/vibelearn/reading/page.tsx");
const layout = read("app/student/vibelearn/layout.tsx");
const form4 = read("app/student/vibelearn/page.tsx");
const projects = read("app/student/projects/page.tsx");
const exams = read("app/student/vibelearn/exams/page.tsx");
const practice = read("app/student/vibelearn/practice/page.tsx");
const nav = read("components/student/BottomNav.tsx");

for (const title of ["Read", "Topic Practice", "Exams", "Projects", "My Work", "Revision", "My Tuition"]) {
  assert.match(hub, new RegExp('title:\\s*["\\\']' + title + '["\\\']'), 'Learn destination missing: ' + title);
}
assert.match(hub, /from "lucide-react"/, "Learn icons must be SVG");
assert.doesNotMatch(hub, /[\u{1F300}-\u{1FAFF}]/u, "Learn tiles must not use emoji");
assert.match(hub, /href: "\/student\/vibelearn\/reading"/);
assert.match(hub, /href:\s*hasSchoolClass\s*\?\s*"\/student\/projects"\s*:\s*"\/student\/projects\/independent"/);
assert.match(hub, /hasSchoolClass/, "School and independent project navigation must be differentiated");
assert.match(hub, /Coming soon/);
assert.match(hub, />Lessons</, "Lessons must remain discoverable as upcoming");
assert.match(hub, />Activities</, "Activities must remain discoverable as upcoming");
assert.match(reading, /eq\("status", "published"\)/, "Reading must not include unpublished content");
assert.match(reading, /eq\("format", "vibetextbook"\)/, "Reading must use canonical textbooks");
assert.match(reading, /\/read\/textbook\//, "Reading must navigate to canonical reader");
assert.match(reading, /cbc_grade/, "Reading needs grade selection");
assert.match(reading, /return \(\)/, "Reading must cancel stale loads");
assert.match(layout, /<LearnActivityHub \/>/, "General grades must receive activity hub");
assert.match(form4, /<LearnActivityHub \/>/, "Form 4 must receive activity hub");
assert.match(layout, /pathname !== "\/student\/vibelearn"/, "Nested routes must not be replaced");
assert.doesNotMatch(layout, /identity\.independent \|\| pathname/, "Independent learners must use the same grade workstation");
assert.match(projects, /from\("projects"\)/);
assert.match(exams, /listMyAssessmentAssignments/, "Do not replace exam engine");
assert.match(practice, /recordGroundedPracticeAnswer/, "Keep canonical grounded practice");
assert.match(nav, /path\.startsWith\("\/student\/projects"\)/);
assert.ok(existsSync("app/student/vibelearn/exams/page.tsx"));
assert.ok(existsSync("app/student/vibelearn/revision/page.tsx"));
console.log("PASS: Learn navigation, published Reading, grade routing and exam regression source contracts");
