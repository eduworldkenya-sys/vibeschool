import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = fs.readFileSync("lib/class-workbook/model.ts", "utf8");
const context = {
  exports: {},
  Map,
  Set,
  Date,
  Number,
  String,
  Object,
  Array,
  Error,
  Math,
};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  context,
);
const m = context.exports;
const learner = (id, name, adm = null) => ({
  id,
  name,
  admission_number: adm,
  profile_id: null,
});
const data = {
  teacherId: "t",
  schoolId: "s",
  classId: "c",
  className: "Grade 6",
  subjects: [
    { id: "english", name: "English" },
    { id: "math", name: "Mathematics" },
  ],
  learners: [
    learner("a", "Charles", "1024"),
    learner("b", "Mary", "1025"),
    learner("c", "Brian"),
  ],
  attendance: [
    {
      student_id: "a",
      date: "2026-10-01",
      status: "absent",
      is_late: false,
      timetable_slot_id: null,
    },
    {
      student_id: "a",
      date: "2026-10-01",
      status: "present",
      is_late: false,
      timetable_slot_id: "lesson",
    },
  ],
  homework: [
    {
      id: "h",
      title: "Group work",
      due_date: "2026-10-01",
      subject: "English",
      target_group_id: "g",
    },
    {
      id: "h2",
      title: "Draft submission",
      due_date: "2026-10-01",
      subject: "English",
      target_group_id: null,
    },
  ],
  submissions: [
    {
      student_id: "b",
      homework_id: "h2",
      status: "draft",
      submitted_at: null,
      received_at: null,
      mark: null,
    },
  ],
  assessments: [
    {
      student_id: "a",
      assessment_id: "quiz",
      subject_id: "english",
      percentage: 40,
      assessment_title: "Quiz",
      assessment_type: "formative",
      released_at: "2026-10-01",
    },
    {
      student_id: "a",
      assessment_id: "hidden",
      subject_id: "english",
      percentage: 90,
      assessment_title: "Draft quiz",
      assessment_type: "formative",
      released_at: null,
    },
  ],
  exams: [
    {
      id: "e1",
      name: "CAT 1",
      exam_type: "formative",
      created_at: "2026-09-20",
    },
    {
      id: "e2",
      name: "CAT 2",
      exam_type: "formative",
      created_at: "2026-10-01",
    },
    {
      id: "e3",
      name: "End term",
      exam_type: "summative",
      created_at: "2026-10-01",
    },
  ],
  results: [
    {
      id: "1",
      student_id: "a",
      exam_id: "e1",
      subject_id: "english",
      marks: 40,
      is_absent: false,
    },
    {
      id: "2",
      student_id: "a",
      exam_id: "e2",
      subject_id: "english",
      marks: 60,
      is_absent: false,
    },
    {
      id: "3",
      student_id: "b",
      exam_id: "e2",
      subject_id: "english",
      marks: 0,
      is_absent: true,
    },
    {
      id: "4",
      student_id: "c",
      exam_id: "e2",
      subject_id: "english",
      marks: 60,
      is_absent: false,
    },
  ],
  evidence: [],
  groups: [{ id: "g", name: "Reading" }],
  members: [{ student_id: "a", group_id: "g" }],
  interventions: [],
  outcomes: [],
  parentLinks: [],
  parentMessages: [],
  warnings: [],
};
const doc = m.emptyDocument();
m.validateDocument(doc);
const filters = {
  subjectId: "english",
  start: "",
  end: "",
  groupId: "",
  examId: "e2",
  compareExamId: "e1",
};
const sheet = (kind) => doc.sheets.find((s) => s.kind === kind);
const project = (kind) =>
  m.project(data, sheet(kind), doc, filters, "2026-10-03");
assert.equal(
  project("attendance").rows[0].values.attendance,
  0,
  "lesson attendance must not inflate daily attendance",
);
assert.equal(project("homework").rows[0].values.missing, 2);
assert.equal(
  project("homework").rows[1].values.missing,
  1,
  "group work must not be assigned to other learners; draft is not submitted",
);
data.learners[1].joined_at = "2026-10-02";
assert.equal(
  project("homework").rows[1].values.missing,
  0,
  "homework due before enrolment is not overdue work for a new learner",
);
delete data.learners[1].joined_at;
assert.equal(
  project("assessments").rows[0].values.average,
  40,
  "unreleased scores must not enter averages",
);
assert.equal(project("exams").rows[0].values.examChange, 20);
assert.equal(
  project("exams").rows[1].values.examChange,
  null,
  "absence must not become zero performance",
);
assert.equal(project("exams").rows[0].values.rank, 1);
assert.equal(project("exams").rows[2].values.rank, 1, "ties share rank");
filters.compareExamId = "e3";
assert.equal(
  project("exams").rows[0].values.examChange,
  null,
  "different exam types are not comparable",
);
filters.compareExamId = "e1";
filters.subjectId = "";
assert.equal(
  project("exams").rows[0].values.exam_e2,
  "Choose a subject",
  "no mixing subjects",
);
filters.subjectId = "english";
assert.equal(
  m.filterRows(project("exams").rows, "Who improved").rows.length,
  1,
);
assert.equal(
  m.filterRows(project("homework").rows, "missing homework").rows.length,
  3,
);
assert.equal(
  m.filterRows(project("assessments").rows, "Below 50").rows.length,
  1,
);
assert.equal(m.filterRows(project("roster").rows, "Charles").rows.length, 1);
assert.equal(
  m.filterRows(project("roster").rows, "invent a forecast").understood,
  false,
  "unknown commands must not make claims",
);
assert.equal(
  m.calculate(
    { operation: "average", sources: ["a", "b"] },
    { a: 10, b: null },
  ),
  null,
);
assert.equal(
  m.calculate({ operation: "sum", sources: ["a", "b"] }, { a: 10, b: 0 }),
  10,
);
assert.equal(
  m.calculate(
    { operation: "difference", sources: ["a", "b"] },
    { a: 10, b: 3 },
  ),
  7,
);
assert.throws(() => m.parseCell("2026-02-30", "date"));
assert.throws(() => m.parseCell("Infinity", "number"));
assert.throws(() => m.parseCell("100oops", "number"));
assert.equal(m.parseCell("No", "check"), false);
assert.equal(m.parseCell("0", "number"), 0);
const imported = m.previewPaste(
  [
    ["1025", "70"],
    ["1024", "0"],
  ],
  data.learners,
  [{ id: "x", type: "number" }],
);
assert.equal(imported[0].studentId, "b");
assert.equal(imported[1].value, 0);
assert.throws(() =>
  m.previewPaste(
    [
      ["1024", "12"],
      ["1024", "24"],
    ],
    data.learners,
    [{ id: "x", type: "number" }],
  ),
);
assert.throws(() =>
  m.previewPaste([["Charles", "12"]], data.learners, [
    { id: "x", type: "number" },
  ]),
);
assert.throws(() =>
  m.previewPaste(
    [["1024", "12"]],
    [...data.learners, learner("d", "Duplicate", "1024")],
    [{ id: "x", type: "number" }],
  ),
);
assert.equal(m.safeExport('=HYPERLINK("evil")'), '\'=HYPERLINK("evil")');
assert.equal(m.safeExport(-10), -10);
assert.equal(m.compareValues(null, 0, true), 1);
const malformed = structuredClone(doc);
malformed.sheets[0].columns = [
  { id: "f", label: "F", type: "formula", operation: "sum", sources: ["f"] },
];
assert.throws(
  () => m.validateDocument(malformed),
  "formula cycles must be rejected",
);
const contaminated = structuredClone(doc);
contaminated.cells[doc.sheets[0].id] = { a: { officialMark: 90 } };
assert.throws(
  () => m.validateDocument(contaminated),
  "custom cells cannot invent canonical columns",
);
const loader = fs.readFileSync("lib/class-workbook/data.ts", "utf8");
assert.match(loader, /teacher_get_operating_context/);
assert.match(loader, /learners\.length\s*!==\s*ids\.length/);
assert.match(loader, /p_expected_revision/);
assert.match(loader, /upsert_attendance_batch/);
assert.match(loader, /saveCanonicalExamResults/);
assert.match(loader, /expectedUpdatedAt/);
const resultAuthority = fs.readFileSync("lib/teacher/examResultAuthority.ts", "utf8");
assert.match(resultAuthority, /teacher_save_exam_results/);
assert.match(resultAuthority, /row\.student_id===input\.studentId/);
assert.match(resultAuthority, /row\.is_absent===input\.isAbsent/);
assert.doesNotMatch(loader, /\.from\(["']exam_results["']\)\s*\.upsert/);
console.log(
  "Class workbook: identity imports, projections, unknown commands, missing evidence, formulas and export safety passed.",
);
