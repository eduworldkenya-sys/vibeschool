/** Actual four pages/context/adapters against a synthetic network boundary. No live writes. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const modules =
  process.env.WORKBOOK_UI_MODULES || "/tmp/workbook-ui/node_modules";
const { JSDOM } = await import(pathToFileURL(`${modules}/jsdom/lib/api.js`)),
  { build } = await import(pathToFileURL(`${modules}/esbuild/lib/main.js`));
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
  url: "https://fixture.test/teacher/assessment/marking",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
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
window.confirm = () => true;
const React = await import("react"),
  { createRoot } = await import("react-dom/client"),
  { fireEvent, screen, waitFor } = await import(
    pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`)
  ),
  { act } = React,
  require = createRequire(import.meta.url);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "assessment-ui-"));
fs.symlinkSync(
  path.resolve("node_modules"),
  path.join(dir, "node_modules"),
  "dir",
);
const context = {
  teacher_id: "teacher",
  school_id: "school",
  schools: [{ id: "school", name: "Fixture School" }],
  classes: [
    {
      class_id: "class",
      class_name: "Grade 6",
      subject_id: "math",
      subject_name: "Mathematics",
    },
    {
      class_id: "other-class",
      class_name: "Grade 7",
      subject_id: "math",
      subject_name: "Mathematics",
    },
  ],
};
const assignment = {
  id: "assignment",
  assessment_id: "assessment",
  class_id: "class",
  school_id: "school",
  teacher_id: "teacher",
  assigned_at: "2026-10-09T06:00:00Z",
  closes_at: "2026-10-10T06:00:00Z",
  status: "open",
  assessment_definitions: {
    title: "Fractions CAT",
    assessment_type: "cat",
    subject_id: "math",
  },
};
const response = (id, order) => ({
  response_id: id,
  assessment_item_id: "question-" + order,
  order_num: order,
  prompt: "Explain fraction " + order,
  question_type: "short_answer",
  response_text: "A learner response",
  auto_score: null,
  final_score: null,
  teacher_feedback: null,
  max_score: 5,
  status: "teacher_review",
  marking_guide: { criteria: ["Clear explanation", "Correct fraction"] },
  correct_answer: "One half",
});
let attempt = {
  attempt_id: "attempt",
  assessment_title: "Fractions CAT",
  student_name: "Charles",
  attempt_status: "teacher_review",
  result_status: "partially_marked",
  score: null,
  max_score: 10,
  feedback: null,
  responses: [response("r1", 1), response("r2", 2)],
};
let rows = [
  {
    id: "support",
    teacher_id: "teacher",
    school_id: "school",
    class_id: "class",
    subject_id: "math",
    student_id: "student",
    outcome_id: "outcome",
    status: "in_progress",
    priority: "high",
    recommendation: "Use worked examples",
    recommendation_type: "guided_practice",
    mastery_score: 30,
    evidence_count: 3,
    confidence_score: 99,
    repeated_weakness_count: 2,
    evidence_snapshot: { evidence_sources: ["assessment"] },
    students: { name: "Charles", admission_number: "1024" },
    curriculum_learning_outcomes: {
      outcome_code: "M1",
      outcome_text: "Apply fractions",
    },
    due_at: "2026-10-20",
    updated_at: "2026-10-09",
  },
];
let calls = [],
  failure = "",
  empty = false,
  delay = null,
  ignoreNote = false;
let pendingRequests=[],releaseStatusOverride=null,malformed='';
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
  async then(resolve, reject) {
    let data =
      this.table === "assessment_assignments"
        ? empty
          ? []
          : [
              assignment,
              {
                ...assignment,
                id: "assignment-2",
                assessment_id: "assessment-2",
                class_id: "other-class",
              },
            ]
        : this.table === "academic_terms"
          ? []
          : this.table === "assessment_attempts"
            ? detail.learners
                .filter((l) => l.attempt_id)
                .map((l) => ({
                  id: l.attempt_id,
                  assignment_id: "assignment",
                  student_id: l.student_id,
                  status: l.attempt_status,
                  result_status: l.student_id==='student'&&releaseStatusOverride?releaseStatusOverride:l.attempt_status,
                  score: l.score,
                  max_score: l.max_score,
                  submitted_at: l.submitted_at,
                }))
            : this.table === "assessment_moderation_requests"?pendingRequests:this.table === "assessment_items"
              ? [
                  {
                    id: "question-1",
                    assessment_id: "assessment",
                    order_num: 1,
                    prompt: "Explain a fraction",
                    assessment_item_outcomes: [{ outcome_id: "outcome" }],
                  },
                ]
              : rows;
    data = data
      .filter((r) =>
        this.filters.every(([key, value]) =>
          Array.isArray(value) ? value.includes(r[key]) : r[key] === value,
        ),
      )
      .slice(...[this.bounds[0], this.bounds[1] + 1]);
    return Promise.resolve({
      data: structuredClone(data),
      error:
        failure === this.table
          ? { message: "Permission denied for " + this.table }
          : null,
    }).then(resolve, reject);
  }
}
const detail = {
  assignment_id: "assignment",
  assessment_id: "assessment",
  title: "Fractions CAT",
  class_name: "Grade 6",
  eligible_learners: 3,
  submitted_count: 2,
  learners: [
    {
      student_id: "student",
      student_name: "Charles",
      admission_number: "1024",
      attempt_id: "attempt",
      attempt_status: "released",
      score: 0,
      max_score: 10,
      percentage: 0,
      submitted_at: "2026-10-09",
    },
    {
      student_id: "second",
      student_name: "Mary",
      attempt_id: "private",
      attempt_status: "marked",
      score: 10,
      max_score: 10,
      percentage: 100,
      submitted_at: "2026-10-09",
    },
    {
      student_id: "third",
      student_name: "Peter",
      attempt_id: null,
      attempt_status: null,
      score: null,
      max_score: null,
      percentage: null,
      submitted_at: null,
    },
  ],
  questions: [],
};
const intelligence = {
  difficulty:[],bloom:[],
  assignment_id: "assignment",
  questions: [
    {
      assessment_item_id: "question-1",
      order_num: 1,
      prompt: "Explain a fraction",
      response_count: 1,
      average_percentage: 0,
      zero_score_count: 1,
      full_score_count: 0,
    },
  ],
  outcomes: [
    {
      outcome_id: "outcome",
      outcome_text: "Apply fractions",
      response_count: 1,
      average_percentage: 0,
      learners_below_50: 1,
      mastery_band: "beginning",
    },
  ],
  misconceptions: [],
};
const curriculum = {
  assignment_id: "assignment",
  outcomes: [
    {
      outcome_id: "outcome",
      outcome_code: "M1",
      outcome_text: "Apply fractions",
      response_count: 1,
      average_percentage: 0,
      learners_below_50: 1,
      mastery_band: "beginning",
    },
    {
      outcome_id: "unassessed",
      outcome_text: "Compare fractions",
      response_count: 0,
      average_percentage: null,
      mastery_band: "not_assessed",
    },
  ],
  interventions: [],
};
const client = {
  auth: {
    getUser: async () => ({ data: { user: { id: "teacher" } }, error: null }),
  },
  from: (table) => new Query(table),
  rpc: async (name, args = {}) => {
    calls.push({ name, args });
    if (delay?.name === name&&(!delay.assignmentId||delay.assignmentId===args.p_assignment_id)) await delay.promise;
    if(malformed===name)return {data:{},error:null};
    if (failure === name)
      return {
        data: null,
        error: { message: "Permission denied for " + name },
      };
    let data;
    switch (name) {
      case "teacher_get_operating_context":
        data = context;
        break;
      case 'exq_list_teacher_assessment_analytics':data={assessments:[{assignment_id:'assignment',assessment_id:'assessment',title:'Fractions CAT',class_id:'class',eligible_learners:3,submitted_count:2,review_pending_count:2}]};break;
      case "exq_list_marking_queue":
        data = {
          attempts: empty
            ? []
            : [
                {
                  ...attempt,
                  assignment_id: "assignment",
                  student_id: "student",
                  marked_items: attempt.responses.filter(
                    (r) => r.final_score !== null,
                  ).length,
                  total_items: 2,
                  unresolved_items: attempt.responses.filter(
                    (r) => r.final_score === null,
                  ).length,
                },
              ],
        };
        break;
      case "exq_get_marking_attempt":
        data = attempt;
        break;
      case "exq_mark_response": {
        const r = attempt.responses.find(
          (r) => r.response_id === args.p_response_id,
        );
        r.final_score = args.p_teacher_score;
        r.teacher_feedback = args.p_teacher_feedback;
        data = { ok: true };
        break;
      }
      case "exq_finalize_attempt":
        attempt.attempt_status = args.p_release ? "released" : "marked";
        attempt.result_status = attempt.attempt_status;
        attempt.feedback = args.p_feedback;
        data = { ok: true };
        break;
      case "exq_propagate_released_attempt":
        data = { ok: true };
        break;
      case "exq_get_score_audit":
        data = { events: [] };
        break;
      case "exq_request_moderation":
        pendingRequests.push({id:'review',attempt_id:'attempt',response_id:args.p_response_id,status:'pending'});
        data = { request_id: "review" };
        break;
      case "exq_get_assignment_analytics":
        data = detail;
        break;
      case "exq_get_assignment_intelligence":
        data = {...intelligence,assignment_id:args.p_assignment_id};
        break;
      case "exq_get_curriculum_intelligence":
        data = {...curriculum,assignment_id:args.p_assignment_id,outcomes:args.p_assignment_id==='assignment-2'?curriculum.outcomes.map(o=>({...o,outcome_text:'Apply ratios'})):curriculum.outcomes};
        break;
      case "exq_update_intervention": {
        const row = rows.find((r) => r.id === args.p_intervention_id);
        row.status = args.p_status;
        if (!ignoreNote) row.completion_note = args.p_completion_note;
        data = { ok: true };
        break;
      }
      case 'exq_refresh_intervention_queue':data={rows_refreshed:rows.length};break;
      case "exq_create_intervention_assessment":
        data = { assessment_id: "practice" };
        break;
      case "exq_evaluate_intervention":
        data = {
          status: "completed",
          baseline_mastery_score: 30,
          followup_mastery_score: 80,
          mastery_change: 50,
          recommendation: "Sufficient follow-up evidence",
        };
        rows[0].status = "completed";
        break;
      default:
        throw new Error("Unexpected RPC " + name);
    }
    return { data: structuredClone(data), error: null };
  },
};
Object.assign(globalThis, {
  __assessmentClient: client,
  __search: new URLSearchParams(),
  __routes: [],
});
async function page(route) {
  const file = path.join(dir, route + ".cjs");
  await build({
    entryPoints: [`app/teacher/assessment/${route}/page.tsx`],
    outfile: file,
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react", "react-dom", "react/jsx-runtime"],
    loader: { ".css": "local-css" },
    plugins: [
      {
        name: "network-boundary",
        setup(builder) {
          builder.onResolve(
            { filter: /^(next\/navigation|next\/link|@\/lib\/supabase)$/ },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            loader: "js",
            contents:
              args.path === "next/navigation"
                ? `export const useSearchParams=()=>globalThis.__search;export const useRouter=()=>({push:url=>globalThis.__routes.push(url)});`
                : args.path === "next/link"
                  ? `import React from 'react';export default function Link(props){return React.createElement('a',props)}`
                  : `export const supabase=globalThis.__assessmentClient;`,
          }));
        },
      },
    ],
  });
  return require(file).default;
}
const pages = Object.fromEntries(
  await Promise.all(
    ["marking", "analytics", "curriculum", "interventions"].map(
      async (route) => [route, await page(route)],
    ),
  ),
);
let root;
async function mount(route, query = "assignmentId=assignment") {
  if (root) await act(async () => root.unmount());
  document.getElementById("root").innerHTML = "";
  localStorage.clear();
  globalThis.__search = new URLSearchParams(query);
  root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(pages[route])));
}
const click = async (name) =>
    act(async () => fireEvent.click(screen.getByRole("button", { name }))),
  change = async (label, value) =>
    act(async () =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } }),
    );
try {
  await mount("marking");
  await waitFor(() =>
    assert(screen.getByRole("button", { name: "Open work" })),
  );
  await click("Open work");
  assert(!screen.queryByLabelText('Mark for question 2'),'single-question view keeps the editor focused');await change('Mark for question 1','1.5');await click('Next question');assert(screen.getByLabelText('Mark for question 2'));await change('Question','0');assert.equal(screen.getByLabelText('Mark for question 1').value,'1.5');await change('Mark for question 1','');
  await change("Answer view", "all");
  await waitFor(() => assert(screen.getByLabelText("Mark for question 1")));
  await click("Share result");
  assert.match(screen.getByRole("alert").textContent, /Enter a mark/);
  assert.equal(
    calls.filter((c) => c.name === "exq_mark_response").length,
    0,
    "blank marks must not write zero",
  );
  await change("Mark for question 1", "2.5");
  await click("Finish marking");
  assert.equal(
    calls.filter((c) => c.name === "exq_mark_response").length,
    0,
    "all validation must finish before the first write",
  );
  await change("Mark for question 2", "4");
  await change("Overall feedback", "Keep explaining your reasoning");
  await click("Save question 1");
  assert.equal(screen.getByLabelText("Mark for question 2").value, "4");
  assert.equal(
    screen.getByLabelText("Overall feedback").value,
    "Keep explaining your reasoning",
  );
  assert.equal(attempt.responses[0].final_score, 2.5);
  await click("Finish marking");
  assert.equal(attempt.attempt_status, "marked");
  assert(
    !calls.some((c) => c.name === "exq_propagate_released_attempt"),
    "finish must leave results private",
  );
  await change('Review reason for question 1','Please check the marking criteria');await click('Request review for question 1');assert(screen.getByLabelText('Mark for question 1').disabled);await click('Share result');assert.match(screen.getByRole('alert').textContent,/pending mark review/);assert.equal(attempt.attempt_status,'marked');pendingRequests=[];await click('Back to queue');await click('Ready to share (1)');await click('Open work');
  await click("Share result");
  assert.equal(attempt.attempt_status, "released");
  assert(calls.some((c) => c.name === "exq_propagate_released_attempt"));
  assert(screen.getByLabelText("Mark for question 1").disabled);
  assert(screen.getByLabelText("Overall feedback").disabled);
  assert(
    document.body.textContent.includes("Clear explanation"),
    "real marking guide is rendered",
  );
  await mount("analytics");
  await waitFor(() => assert(screen.getByText("0.0%")));
  assert(
    !screen.queryByText("10 / 10"),
    "private marks cannot appear in shared-only scope",
  );
  assert(screen.getByText("0 / 10"), "zero is a scored result");
  await change("Results included", "teacher");
  assert(screen.getByText("50.0%"));
  assert(screen.getByText("10 / 10"));
  await change("Work status", "missing");
  assert(screen.getByText("Peter"));
  assert(
    !screen.queryByText("Charles"),
    "status filter must constrain the roster",
  );
  await mount("curriculum", "");
  await waitFor(() => assert(screen.getByText("Choose an assessment")));
  await change("Assessment", "assignment");
  await waitFor(() => assert(screen.getByText("Outcome evidence")));
  assert(screen.getByText("Not assessed"));
  assert(
    document.body.textContent.includes("Teaching coverage: not available"),
  );
  assert(!document.body.textContent.includes("No learner is currently below"));
  failure = "exq_get_curriculum_intelligence";
  await mount("curriculum");
  await waitFor(() => assert(screen.getByRole("alert")));
  assert(!screen.queryByText("Outcome evidence"));
  failure = "";
  await click("Retry");
  await waitFor(() => assert(screen.getByText("Outcome evidence")));
  await mount("interventions", "classId=class&subjectId=math");
  await waitFor(() =>
    assert(screen.getByRole("button", { name: "Review Charles" })),
  );
  await click("Review Charles");
  assert(
    !screen.queryByRole("button", { name: "Start support" }),
    "in-progress plans must not offer Start",
  );
  assert(
    !document.body.textContent.includes("99%"),
    "formula is not measured confidence",
  );
  await click("Dismiss with reason");
  assert.match(screen.getByRole("alert").textContent, /Give a reason/);
  assert(!calls.some((c) => c.name === "exq_update_intervention"));
  await change("Plan note or reason", "Duplicate plan; keep evidence");
  ignoreNote = true;
  await click("Dismiss with reason");
  assert.match(
    screen.getByRole("alert").textContent,
    /not saved as requested/,
    "read-back detects the old ignored-note server defect",
  );
  ignoreNote = false;

  rows[0].status = "in_progress";
  await click("Retry");
  await waitFor(() =>
    assert(screen.getByRole("button", { name: "Review Charles" })),
  );
  await click("Review Charles");
  await change("Plan note or reason", "Small-group worked examples");
  await click("Save plan");
  assert.equal(rows[0].completion_note, "Small-group worked examples");
  rows[0].priority = "extension";rows[0].recommendation_type='extension_challenge';
  await mount("interventions", "classId=class");
  await waitFor(() =>
    assert(screen.getByRole("button", { name: "Review Charles" })),
  );
  await click("Review Charles");
  assert(screen.getByRole("button", { name: "Create extension practice" }));
  assert(!screen.queryByText("Create remedial assessment"));
  failure = "assessment_interventions";
  await mount("interventions", "classId=class");
  await waitFor(() => assert(screen.getByRole("alert")));
  assert(!screen.queryByText("No support records match"));
  failure = "";
  await click("Retry");
  await waitFor(() =>
    assert(screen.getByRole("button", { name: "Review Charles" })),
  );
  assert(!calls.some(c=>c.name==='exq_refresh_intervention_queue'),'opening support must never refresh evidence');await click('Refresh from evidence');assert.equal(calls.filter(c=>c.name==='exq_refresh_intervention_queue').length,1);
  releaseStatusOverride='marked';await mount('analytics');await waitFor(()=>assert(screen.getByText('Release not confirmed')));assert(!screen.queryByText('0 / 10'),'inconsistent release states must not disclose a learner score');releaseStatusOverride=null;
  malformed='exq_get_curriculum_intelligence';await mount('curriculum');await waitFor(()=>assert(screen.getByRole('alert').textContent.includes('incomplete payload')));assert(!screen.queryByText('No outcomes are linked'));malformed='';
  let resume;delay={name:'exq_get_curriculum_intelligence',assignmentId:'assignment',promise:new Promise(resolve=>{resume=resolve})};await mount('curriculum');globalThis.__search=new URLSearchParams('assignmentId=assignment-2');await act(async()=>root.render(React.createElement(pages.curriculum)));await waitFor(()=>assert(screen.getAllByText('Apply ratios').length));await act(async()=>{resume();await Promise.resolve()});assert(!screen.queryByText('M1 · Apply fractions'),'stale outcome requests must not replace a new assessment');delay=null;
  empty = true;
  await mount("analytics");
  await waitFor(() =>
    assert(
      document.body.textContent.includes("That selection is not available"),
    ),
  );
  assert(
    !calls.slice(-2).some((c) => c.name === "exq_get_assignment_analytics"),
  );
  assert(
    screen.getByText(
      "No assessments match your selections. Try another class or term.",
    ),
  );
  console.log(
    "Assessment workspace DOM: PASS — all four actual pages/adapters, blank/partial/zero marks, validate-before-write, draft preservation, private finalize vs release/lock, source rubric, release-safe analysis, missing roster filters, direct-entry outcomes, explicit errors/retry, lifecycle actions, dismissal reason and ignored-note read-back. Synthetic boundary only.",
  );
} finally {
  if (root) await act(async () => root.unmount());
  fs.rmSync(dir, { recursive: true, force: true });
}

// Optional real-browser verification uses the same component source and synthetic boundary.
// CI runs this mode with a pinned browser/axe runtime; no network to the connected project.
if (process.argv.includes("--browser")) {
  const browserDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "assessment-browser-"),
  );
  const source = fs.readFileSync(new URL(import.meta.url), "utf8");
  const fixture = source.slice(
    source.indexOf("const context ="),
    source.indexOf("async function page("),
  );
  const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
  import Marking from '${path.resolve("app/teacher/assessment/marking/page.tsx")}';
  import Results from '${path.resolve("app/teacher/assessment/analytics/page.tsx")}';
  import Outcomes from '${path.resolve("app/teacher/assessment/curriculum/page.tsx")}';
  import Support from '${path.resolve("app/teacher/assessment/interventions/page.tsx")}';
  const query=new URLSearchParams(location.search);globalThis.__search=new URLSearchParams('assignmentId=assignment&classId=class&subjectId=math');
  const route=query.get('page')||'marking',state=query.get('state')||'populated';
  globalThis.__setFixtureState(state,route);
  createRoot(document.getElementById('root')).render(React.createElement({marking:Marking,analytics:Results,curriculum:Outcomes,interventions:Support}[route]));`;
  await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: "jsx" },
    outfile: path.join(browserDir, "app.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    loader: { ".css": "local-css" },
    plugins: [
      {
        name: "browser-network-boundary",
        setup(builder) {
          builder.onResolve(
            { filter: /^(next\/navigation|next\/link|@\/lib\/supabase)$/ },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            loader: "js",
            resolveDir: process.cwd(),
            contents:
              args.path === "next/navigation"
                ? `export const useSearchParams=()=>globalThis.__search;export const useRouter=()=>({push:url=>globalThis.__routes.push(url)});`
                : args.path === "next/link"
                  ? `import React from 'react';export default function Link(props){return React.createElement('a',props)}`
                  : `export const supabase=globalThis.__assessmentClient;`,
          }));
        },
      },
    ],
  });
  fs.writeFileSync(
    path.join(browserDir, "fixture.js"),
    fixture +
      `\nglobalThis.__setFixtureState=(state,route)=>{if(state==='empty'){empty=true;rows=[]}if(state==='error')failure=route==='interventions'?'assessment_interventions':route==='curriculum'?'exq_get_curriculum_intelligence':route==='analytics'?'exq_get_assignment_analytics':'exq_list_marking_queue';};`,
  );
  fs.writeFileSync(
    path.join(browserDir, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Assessment workspace · Synthetic verification</title><link rel="stylesheet" href="/app.css"><style>*{box-sizing:border-box}body{margin:0;background:#f5f6f2;font-family:Arial,sans-serif}.fixture{padding:8px 16px;background:#e8eee7;color:#24352b;font-size:12px}</style></head><body><aside class="fixture">Synthetic test data · Actual assessment components · No connected database writes</aside><main id="root"></main><script src="/fixture.js"></script><script src="/app.js"></script></body></html>`,
  );
  const { createServer } = await import("node:http"),
    { chromium } = await import(
      pathToFileURL(`${modules}/playwright/index.mjs`)
    );
  const server = createServer((request, response) => {
    const name = new URL(request.url, "http://localhost").pathname;
    const file = path.join(
      browserDir,
      name === "/" ? "index.html" : path.basename(name),
    );
    if (!fs.existsSync(file)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.setHeader(
      "Content-Type",
      name.endsWith(".js")
        ? "text/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : "text/html",
    );
    response.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const output =
    process.env.ASSESSMENT_ARTIFACTS ||
    path.join(os.tmpdir(), "assessment-workspace-artifacts");
  fs.mkdirSync(output, { recursive: true });
  const outcomes = [];
  try {
    for (const width of [320, 390, 768, 1440])
      for (const route of [
        "marking",
        "analytics",
        "curriculum",
        "interventions",
      ])
        for (const state of ["populated", "empty", "error"]) {
          const page = await browser.newPage({
              viewport: { width, height: 900 },
            }),
            errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route("**/*", (routeCall) => {
            const target = new URL(routeCall.request().url());
            return target.hostname === "127.0.0.1"
              ? routeCall.continue()
              : routeCall.abort();
          });
          await page.goto(`${url}/?page=${route}&state=${state}`);
          await page
            .getByRole("heading", { level: 1 })
            .waitFor({ timeout: 5000 })
            .catch((error) => {
              throw new Error(
                error.message + "; page errors: " + JSON.stringify(errors),
              );
            });
          if (state === "error") await page.getByRole("alert").waitFor();
          else if (state === "empty")
            await page
              .getByText(
                /No assessments match|No submitted work|No support records match/,
              )
              .first()
              .waitFor();
          else if (route === "marking")
            await page.getByRole("button", { name: "Open work" }).click();
          else if (route === "interventions")
            await page.getByRole("button", { name: "Review Charles" }).click();
          else
            await page
              .getByRole("heading", {
                name:
                  route === "analytics"
                    ? "Learner results"
                    : "Outcome evidence",
                exact: true,
              })
              .waitFor();
          await page.addScriptTag({
            path: path.join(modules, "axe-core/axe.min.js"),
          });
          const accessibility = await page.evaluate(async () =>
            window.axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            }),
          );
          assert.deepEqual(
            accessibility.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
            [],
            `${route}/${state}/${width} accessibility`,
          );
          assert(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
            `${route}/${state}/${width} horizontal overflow`,
          );
          assert.deepEqual(
            errors,
            [],
            `${route}/${state}/${width} browser errors`,
          );
          await page.keyboard.press("Tab");
          assert(
            await page.evaluate(() => document.activeElement !== document.body),
            "keyboard focus enters controls",
          );
          if (state === "populated")
            await page.screenshot({
              path: path.join(output, `${route}-${width}.png`),
              fullPage: true,
            });
          outcomes.push({
            route,
            state,
            width,
            accessibilityViolations: 0,
            horizontalOverflow: false,
            errors,
          });
          await page.close();
        }
    fs.writeFileSync(
      path.join(output, "browser-results.json"),
      JSON.stringify(outcomes, null, 2) + "\n",
    );
    console.log(
      `Assessment browser: PASS — ${outcomes.length} route/state/viewport checks, zero selected-WCAG axe violations, no page errors or document overflow; screenshots in ${output}. Synthetic data only.`,
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(browserDir, { recursive: true, force: true });
  }
}
