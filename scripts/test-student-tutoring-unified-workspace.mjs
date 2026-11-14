import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const home = readFileSync("app/student/page.tsx", "utf8");
const tuition = readFileSync("app/student/tutoring/page.tsx", "utf8");
const nav = readFileSync("components/student/BottomNav.tsx", "utf8");
const timetable = readFileSync("app/student/timetable/page.tsx", "utf8");

test("My Tutors remains an authorised relationship and sessions centre", () => {
  assert.match(tuition, /vibetutor_student_inbox/);
  assert.match(tuition, /vibetutor_claim_student_invite/);
  assert.match(tuition, /vibetutor_respond_student_invite/);
  assert.match(tuition, /pending_guardian/);
  assert.match(tuition, /My Tutors sections/);
  assert.match(tuition, /section="messages"/);
  assert.match(tuition, /section="lessons"/);
  assert.doesNotMatch(tuition, /tab === "resources"|tab === "assignments"|tab === "notes"|tab === "progress"/);
});

test("Learner home reuses the private, owner-scoped tutor inbox", () => {
  assert.match(home, /vibetutor_student_inbox/);
  assert.match(home, /aria-label="Your private tutors"/);
  assert.match(home, /href="\/student\/tutoring"/);
  assert.match(home, /setTutoringSummary\(null\)/);
});

test("School, tutoring and personal learning stay in canonical tools", () => {
  for (const route of ["/student/study", "/student/vibelearn/topic-practice", "/student/vibelearn/exams", "/student/tasks", "/student/timetable", "/student/marks"]) {
    assert.ok(tuition.includes(route), route);
  }
  for (const route of ["/student/study", "/student/vibelearn/topic-practice", "/student/tasks", "/student/marks"]) {
    assert.ok(nav.includes(route), route);
  }
  assert.match(timetable, /useTuitionTimetable/);
  assert.match(timetable, /context === "tuition"/);
});
