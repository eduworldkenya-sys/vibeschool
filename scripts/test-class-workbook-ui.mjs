/** Isolated DOM component tests. Fixtures do not claim production authentication. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const modules =
  process.env.WORKBOOK_UI_MODULES || "/tmp/workbook-ui/node_modules";
const { JSDOM } = await import(pathToFileURL(`${modules}/jsdom/lib/api.js`));
const { build } = await import(pathToFileURL(`${modules}/esbuild/lib/main.js`));
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: "http://localhost/teacher/classhub/c/workbook" },
);
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Event: dom.window.Event,
  MouseEvent: dom.window.MouseEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { fireEvent, screen, waitFor } = await import(
  pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`)
);
const { act } = React;
const fixture = {
  teacherId: "t",
  schoolId: "s",
  classId: "c",
  className: "Grade 6 Yellow",
  subjects: [{ id: "english", name: "English" }],
  classes: [{ id: "c", name: "Grade 6 Yellow", subjectIds: ["english"] }],
  terms: [],
  learners: [
    {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Charles Mwangi",
      admission_number: "1024",
      profile_id: null,
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Mary Wanjiku",
      admission_number: "1025",
      profile_id: null,
    },
  ],
  attendance: [],
  homework: [],
  submissions: [],
  assessments: [],
  exams: [
    {
      id: "exam",
      name: "CAT 1",
      term: 3,
      academic_year: 2026,
      exam_type: "formative",
      pass_mark: 50,
      is_locked: false,
      created_at: "2026-10-01",
    },
  ],
  results: [],
  evidence: [],
  groups: [],
  members: [],
  interventions: [],
  outcomes: [],
  parentLinks: [],
  parentMessages: [],
  warnings: [],
};
globalThis.__fixture = fixture;
globalThis.__saved = null;
globalThis.__revision = 0;
globalThis.__exports = [];
globalThis.__printed = 0;
dom.window.print = () => {
  globalThis.__printed += 1;
};
fs.mkdirSync(".cyborg", { recursive: true });
const output = path.resolve(".cyborg/workbook-ui.cjs");
await build({
  entryPoints: ["components/teacher/workbook/ClassWorkbook.tsx"],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  plugins: [
    {
      name: "isolated-component-boundaries",
      setup(b) {
        b.onResolve({ filter: /^next\// }, (args) => ({
          path: args.path,
          namespace: "framework",
        }));
        b.onLoad({ filter: /.*/, namespace: "framework" }, (args) => ({
          loader: "js",
          contents:
            args.path === "next/navigation"
              ? `const params={id:'c'};const search=new URLSearchParams();export const useParams=()=>params;export const useSearchParams=()=>search;`
              : args.path === "next/link"
                ? `import React from 'react';export default function Link(p){return React.createElement('a',p,p.children);}`
                : `export default function dynamic(){return ()=>null;}`,
        }));
        b.onResolve({ filter: /^@\/lib\/class-workbook\/data$/ }, () => ({
          path: "data",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents: `import {emptyDocument} from '${path.resolve("lib/class-workbook/model.ts")}';export async function loadWorkbook(){return {data:structuredClone(globalThis.__fixture),document:globalThis.__saved??emptyDocument(),revision:globalThis.__revision};}export async function saveDocument(data,doc,revision){if(globalThis.__conflict)throw new Error('Another window saved this workbook. Export your draft, then reload before saving again.');globalThis.__saved=structuredClone(doc);return ++globalThis.__revision;}export async function saveAttendance(){throw new Error('No attendance writes in this UI fixture');}export async function saveExamMarks(data,exam,subject,changes){globalThis.__fixture.results=changes.map(c=>({id:c.studentId,student_id:c.studentId,exam_id:exam,subject_id:subject,marks:c.value==='ABS'?0:c.value,is_absent:c.value==='ABS',updated_at:'now'}));}export async function createSelectedGroup(){throw new Error('No group writes in this UI fixture');}`,
        }));
        b.onResolve({ filter: /^@\/lib\/reports\/exportUtils$/ }, () => ({
          path: "reports",
          namespace: "report-fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "report-fixture" }, () => ({
          loader: "js",
          contents: `export function exportToCSV(options){globalThis.__exports.push({format:'csv',options:structuredClone(options)});}export async function exportToExcel(options){globalThis.__exports.push({format:'xlsx',options:structuredClone(options)});}export async function exportToPDF(options){globalThis.__exports.push({format:'pdf',options:structuredClone(options)});}`,
        }));
        b.onResolve(
          { filter: /^@\/components\/teacher\/AssessmentIntelligenceConsole$/ },
          () => ({ path: "console", namespace: "framework" }),
        );
        b.onResolve({ filter: /^@\// }, (args) => ({
          path: (() => {
            const base = path.resolve(args.path.replace(/^@\//, ""));
            return fs.existsSync(base + ".tsx") ? base + ".tsx" : base + ".ts";
          })(),
        }));
        b.onLoad({ filter: /\.module\.css$/ }, () => ({
          loader: "js",
          contents:
            "export default new Proxy({}, {get: (_, key) => String(key)});",
        }));
      },
    },
  ],
});
const { default: Workbook } = await import(pathToFileURL(output));
const Component = Workbook.default ?? Workbook;
const root = createRoot(document.getElementById("root"));
await act(async () => {
  root.render(React.createElement(Component));
});
assert.match(document.body.textContent, /Grade 6 Yellow/);
assert.match(document.body.textContent, /Charles Mwangi/);
async function click(element) {
  await act(async () => {
    fireEvent.click(element);
  });
}
async function fill(element, value) {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
}
await click(screen.getByRole("button", { name: "Attendance", exact: true }));
assert.equal(
  screen.getByLabelText("Attendance for Charles Mwangi").value,
  "",
  "missing attendance must stay unrecorded",
);
await click(screen.getByRole("button", { name: "Exams", exact: true }));
assert.equal(screen.getByLabelText("Exam mark for Charles Mwangi").value, "");
await fill(screen.getByLabelText("Exam mark for Charles Mwangi"), "0");
await act(async () => {
  fireEvent.focusOut(screen.getByLabelText("Exam mark for Charles Mwangi"));
});
await click(
  screen.getByRole("button", { name: "Save exam marks (1)", exact: true }),
);
assert.equal(globalThis.__fixture.results[0].marks, 0, "a real zero is saved");
await click(screen.getByRole("button", { name: "+ Add sheet", exact: true }));
await click(screen.getByRole("button", { name: /Reading tracker/ }));
const details = screen
  .getByText("Columns, saved views and my sheet settings")
  .closest("details");
details.open = true;
await fill(screen.getByLabelText("Column / view name"), "Oral score");
await fill(screen.getByLabelText("Column type"), "number");
await click(
  screen.getByRole("button", { name: "Add custom column", exact: true }),
);
const score = screen.getByLabelText("Oral score for Charles Mwangi");
await fill(score, "75");
await act(async () => {
  fireEvent.focusOut(score);
});
assert.equal(
  screen.getByRole("button", { name: "Save my sheets", exact: true }).disabled,
  false,
);
globalThis.__conflict = true;
await click(
  screen.getByRole("button", { name: "Save my sheets", exact: true }),
);
assert.match(screen.getByRole("alert").textContent, /Another window saved/);
assert.equal(
  screen.getByLabelText("Oral score for Charles Mwangi").value,
  "75",
  "save conflict must retain draft",
);
globalThis.__conflict = false;
await click(
  screen.getByRole("button", { name: "Save my sheets", exact: true }),
);
assert.equal(
  globalThis.__saved.cells[globalThis.__saved.sheets.at(-1).id][
    fixture.learners[0].id
  ][globalThis.__saved.sheets.at(-1).columns.at(-1).id],
  75,
);
for (const [button, format] of [
  ["Excel", "xlsx"],
  ["CSV", "csv"],
  ["PDF", "pdf"],
]) {
  await click(screen.getByRole("button", { name: button, exact: true }));
  await waitFor(() =>
    assert.ok(globalThis.__exports.some((entry) => entry.format === format)),
  );
}
const exported = globalThis.__exports.at(-1).options;
assert.equal(exported.reportTitle, "Grade 6 Yellow - Reading tracker");
assert.deepEqual(
  globalThis.__exports.map((entry) => entry.options.rows.length),
  [2, 2, 2],
  "all export formats must use the same visible learner set",
);
assert.ok(
  globalThis.__exports.every((entry) =>
    entry.options.rows.some((row) => row.includes(75)),
  ),
  "exports must include the current unsaved custom-sheet draft",
);
await click(screen.getByRole("button", { name: "Print", exact: true }));
assert.equal(globalThis.__printed, 1, "Print must invoke the browser print flow");
await fill(
  screen.getByLabelText("Find learners or ask a class question"),
  "Mary",
);
assert.equal(
  screen.queryByRole("link", { name: "Charles Mwangi", exact: true }),
  null,
);
assert.ok(screen.getByRole("link", { name: "Mary Wanjiku", exact: true }));
await act(async () => root.unmount());
fs.unlinkSync(output);
console.log(
  "Workbook DOM: complete grid renders, unrecorded attendance, zero-mark save, template/column editing, Excel/CSV/PDF export parity, print, search and conflict recovery passed.",
);
