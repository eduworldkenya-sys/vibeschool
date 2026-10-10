/** Canonical adapters and selection validation. No connected writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import ts from "typescript";
let signedIn = true,
  failTable = "",
  school = "school";
const calls = [];
const fixtures = {
  assessment_assignments: [],
  academic_terms: [
    {
      id: "term",
      name: "Term 3",
      start_date: "2026-09-01",
      end_date: "2026-12-01",
      school_id: "school",
    },
  ],
};
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.bounds = [0, 499];
  }
  select() {
    return this;
  }
  order() {
    return this;
  }
  eq(key, value) {
    this.filters.push([key, value]);
    return this;
  }
  in(key, value) {
    this.filters.push([key, value]);
    return this;
  }
  range(from, to) {
    this.bounds = [from, to];
    return this;
  }
  then(resolve, reject) {
    calls.push({
      table: this.table,
      filters: this.filters,
      bounds: this.bounds,
    });
    const data = (fixtures[this.table] ?? [])
      .filter((row) =>
        this.filters.every(([key, value]) =>
          Array.isArray(value) ? value.includes(row[key]) : value === row[key],
        ),
      )
      .slice(this.bounds[0], this.bounds[1] + 1);
    return Promise.resolve({
      data,
      error: this.table === failTable ? { message: "permission denied" } : null,
    }).then(resolve, reject);
  }
}
const client = {
  auth: {
    getUser: async () => ({
      data: { user: signedIn ? { id: "teacher" } : null },
      error: null,
    }),
  },
  from: (t) => new Query(t),
  rpc: async (name) => {
    calls.push({ rpc: name });
    assert.equal(
      name,
      "teacher_get_operating_context",
      "loading context must remain read-only",
    );
    return {
      data: {
        teacher_id: "teacher",
        school_id: school,
        schools: [{ id: "school", name: "Test School" }],
        classes: [
          {
            class_id: "class",
            class_name: "Grade 6",
            subject_id: "math",
            subject_name: "Mathematics",
          },
        ],
      },
      error: null,
    };
  },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const m = new Module(file);
  m.require = (name) => {
    if (name === "@/lib/supabase") return { supabase: client };
    if (name === "@/lib/learner-intelligence/progress-data")
      return load("lib/learner-intelligence/progress-data.ts");
    if (name === "@/lib/time") return load("lib/time.ts");
    return Module.createRequire(import.meta.url)(name);
  };
  m._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    file,
  );
  cache.set(file, m.exports);
  return m.exports;
}
const workspace = load("lib/assessment/workspace.ts");
for (let i = 0; i < 501; i++)
  fixtures.assessment_assignments.push({
    id: "assignment-" + i,
    assessment_id: "assessment",
    teacher_id: "teacher",
    school_id: "school",
    class_id: "class",
    assigned_at: "2026-10-09T04:00:00Z",
    assessment_definitions: {
      title: "Fractions CAT",
      assessment_type: "cat",
      subject_id: "math",
    },
  });
fixtures.assessment_assignments.push({
  ...fixtures.assessment_assignments[0],
  id: "foreign",
  school_id: "other",
});
const context = await workspace.loadAssessmentContext();
assert.equal(
  context.assignments.length,
  501,
  "pagination returns the whole canonical assignment list",
);
assert(!context.assignments.some((a) => a.id === "foreign"));
assert(
  calls
    .filter((c) => c.table === "assessment_assignments")
    .every((c) =>
      c.filters.some(
        ([key, value]) => key === "school_id" && value === "school",
      ),
    ),
);
const valid = workspace.reconcileSelection(context, {
  classId: "class",
  subjectId: "math",
  termId: "term",
  assignmentId: "assignment-0",
});
assert.equal(valid.assignmentId, "assignment-0");
assert.deepEqual(
  workspace.reconcileSelection(context, {
    classId: "foreign",
    subjectId: "foreign",
    termId: "foreign",
    assignmentId: "foreign",
  }),
  workspace.emptySelection,
);
assert.equal(workspace.visibleAssignments(context, valid).length, 501);
const outside = {
  ...context,
  terms: [
    { id: "earlier", name: "Earlier", start: "2026-01-01", end: "2026-02-01" },
  ],
};
assert.equal(
  workspace.reconcileSelection(outside, {
    termId: "earlier",
    assignmentId: "assignment-0",
  }).assignmentId,
  "",
  "stale assessment must clear when the term changes",
);
for (const bad of ["", " ", "NaN", "Infinity", "-1", "11"])
  assert.throws(() => workspace.parseMark(bad, 10));
assert.equal(workspace.parseMark("0", 10), 0);
assert.equal(workspace.parseMark("0.25", 10), 0.25);
assert.equal(
  workspace.safeCsvCell('=HYPERLINK("bad")'),
  '"\'=HYPERLINK(""bad"")"',
);
assert.equal(workspace.safeCsvCell("Charles"), '"Charles"');
failTable = "assessment_assignments";
await assert.rejects(
  () => workspace.loadAssessmentContext(),
  /permission denied/,
);
failTable = "academic_terms";
await assert.rejects(
  () => workspace.loadAssessmentContext(),
  /terms could not be loaded/,
);
failTable = "";
signedIn = false;
await assert.rejects(() => workspace.loadAssessmentContext(), /Sign in/);
signedIn = true;
school = "unconfirmed";
await assert.rejects(() => workspace.loadAssessmentContext(), /membership/);
console.log(
  "Assessment workspace adapters: PASS — complete scoped pagination, no read mutations, invalid/stale selection rejection, explicit permission/sign-in failures, blank vs zero vs partial marks and formula-safe CSV.",
);

const released=(studentId,score,maxScore=10)=>({studentId,score,maxScore,attemptStatus:'released',resultStatus:'released'})
assert.deepEqual(workspace.compareReleasedResults([released('a',0),released('b',10)],[released('a',5),{...released('b',10),resultStatus:'marked'},released('new',10)]),{learnerCount:1,averageBefore:0,averageAfter:50,change:50})
assert.equal(workspace.compareReleasedResults([released('a',5)],[released('a',5,20)]),null,'different maximum marks are not comparable')
