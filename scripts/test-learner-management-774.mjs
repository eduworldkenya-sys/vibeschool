import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const students = read("app/teacher/students/page.tsx");
const profile = read("app/teacher/classhub/[id]/student/[studentId]/page.tsx");
const classHub = read("app/teacher/classhub/[id]/page.tsx");
const truth = read("lib/learner-intelligence/truth.ts");

assert.match(students, /\.filter\(\(item\) => item\.is_class_teacher\)/, "Only class-teacher assignments may create learners");
assert.match(students, /school_id=\$\{encodeURIComponent\(context\.school_id\)\}&class_id=\$\{encodeURIComponent\(classId\)\}/, "Add Learner must pass both authoritative identifiers");
assert.match(students, /scopedSubjectId.*\?/s, "Subject teacher learner links must carry subject context");
assert.match(students, /\?subjectId=\$\{encodeURIComponent\(scopedSubjectId\)\}/, "Learner profile must receive subject scope");
assert.match(profile, /contextDirtyKeys\.current\.has\(field\.key\)/, "Reconcile only clean About drafts");
assert.match(profile, /contextDirtyKeys\.current\.add\(field\.key\)/, "Track edits before saving");
assert.match(profile, /contextDirtyKeys\.current\.delete\(key\)/, "Only saved About field can become clean");
assert.match(profile, /contextSaved\[field\.key\]/, "Saved learner values must be readable");
assert.match(profile, /gradebook\.filter\(\(item\) => item\.released_at !== null\)/, "Released assessment must exclude drafts");
assert.match(profile, /cbcPerformance\(item\.performance\)\?\.label/, "Display canonical CBC labels");
assert.doesNotMatch(classHub, /const PERF_MAP/, "CBC competency is not a numeric exam average");
assert.match(classHub, /cbcPerformance\(row\.performance\)/, "Class summary must normalize CBC enum");
assert.match(truth, /cbcPerformance\(item\.performance\)\?\.needsSupport/, "Learner intelligence must not ignore the canonical CBC enum");

const { cbcPerformance } = await import("../lib/learner-intelligence/cbcPerformance.ts");
const cases = [
  ["exceeds_expectation", "EE", false],
  ["meets_expectation", "ME", false],
  ["approaches_expectation", "AE", true],
  ["below_expectation", "BE", true],
  ["ee", "EE", false],
  ["BE", "BE", true],
];
for (const [value, expectedCode, needsSupport] of cases) {
  const actual = cbcPerformance(value);
  assert.equal(actual?.code, expectedCode, value);
  assert.equal(actual?.needsSupport, needsSupport, value);
}
assert.equal(cbcPerformance("invalid-record"), null, "Unknown rubric must not be invented");
assert.equal(cbcPerformance(null), null);
console.log("Learner management #774 client/authority/CBC regression checks: PASS");