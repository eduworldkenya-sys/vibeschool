/** Workbook cells extend teacher records; canonical academic facts stay in their domains. */
export type Cell = string | number | boolean | null;
export type Kind =
  | "roster"
  | "attendance"
  | "assessments"
  | "exams"
  | "homework"
  | "progress"
  | "groups"
  | "parents"
  | "interventions"
  | "custom";
export type Column = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "check" | "formula";
  operation?: "sum" | "average" | "difference";
  sources?: string[];
};
export type Sheet = {
  id: string;
  title: string;
  kind: Kind;
  columns: Column[];
};
export type View = {
  id: string;
  title: string;
  sheetId: string;
  query: string;
  sort: string;
  descending: boolean;
  hidden: string[];
  subjectId: string;
  start: string;
  end: string;
  groupId: string;
  examId: string;
  compareExamId: string;
};
export type Document = {
  version: 1;
  sheets: Sheet[];
  cells: Record<string, Record<string, Record<string, Cell>>>;
  views: View[];
};
export type Learner = {
  id: string;
  name: string;
  admission_number: string | null;
  profile_id: string | null;
  joined_at?: string;
};
export type Attendance = {
  student_id: string;
  date: string;
  status: string;
  is_late: boolean | null;
  timetable_slot_id: string | null;
};
export type Homework = {
  id: string;
  title: string;
  due_date: string | null;
  subject: string | null;
  type: string | null;
  target_group_id: string | null;
};
export type Submission = {
  student_id: string | null;
  homework_id: string | null;
  status: string;
  mark: number | null;
  submitted_at: string | null;
  received_at: string | null;
};
export type Assessment = {
  student_id: string;
  assessment_id: string;
  subject_id: string | null;
  percentage: number | null;
  assessment_type: string;
  assessment_title: string;
  released_at: string | null;
};
export type Exam = {
  id: string;
  name: string;
  term: number;
  academic_year: number;
  exam_type: string;
  is_locked: boolean;
  pass_mark: number;
  created_at: string;
};
export type Result = {
  id: string;
  student_id: string;
  exam_id: string;
  subject_id: string;
  marks: number | null;
  is_absent: boolean;
  updated_at: string;
};
export type Evidence = {
  student_id: string;
  outcome_id: string;
  subject_id: string | null;
  observed_at: string;
  proficiency: string | null;
  score: number | null;
  max_score: number | null;
};
export type Group = { id: string; name: string; type: string };
export type Member = { student_id: string; group_id: string };
export type Intervention = {
  studentId: string;
  subjectId: string;
  outcomeText: string;
  status: string;
  recommendation: string;
  dueAt: string | null;
};
export type Data = {
  teacherId: string;
  isClassTeacher?: boolean;
  schoolId: string;
  classId: string;
  className: string;
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string; subjectIds: string[]; isClassTeacher?: boolean }[];
  terms: { id: string; name: string; start_date: string; end_date: string }[];
  learners: Learner[];
  attendance: Attendance[];
  homework: Homework[];
  submissions: Submission[];
  assessments: Assessment[];
  exams: Exam[];
  results: Result[];
  evidence: Evidence[];
  groups: Group[];
  members: Member[];
  interventions: Intervention[];
  outcomes: { id: string; outcome_text: string }[];
  parentLinks: {
    student_id: string;
    relationship: string;
    is_primary: boolean;
  }[];
  parentMessages: { student_id: string; created_at: string }[];
  warnings: string[];
};
export type Row = {
  learner: Learner;
  values: Record<string, Cell>;
  reasons: string[];
};
const col = (
  id: string,
  label: string,
  type: Column["type"] = "text",
): Column => ({ id, label, type });
export const templates: {
  kind: Kind;
  title: string;
  why: string;
  columns: Column[];
}[] = [
  {
    kind: "roster",
    title: "Class list",
    why: "Find learners, check admission numbers and open their profiles.",
    columns: [],
  },
  {
    kind: "attendance",
    title: "Attendance",
    why: "Review the daily register and spot repeated absence.",
    columns: [],
  },
  {
    kind: "assessments",
    title: "Assessments",
    why: "Review released quizzes, practicals, oral work and projects.",
    columns: [],
  },
  {
    kind: "exams",
    title: "Exams",
    why: "Enter marks and compare two exams in the same subject.",
    columns: [],
  },
  {
    kind: "homework",
    title: "Homework",
    why: "Find overdue work and follow submissions through marking.",
    columns: [],
  },
  {
    kind: "progress",
    title: "Progress & revision",
    why: "See recorded outcome evidence before planning revision.",
    columns: [],
  },
  {
    kind: "groups",
    title: "Groups",
    why: "See every group membership and organise group work.",
    columns: [],
  },
  {
    kind: "parents",
    title: "Parent follow-up",
    why: "Keep your own record of a conversation and the next follow-up.",
    columns: [
      col("reason", "Reason"),
      col("contacted", "Last contacted", "date"),
      col("outcome", "What was agreed"),
      col("next", "Follow-up date", "date"),
    ],
  },
  {
    kind: "interventions",
    title: "Support & interventions",
    why: "Connect recorded learning needs to an action and review date.",
    columns: [
      col("action", "My support plan"),
      col("review", "Review date", "date"),
    ],
  },
  {
    kind: "custom",
    title: "Participation",
    why: "Record observations privately during classroom activities.",
    columns: [col("observation", "Observation"), col("date", "Date", "date")],
  },
  {
    kind: "custom",
    title: "Projects & practicals",
    why: "Track project stages, materials and rubric evidence.",
    columns: [
      col("stage", "Stage"),
      col("materials", "Materials ready", "check"),
      col("rubric", "Rubric score", "number"),
      col("next", "Next step"),
    ],
  },
  {
    kind: "custom",
    title: "Resources",
    why: "Track borrowed books or equipment and their return.",
    columns: [
      col("item", "Item"),
      col("borrowed", "Borrowed on", "date"),
      col("returned", "Returned", "check"),
    ],
  },
  {
    kind: "custom",
    title: "Reading tracker",
    why: "Record reading observations and choose the next practice.",
    columns: [
      col("book", "Book"),
      col("observation", "Reading observation"),
      col("next", "Next practice"),
    ],
  },
  {
    kind: "custom",
    title: "Trip consent & required items",
    why: "Track consent and required items without collecting payments.",
    columns: [
      col("consent", "Consent received", "check"),
      col("items", "Items ready", "check"),
      col("note", "Follow-up note"),
    ],
  },
  {
    kind: "custom",
    title: "Blank sheet",
    why: "Add your own text, numbers, dates, checkboxes and calculations.",
    columns: [],
  },
];
export function emptyDocument(): Document {
  return {
    version: 1,
    sheets: templates
      .slice(0, 10)
      .map((t, i) => ({
        id: `sheet${i}`,
        title: t.title,
        kind: t.kind,
        columns: t.columns,
      })),
    cells: {},
    views: [],
  };
}
export function parseCell(raw: string, type: Column["type"]): Cell {
  if (type === "formula")
    throw new Error("Calculated columns cannot be edited.");
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 2000)
    throw new Error("Keep a cell under 2,000 characters.");
  if (type === "number") {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))
      throw new Error("Enter a valid number.");
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error("Enter a finite number.");
    return n;
  }
  if (type === "check") {
    if (/^(yes|true|1)$/i.test(value)) return true;
    if (/^(no|false|0)$/i.test(value)) return false;
    throw new Error("Use Yes or No.");
  }
  if (type === "date") {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value
    )
      throw new Error("Use a real date: YYYY-MM-DD.");
  }
  return value;
}
export function calculate(column: Column, values: Record<string, Cell>): Cell {
  const inputs = (column.sources ?? []).map((id) => values[id]);
  // A missing input is not zero; calculated values cannot imply complete evidence.
  if (
    !inputs.length ||
    inputs.some((v) => typeof v !== "number" || !Number.isFinite(v))
  )
    return null;
  const numbers = inputs as number[];
  const answer =
    column.operation === "difference"
      ? numbers.length === 2
        ? numbers[0] - numbers[1]
        : NaN
      : numbers.reduce((a, b) => a + b, 0) /
        (column.operation === "average" ? numbers.length : 1);
  return Number.isFinite(answer) ? Math.round(answer * 100) / 100 : null;
}
export function validateDocument(input: unknown): Document {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("The saved workbook is invalid.");
  const d = input as Document;
  if (
    d.version !== 1 ||
    !Array.isArray(d.sheets) ||
    d.sheets.length > 30 ||
    !Array.isArray(d.views) ||
    d.views.length > 40 ||
    !d.cells ||
    typeof d.cells !== "object" ||
    Array.isArray(d.cells)
  )
    throw new Error("The saved workbook is invalid.");
  const identifiers = new Set<string>();
  for (const sheet of d.sheets) {
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(sheet.id) ||
      identifiers.has(sheet.id) ||
      !templates.some((t) => t.kind === sheet.kind) ||
      typeof sheet.title !== "string" ||
      !sheet.title.trim() ||
      sheet.title.length > 80 ||
      !Array.isArray(sheet.columns) ||
      sheet.columns.length > 40
    )
      throw new Error("Invalid sheet definition.");
    identifiers.add(sheet.id);
    const columns = new Set<string>();
    for (const c of sheet.columns) {
      if (
        !/^[a-zA-Z0-9_-]{1,80}$/.test(c.id) ||
        columns.has(c.id) ||
        !["text", "number", "date", "check", "formula"].includes(c.type) ||
        typeof c.label !== "string" ||
        !c.label.trim() ||
        c.label.length > 80
      )
        throw new Error("Invalid column definition.");
      columns.add(c.id);
    }
    for (const c of sheet.columns.filter((c) => c.type === "formula")) {
      if (
        !["sum", "average", "difference"].includes(c.operation ?? "") ||
        !Array.isArray(c.sources) ||
        !c.sources.length ||
        c.sources.length > 40 ||
        c.sources.some(
          (id) => sheet.columns.find((x) => x.id === id)?.type !== "number",
        ) ||
        (c.operation === "difference" && c.sources.length !== 2)
      )
        throw new Error("Choose numeric input columns for the calculation.");
    }
  }
  for (const [sheetId, rows] of Object.entries(d.cells)) {
    const sheet = d.sheets.find((s) => s.id === sheetId);
    if (!sheet || !rows || typeof rows !== "object" || Array.isArray(rows))
      throw new Error("Invalid saved sheet cells.");
    for (const cells of Object.values(rows)) {
      if (!cells || typeof cells !== "object" || Array.isArray(cells))
        throw new Error("Invalid saved row.");
      for (const [id, value] of Object.entries(cells)) {
        const c = sheet.columns.find((c) => c.id === id);
        if (
          !c ||
          c.type === "formula" ||
          (value !== null &&
            (typeof value === "object" ||
              !["string", "number", "boolean"].includes(typeof value)))
        )
          throw new Error("Invalid saved cell.");
        if (value !== null) {
          const parsed = parseCell(String(value), c.type);
          if (typeof parsed !== typeof value || parsed !== value)
            throw new Error("Saved cell type does not match its column.");
        }
      }
    }
  }
  const viewIds = new Set<string>();
  for (const v of d.views) {
    if (
      !v ||
      typeof v.id !== "string" ||
      viewIds.has(v.id) ||
      !identifiers.has(v.sheetId) ||
      typeof v.title !== "string" ||
      !v.title.trim() ||
      v.title.length > 80 ||
      !Array.isArray(v.hidden) ||
      v.hidden.some((id) => typeof id !== "string") ||
      typeof v.descending !== "boolean" ||
      [
        "query",
        "sort",
        "subjectId",
        "start",
        "end",
        "groupId",
        "examId",
        "compareExamId",
      ].some((key) => typeof v[key as keyof View] !== "string")
    )
      throw new Error("Invalid saved view.");
    viewIds.add(v.id);
  }
  return d;
}
export function display(value: Cell | undefined): string {
  return value === null || value === undefined
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
}
export function safeExport(value: Cell | undefined): string | number | null {
  return typeof value === "number"
    ? value
    : value == null
      ? null
      : /^[\s]*[=+\-@]/.test(String(value))
        ? "'" + String(value)
        : display(value);
}
export function compareValues(
  a: Cell | undefined,
  b: Cell | undefined,
  descending = false,
): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  const n =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : display(a).localeCompare(display(b), undefined, { numeric: true });
  return descending ? -n : n;
}
export type Filters = {
  subjectId: string;
  start: string;
  end: string;
  groupId: string;
  examId: string;
  compareExamId: string;
};
export function project(
  data: Data,
  sheet: Sheet,
  doc: Document,
  filters: Filters,
  today: string,
): { columns: Column[]; rows: Row[] } {
  const during = (value: string | null) =>
    Boolean(value) &&
    (!filters.start || value!.slice(0, 10) >= filters.start) &&
    (!filters.end || value!.slice(0, 10) <= filters.end);
  const subject = (id: string | null) =>
    !filters.subjectId || id === filters.subjectId;
  const attendance = data.attendance.filter(
    (a) => during(a.date) && a.timetable_slot_id === null,
  ); // Daily register is distinct from lesson attendance.
  const assessments = data.assessments.filter(
    (a) => subject(a.subject_id) && during(a.released_at),
  );
  const homework = data.homework.filter(
    (h) =>
      ((!filters.start && !filters.end) || during(h.due_date)) &&
      (!filters.subjectId ||
        h.subject ===
          data.subjects.find((s) => s.id === filters.subjectId)?.name),
  );
  const exams = data.exams.filter(
    (e) => (!filters.start && !filters.end) || during(e.created_at),
  );
  const cols: Column[] = [
    col("name", "Learner"),
    col("admission", "Admission no."),
  ];
  if (sheet.kind === "roster")
    cols.push(col("account", "Learner account"), col("groups", "Groups"));
  if (sheet.kind === "attendance")
    cols.push(
      col("attendance", "Present %", "number"),
      col("absent", "Days absent", "number"),
      col("late", "Days late", "number"),
      col("records", "Days recorded", "number"),
    );
  if (sheet.kind === "assessments")
    cols.push(
      col("average", "Released average %", "number"),
      ...Array.from(
        new Map(
          assessments.map((a) => [
            a.assessment_id,
            col(`assessment_${a.assessment_id}`, a.assessment_title, "number"),
          ]),
        ).values(),
      ),
    );
  if (sheet.kind === "exams")
    cols.push(
      ...exams.map((e) => col(`exam_${e.id}`, e.name, "number")),
      col("average", "Selected exam mark %", "number"),
      col("examChange", "Change (percentage points)", "number"),
      col("rank", "Position in selected subject", "number"),
    );
  if (sheet.kind === "homework")
    cols.push(
      col("missing", "Overdue items", "number"),
      col("submitted", "Submitted", "number"),
      ...homework.map((h) => col(`homework_${h.id}`, h.title)),
    );
  if (sheet.kind === "progress")
    cols.push(
      col("evidence", "Learning observations", "number"),
      col("support", "Areas to review"),
      col("lastSeen", "Last learning evidence"),
    );
  if (sheet.kind === "parents")
    cols.push(
      col("parentLink", "Linked parent / guardian"),
      col("lastContact", "Last recorded message"),
    );
  if (sheet.kind === "groups") cols.push(col("groups", "Groups"));
  if (sheet.kind === "interventions")
    cols.push(
      col("needs", "Recorded support needs"),
      col("recommendation", "Suggested next action"),
      col("due", "Support due"),
    );
  cols.push(...sheet.columns.map((c) => ({ ...c, id: `custom_${c.id}` })));
  const rows = data.learners
    .filter(
      (l) =>
        !filters.groupId ||
        data.members.some(
          (m) => m.student_id === l.id && m.group_id === filters.groupId,
        ),
    )
    .map((learner) => {
      const at = attendance.filter((a) => a.student_id === learner.id);
      const latestScores = new Map<string, Assessment>();
      for (const a of assessments
        .filter(
          (a) =>
            a.student_id === learner.id &&
            a.percentage !== null &&
            Number.isFinite(a.percentage),
        )
        .slice()
        .sort((a, b) =>
          (b.released_at ?? "").localeCompare(a.released_at ?? ""),
        ))
        if (!latestScores.has(a.assessment_id))
          latestScores.set(a.assessment_id, a);
      const as = Array.from(latestScores.values());
      const applicable = homework.filter(
        (h) =>
          (!learner.joined_at ||
            !h.due_date ||
            h.due_date >= learner.joined_at.slice(0, 10)) &&
          (!h.target_group_id ||
            data.members.some(
              (m) =>
                m.student_id === learner.id && m.group_id === h.target_group_id,
            )),
      );
      const submitted = data.submissions.filter(
        (s) =>
          s.student_id === learner.id &&
          (s.submitted_at || s.received_at) &&
          s.status !== "draft",
      );
      const missing = applicable.filter(
        (h) =>
          h.due_date &&
          h.due_date < today &&
          !submitted.some((s) => s.homework_id === h.id),
      );
      const evidence = data.evidence.filter(
        (e) =>
          e.student_id === learner.id &&
          subject(e.subject_id) &&
          during(e.observed_at),
      );
      const latest = new Map<string, Evidence>();
      for (const e of evidence
        .slice()
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at)))
        if (!latest.has(e.outcome_id)) latest.set(e.outcome_id, e);
      const support = Array.from(latest.values()).filter(
        (e) => e.proficiency === "BE" || e.proficiency === "AE",
      );
      const interventions = data.interventions.filter(
        (i) =>
          i.studentId === learner.id &&
          subject(i.subjectId) &&
          !["completed", "dismissed"].includes(i.status),
      );
      const parentLinks = data.parentLinks.filter(
        (p) => p.student_id === learner.id,
      );
      const lastContact =
        data.parentMessages
          .filter((p) => p.student_id === learner.id)
          .map((p) => p.created_at.slice(0, 10))
          .sort()
          .at(-1) ?? null;
      const groups = data.groups.filter((g) =>
        data.members.some(
          (m) => m.student_id === learner.id && m.group_id === g.id,
        ),
      );
      const values: Record<string, Cell> = {
        parentLink: parentLinks.length
          ? parentLinks
              .map((p) => p.relationship + (p.is_primary ? " (primary)" : ""))
              .join(", ")
          : "No linked parent visible",
        lastContact,
        name: learner.name,
        admission: learner.admission_number,
        account: learner.profile_id ? "Claimed" : "Not yet claimed",
        groups: groups.map((g) => g.name).join(", ") || null,
        attendance: at.length
          ? Math.round(
              (at.filter((a) => a.status === "present").length * 100) /
                at.length,
            )
          : null,
        absent: at.filter((a) => a.status === "absent").length,
        late: at.filter((a) => a.is_late).length,
        records: at.length,
        average: as.length
          ? Math.round(
              as.reduce((sum, a) => sum + a.percentage!, 0) / as.length,
            )
          : null,
        missing: missing.length,
        submitted: applicable.filter((h) =>
          submitted.some((s) => s.homework_id === h.id),
        ).length,
        evidence: evidence.length,
        support:
          support
            .map(
              (e) =>
                data.outcomes.find((o) => o.id === e.outcome_id)
                  ?.outcome_text ??
                "Learning outcome (open progress for details)",
            )
            .join(", ") || null,
        lastSeen:
          evidence
            .map((e) => e.observed_at.slice(0, 10))
            .sort()
            .at(-1) ?? null,
        needs: interventions.map((i) => i.outcomeText).join("; ") || null,
        recommendation:
          interventions.map((i) => i.recommendation).join("; ") || null,
        due:
          interventions
            .map((i) => i.dueAt?.slice(0, 10))
            .filter(Boolean)
            .sort()[0] ?? null,
      };
      for (const a of as
        .slice()
        .sort((a, b) =>
          (a.released_at ?? "").localeCompare(b.released_at ?? ""),
        ))
        values[`assessment_${a.assessment_id}`] = a.percentage;
      for (const e of exams) {
        const matches = data.results.filter(
          (r) =>
            r.student_id === learner.id &&
            r.exam_id === e.id &&
            subject(r.subject_id),
        );
        values[`exam_${e.id}`] = !filters.subjectId
          ? "Choose a subject"
          : matches[0]?.is_absent
            ? "Absent"
            : (matches[0]?.marks ?? null);
      }
      const current = data.results.find(
        (r) =>
          r.student_id === learner.id &&
          r.exam_id === filters.examId &&
          r.subject_id === filters.subjectId,
      );
      const prior = data.results.find(
        (r) =>
          r.student_id === learner.id &&
          r.exam_id === filters.compareExamId &&
          r.subject_id === filters.subjectId,
      );
      const currentExam = data.exams.find((e) => e.id === filters.examId),
        priorExam = data.exams.find((e) => e.id === filters.compareExamId);
      if (sheet.kind === "exams") {
        values.average = current && !current.is_absent ? current.marks : null;
        values.examStatus = current
          ? current.is_absent
            ? "Absent"
            : "Recorded"
          : "Not entered";
      }
      values.examChange =
        current &&
        !current.is_absent &&
        prior &&
        !prior.is_absent &&
        currentExam?.exam_type === priorExam?.exam_type &&
        filters.examId !== filters.compareExamId
          ? Math.round((current.marks - prior.marks) * 100) / 100
          : null;
      values.rank =
        current && !current.is_absent
          ? 1 +
            data.results.filter(
              (r) =>
                r.exam_id === filters.examId &&
                r.subject_id === filters.subjectId &&
                !r.is_absent &&
                r.marks > current.marks &&
                data.learners.some((l) => l.id === r.student_id),
            ).length
          : null;
      for (const h of applicable) {
        const s = submitted.find((s) => s.homework_id === h.id);
        values[`homework_${h.id}`] = s
          ? s.mark !== null
            ? `Marked: ${s.mark}`
            : s.status
          : h.due_date && h.due_date < today
            ? "Overdue"
            : "Not submitted";
      }
      const saved = doc.cells[sheet.id]?.[learner.id] ?? {};
      for (const c of sheet.columns)
        values[`custom_${c.id}`] =
          c.type === "formula" ? calculate(c, saved) : (saved[c.id] ?? null);
      const reasons: string[] = [];
      if (missing.length) reasons.push(`${missing.length} overdue item(s)`);
      if (at.filter((a) => a.status === "absent").length >= 3)
        reasons.push("Absent on 3 or more recorded days");
      if (typeof values.examChange === "number" && values.examChange < 0)
        reasons.push(`Exam mark fell by ${Math.abs(values.examChange)} points`);
      if (interventions.length)
        reasons.push(`${interventions.length} recorded support need(s)`);
      return { learner, values, reasons };
    });
  return { columns: cols, rows };
}
/** Deliberately bounded commands: no LLM or silent guesses about a teacher's request. */
export function filterRows(
  rows: Row[],
  query: string,
): { rows: Row[]; understood: boolean } {
  const q = query.trim().toLowerCase();
  if (!q) return { rows, understood: true };
  let predicate: ((r: Row) => boolean) | null = null;
  const below = q.match(
    /^(?:show (?:me )?(?:learners |students )?)?(?:below|under) (\d+(?:\.\d+)?)%?$/,
  );
  if (below)
    predicate = (r) =>
      typeof r.values.average === "number" &&
      r.values.average < Number(below[1]);
  else if (/^(who improved|most improved|improving)$/.test(q))
    predicate = (r) =>
      typeof r.values.examChange === "number" && r.values.examChange > 0;
  else if (/^(top performers|80% or above)$/.test(q))
    predicate = (r) =>
      typeof r.values.average === "number" && r.values.average >= 80;
  else if (/^(who dropped|marks dropping|dropping)$/.test(q))
    predicate = (r) =>
      typeof r.values.examChange === "number" && r.values.examChange < 0;
  else if (/^(who missed homework|missing homework|missing work)$/.test(q))
    predicate = (r) =>
      typeof r.values.missing === "number" && r.values.missing > 0;
  else if (/^(frequent absence|attendance risk|frequently absent)$/.test(q))
    predicate = (r) =>
      typeof r.values.absent === "number" && r.values.absent >= 3;
  else if (
    /^(needs attention|who needs help|show learners i should check on)$/.test(q)
  )
    predicate = (r) => r.reasons.length > 0;
  else if (q === "missing marks")
    predicate = (r) => r.values.examStatus === "Not entered";
  else if (q === "no assessment data")
    predicate = (r) =>
      r.values.average === null && r.values.examStatus !== "Absent";
  return predicate
    ? { rows: rows.filter(predicate), understood: true }
    : {
        rows: rows.filter((r) =>
          `${r.learner.name} ${r.learner.admission_number ?? ""}`
            .toLowerCase()
            .includes(q),
        ),
        understood: false,
      };
}
/** Imports match an immutable learner ID or a unique admission number, never row position. */
export function previewPaste(
  lines: string[][],
  learners: Learner[],
  columns: Column[],
): { studentId: string; columnId: string; value: Cell }[] {
  if (lines.length > 1000)
    throw new Error("Import at most 1,000 rows at a time.");
  const changes: { studentId: string; columnId: string; value: Cell }[] = [];
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (line.every((v) => !v.trim())) continue;
    if (line.length !== columns.length + 1)
      throw new Error(
        `Row ${index + 1}: use learner ID or admission number followed by ${columns.length} value(s).`,
      );
    const key = line[0].trim();
    const matches = learners.filter(
      (l) =>
        l.id === key ||
        (Boolean(l.admission_number) && l.admission_number === key),
    );
    if (matches.length !== 1)
      throw new Error(
        `Row ${index + 1}: learner identifier is missing or ambiguous.`,
      );
    if (seen.has(matches[0].id))
      throw new Error(`Row ${index + 1}: learner appears twice.`);
    seen.add(matches[0].id);
    columns.forEach((c, i) =>
      changes.push({
        studentId: matches[0].id,
        columnId: c.id,
        value: parseCell(line[i + 1], c.type),
      }),
    );
  }
  return changes;
}
