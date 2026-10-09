"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { nairobiDateStr } from "@/lib/time";
import {
  loadWorkbook,
  saveDocument,
  saveAttendance,
  saveExamMarks,
  createSelectedGroup,
} from "@/lib/class-workbook/data";
import {
  templates,
  project,
  filterRows,
  compareValues,
  display,
  safeExport,
  parseCell,
  previewPaste,
  validateDocument,
  type Cell,
  type Column,
  type Data,
  type Document,
  type Sheet,
  type View,
  type Filters,
} from "@/lib/class-workbook/model";
import dynamic from "next/dynamic";
const AssessmentIntelligenceConsole = dynamic(
  () => import("@/components/teacher/AssessmentIntelligenceConsole"),
  { ssr: false },
);
import styles from "./ClassWorkbook.module.css";

function Editor({
  value,
  column,
  label,
  onCommit,
  disabled,
}: {
  value: Cell;
  column: Column;
  label: string;
  onCommit: (value: Cell) => void;
  disabled: boolean;
}) {
  const [raw, setRaw] = useState(value == null ? "" : String(value));
  const [error, setError] = useState("");
  useEffect(() => {
    setRaw(value == null ? "" : String(value));
    setError("");
  }, [value]);
  if (column.type === "check")
    return (
      <>
        <span className={styles.printTitle}>{display(value)}</span>
        <input
          type="checkbox"
          aria-label={label}
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onCommit(e.target.checked)}
        />
      </>
    );
  function commit() {
    try {
      onCommit(parseCell(raw, column.type));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check this cell.");
    }
  }
  return (
    <>
      <span className={styles.printTitle}>{display(value)}</span>
      <input
        aria-label={label}
        disabled={disabled}
        type={column.type === "date" ? "date" : "text"}
        inputMode={column.type === "number" ? "decimal" : undefined}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setRaw(value == null ? "" : String(value));
            setError("");
          }
        }}
      />
      {error && <div role="alert">{error}</div>}
    </>
  );
}
const initialFilters: Filters = {
  subjectId: "",
  start: "",
  end: "",
  groupId: "",
  examId: "",
  compareExamId: "",
};
export default function ClassWorkbook() {
  const { id: classId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Data | null>(null),
    [doc, setDoc] = useState<Document | null>(null),
    [revision, setRevision] = useState(0),
    [sheetId, setSheetId] = useState("sheet0");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("name"),
    [descending, setDescending] = useState(false),
    [hidden, setHidden] = useState<string[]>(["rank"]),
    [filters, setFilters] = useState<Filters>(initialFilters);
  const [selected, setSelected] = useState<string[]>([]),
    [showTemplates, setShowTemplates] = useState(false),
    [newTitle, setNewTitle] = useState(""),
    [columnType, setColumnType] = useState<Column["type"]>("text"),
    [formula, setFormula] = useState<Column["operation"]>("average"),
    [sources, setSources] = useState<string[]>([]);
  const [bulkValue, setBulkValue] = useState(""),
    [comparison, setComparison] = useState<Data | null>(null),
    [paste, setPaste] = useState(""),
    [pasteTarget, setPasteTarget] = useState(""),
    [hasHeadings, setHasHeadings] = useState(false),
    [preview, setPreview] = useState<
      { studentId: string; columnId: string; value: Cell }[]
    >([]);
  const [dailyDate, setDailyDate] = useState(nairobiDateStr()),
    [attendanceDraft, setAttendanceDraft] = useState<Record<string, Cell>>({}),
    [markDraft, setMarkDraft] = useState<Record<string, Cell>>({});
  const undo = useRef<Document[]>([]),
    redo = useRef<Document[]>([]),
    loadId = useRef(0),
    mutationLock = useRef(false),
    groupRequest = useRef<{ key: string; id: string } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const load = useCallback(async () => {
    const ticket = ++loadId.current;
    setLoading(true);
    setError("");
    try {
      const result = await loadWorkbook(classId);
      if (ticket !== loadId.current) return;
      setData(result.data);
      setDoc(result.document);
      const requestedSheet = searchParams.get("sheet");
      if (requestedSheet) {
        const target = result.document.sheets.find(item => item.kind === requestedSheet);
        if (target) setSheetId(target.id);
      }
      setRevision(result.revision);
      setDirty(false);
      setSelected([]);
      setAttendanceDraft({});
      setMarkDraft({});
      undo.current = [];
      redo.current = [];
      setHistoryVersion((v) => v + 1);
      setFilters((f) => ({
        ...f,
        subjectId:
          f.subjectId ||
          searchParams.get("subjectId") ||
          result.data.subjects[0]?.id ||
          "",
        examId: f.examId || result.data.exams.at(-1)?.id || "",
      }));
    } catch (e) {
      if (ticket === loadId.current)
        setError(
          e instanceof Error ? e.message : "Workbook could not be opened.",
        );
    } finally {
      if (ticket === loadId.current) setLoading(false);
    }
  }, [classId, searchParams]);
  useEffect(() => {
    const ticket = loadId.current + 1;
    void load();
    return () => {
      if (loadId.current === ticket) loadId.current = ticket + 1;
    };
  }, [load]);
  useEffect(() => {
    function protect(e: BeforeUnloadEvent) {
      if (
        dirty ||
        Object.keys(markDraft).length ||
        Object.keys(attendanceDraft).length
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, markDraft, attendanceDraft]);
  const sheet = doc?.sheets.find((s) => s.id === sheetId) ?? doc?.sheets[0];
  const projection = useMemo(
    () =>
      data && doc && sheet
        ? project(data, sheet, doc, filters, nairobiDateStr())
        : { columns: [], rows: [] },
    [data, doc, sheet, filters],
  );
  const filtered = useMemo(
    () => filterRows(projection.rows, query),
    [projection.rows, query],
  );
  const rows = useMemo(
    () =>
      filtered.rows
        .slice()
        .sort(
          (a, b) =>
            compareValues(a.values[sort], b.values[sort], descending) ||
            a.learner.id.localeCompare(b.learner.id),
        ),
    [filtered.rows, sort, descending],
  );
  const columns = projection.columns.filter((c) => !hidden.includes(c.id));
  function change(next: Document) {
    if (!doc || busy) return;
    validateDocument(next);
    undo.current = [...undo.current.slice(-29), doc];
    redo.current = [];
    setDoc(next);
    setDirty(true);
    setHistoryVersion((v) => v + 1);
    setMessage("Unsaved changes");
  }
  function applyChanges(
    changes: { studentId: string; columnId: string; value: Cell }[],
  ) {
    if (!doc || !sheet) return;
    const next = structuredClone(doc);
    next.cells[sheet.id] ??= {};
    for (const c of changes) {
      next.cells[sheet.id][c.studentId] ??= {};
      next.cells[sheet.id][c.studentId][c.columnId] = c.value;
    }
    change(next);
  }
  function switchSheet(id: string) {
    setSheetId(id);
    setSelected([]);
    setHidden(["rank"]);
    setSort("name");
    setDescending(false);
    setPaste("");
    setPreview([]);
    setPasteTarget("");
  }
  function applyView(v: View) {
    if (
      Object.keys(markDraft).length &&
      (v.subjectId !== filters.subjectId || v.examId !== filters.examId)
    ) {
      setError("Save marks before switching exam context.");
      return;
    }
    switchSheet(v.sheetId);
    setQuery(v.query);
    setSort(v.sort);
    setDescending(v.descending);
    setHidden(v.hidden);
    setFilters({
      subjectId: v.subjectId,
      start: v.start,
      end: v.end,
      groupId: v.groupId,
      examId: v.examId,
      compareExamId: v.compareExamId,
    });
  }
  async function run(action: () => Promise<void>) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This action could not be completed.",
      );
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (!data || !doc) return;
    await run(async () => {
      const next = await saveDocument(data, doc, revision);
      setRevision(next);
      setDirty(false);
      setMessage("Your sheets and views are saved.");
    });
  }
  function protectLink(event: React.MouseEvent<HTMLElement>) {
    if (!(event.target instanceof Element) || !event.target.closest("a"))
      return;
    if (busy) {
      event.preventDefault();
      event.stopPropagation();
      setError("Wait for this save to finish before leaving.");
      return;
    }
    if (
      (dirty ||
        Object.keys(markDraft).length ||
        Object.keys(attendanceDraft).length) &&
      !window.confirm(
        "You have unsaved changes. Save or back up your draft to keep them. Leave this workbook?",
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
  async function refresh() {
    if (
      dirty ||
      Object.keys(markDraft).length ||
      Object.keys(attendanceDraft).length
    ) {
      if (
        !window.confirm(
          "Reload the saved workbook and discard unsaved changes? Back up your draft first if you want to keep it.",
        )
      )
        return;
    }
    await load();
  }
  async function exportSheet(format: "csv" | "xlsx" | "pdf") {
    if (!data || !sheet) return;
    await run(async () => {
      const exports = await import("@/lib/reports/exportUtils");
      const fields = columns.map((c) => c.label);
      const values = rows.map((r) =>
        columns.map((c) => safeExport(r.values[c.id])),
      );
      const options = {
        schoolId: data.schoolId,
        reportTitle: `${data.className} - ${sheet.title}`,
        generatedBy: "Teacher",
        columns: fields,
        rows: values,
      };
      if (format === "csv") exports.exportToCSV(options);
      if (format === "xlsx") await exports.exportToExcel(options);
      if (format === "pdf") await exports.exportToPDF(options);
      setMessage(
        `Exported ${rows.length} visible learners. Custom cells reflect your current draft; academic values reflect saved records.`,
      );
    });
  }
  function exportDraft() {
    if (!doc) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "class-workbook-draft.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function addSheet(template: (typeof templates)[number]) {
    if (!doc) return;
    const next = structuredClone(doc);
    const added: Sheet = {
      id: crypto.randomUUID(),
      title: template.title,
      kind: template.kind,
      columns: template.columns,
    };
    next.sheets.push(added);
    change(next);
    switchSheet(added.id);
    setShowTemplates(false);
  }
  function addColumn() {
    if (!doc || !sheet || !newTitle.trim()) return;
    try {
      const next = structuredClone(doc);
      next.sheets
        .find((s) => s.id === sheet.id)!
        .columns.push({
          id: crypto.randomUUID(),
          label: newTitle.trim(),
          type: columnType,
          ...(columnType === "formula" ? { operation: formula, sources } : {}),
        });
      change(next);
      setNewTitle("");
      setSources([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Column could not be added.");
    }
  }
  function checkPaste(lines?: string[][]) {
    if (!data || !sheet) return;
    try {
      const custom = sheet.columns.find((c) => c.id === pasteTarget);
      const targets: Column[] =
        pasteTarget === "all"
          ? sheet.columns.filter((c) => c.type !== "formula")
          : pasteTarget === "exam"
            ? [{ id: "exam", label: "Mark", type: "text" }]
            : custom
              ? [custom]
              : [];
      if (!targets.length) throw new Error("Choose an editable column first.");
      const input =
        lines ?? paste.split(/\r?\n/).map((line) => line.split("\t"));
      const changes = previewPaste(
        hasHeadings ? input.slice(1) : input,
        data.learners,
        targets,
      );
      if (pasteTarget === "exam")
        for (const c of changes) {
          if (String(c.value).toUpperCase() === "ABS") c.value = "ABS";
          else {
            c.value = parseCell(String(c.value ?? ""), "number");
            if (typeof c.value !== "number" || c.value < 0 || c.value > 100)
              throw new Error("Use marks from 0 to 100, or ABS.");
          }
        }
      setPreview(changes);
      setMessage(
        `${changes.length} cells ready for review. Nothing has been saved.`,
      );
    } catch (e) {
      setPreview([]);
      setError(e instanceof Error ? e.message : "Paste could not be read.");
    }
  }
  async function importFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("Choose a file smaller than 2 MB.");
      return;
    }
    await run(async () => {
      if (file.name.endsWith(".json")) {
        const restored = validateDocument(JSON.parse(await file.text()));
        const allowed = new Set(data?.learners.map((l) => l.id));
        for (const rows of Object.values(restored.cells))
          for (const id of Object.keys(rows))
            if (!allowed.has(id))
              throw new Error(
                "This backup contains learners outside the current class.",
              );
        undo.current.push(doc!);
        redo.current = [];
        setDoc(restored);
        setDirty(true);
        setHistoryVersion((v) => v + 1);
        setSheetId(restored.sheets[0]?.id ?? "");
        setMessage("Backup restored to your draft. Review it, then save.");
        return;
      }
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellFormula: false,
        cellDates: false,
      });
      const values = XLSX.utils.sheet_to_json<string[]>(
        book.Sheets[book.SheetNames[0]],
        { header: 1, raw: false, defval: "" },
      );
      checkPaste(values.map((r) => r.map(String)));
    });
  }
  async function saveAcademic(kind: "attendance" | "exam") {
    if (!data) return;
    await run(async () => {
      if (kind === "attendance") {
        const changes = Object.entries(attendanceDraft).map(
          ([studentId, value]) => ({ studentId, value }),
        );
        await saveAttendance(data, dailyDate, changes);
        setAttendanceDraft({});
      } else {
        const changes = Object.entries(markDraft).map(([studentId, value]) => ({
          studentId,
          value,
        }));
        await saveExamMarks(data, filters.examId, filters.subjectId, changes);
        setMarkDraft({});
      }
      // Refresh academic projections without discarding custom-sheet edits.
      const updated = await loadWorkbook(classId);
      setData(updated.data);
      setMessage(
        kind === "attendance"
          ? "Daily attendance saved and checked."
          : "Exam marks saved and checked.",
      );
    });
  }
  const focusIds = selected.filter((id) =>
    rows.some((r) => r.learner.id === id),
  );
  if (loading)
    return (
      <section className={styles.workbook} onClickCapture={protectLink}>
        <h1>Class workbook</h1>
        <p role="status">Opening your learners and their records…</p>
      </section>
    );
  if (!data || !doc || !sheet)
    return (
      <section className={styles.workbook} onClickCapture={protectLink}>
        <h1>Class workbook</h1>
        <div className={styles.error} role="alert">
          {error || "Your workbook is unavailable."}
        </div>
        <button onClick={() => void load()}>Try again</button>{" "}
        <Link href="/teacher/classhub">My classes</Link>
      </section>
    );
  const currentExam = data.exams.find((e) => e.id === filters.examId);
  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => selected.includes(r.learner.id));
  return (
    <section className={styles.workbook} onClickCapture={protectLink}>
      <div className={styles.header}>
        <div>
          <Link href={`/teacher/classhub/${classId}`}>← Back to class</Link>
          <h1>{data.className} · Class sheets</h1>
          <p className={styles.muted}>
            View class records or keep a private tracker alongside them.
          </p>
        </div>
        <div className={styles.actions}>
          <button disabled={busy} onClick={() => void refresh()}>
            Refresh records
          </button>
          <button
            className={styles.primary}
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            {busy ? "Working…" : dirty ? "Save my sheets" : "Sheets saved"}
          </button>
        </div>
      </div>
      {filters.start && filters.end && filters.start > filters.end && (
        <div className={styles.error} role="alert">
          The end date must be on or after the start date.
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error} <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      <nav className={styles.tabs} aria-label="Workbook sheets">
        {doc.sheets.map((s) => (
          <button
            key={s.id}
            className={sheet.id === s.id ? styles.active : ""}
            aria-pressed={sheet.id === s.id}
            onClick={() => switchSheet(s.id)}
          >
            {s.title}
          </button>
        ))}
        <button
          disabled={busy || doc.sheets.length >= 30}
          onClick={() => setShowTemplates((v) => !v)}
        >
          + Add sheet
        </button>
      </nav>
      {showTemplates && (
        <section className={styles.card}>
          <h2>What would you like to track?</h2>
          <div className={styles.choices}>
            {templates.map((t) => (
              <button key={t.title} onClick={() => addSheet(t)}>
                {t.title}
                <small>{t.why}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <p className={styles.muted}>
        {templates.find((t) => t.kind === sheet.kind)?.why} Attendance shows
        daily register records. Scores and progress show your assigned subjects
        and recorded evidence.
      </p>
      <details className={styles.card}><summary>Subject, term, dates and group filters</summary>
      <div className={styles.toolbar}>
        <label>
          Subject{" "}
          <select
            aria-label="Subject"
            value={filters.subjectId}
            onChange={(e) => {
              if (Object.keys(markDraft).length) {
                setError("Save exam marks before changing subject.");
                return;
              }
              setFilters((f) => ({ ...f, subjectId: e.target.value }));
              setSelected([]);
            }}
          >
            <option value="">All my subjects</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Term{" "}
          <select
            aria-label="Term date range"
            value={
              data.terms.find(
                (t) =>
                  t.start_date === filters.start && t.end_date === filters.end,
              )?.id ?? ""
            }
            onChange={(e) => {
              const term = data.terms.find((t) => t.id === e.target.value);
              setFilters((f) => ({
                ...f,
                start: term?.start_date ?? "",
                end: term?.end_date ?? "",
              }));
            }}
          >
            <option value="">Choose term or dates</option>
            {data.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From{" "}
          <input
            type="date"
            value={filters.start}
            onChange={(e) =>
              setFilters((f) => ({ ...f, start: e.target.value }))
            }
          />
        </label>
        <label>
          To{" "}
          <input
            type="date"
            value={filters.end}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
          />
        </label>
        <label>
          Group{" "}
          <select
            value={filters.groupId}
            onChange={(e) => {
              setFilters((f) => ({ ...f, groupId: e.target.value }));
              setSelected([]);
            }}
          >
            <option value="">Whole class</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            if (Object.keys(markDraft).length) {
              setError("Save exam marks before clearing filters.");
              return;
            }
            setFilters(initialFilters);
            setQuery("");
            setSelected([]);
          }}
        >
          Clear filters
        </button>
      </div>
      </details>
      {sheet.kind === "exams" && (
        <section className={styles.card}>
          <div className={styles.toolbar}>
            <label>
              Enter / compare exam{" "}
              <select
                value={filters.examId}
                onChange={(e) => {
                  if (Object.keys(markDraft).length) {
                    setError("Save marks before changing exam.");
                    return;
                  }
                  setFilters((f) => ({ ...f, examId: e.target.value }));
                }}
              >
                <option value="">Choose exam</option>
                {data.exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · Term {e.term} {e.academic_year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compare with{" "}
              <select
                value={filters.compareExamId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, compareExamId: e.target.value }))
                }
              >
                <option value="">Choose earlier exam</option>
                {data.exams
                  .filter((e) => e.id !== filters.examId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {e.academic_year}
                    </option>
                  ))}
              </select>
            </label>
            <button
              disabled={
                busy ||
                !Object.keys(markDraft).length ||
                !filters.subjectId ||
                !currentExam ||
                currentExam.is_locked
              }
              onClick={() => void saveAcademic("exam")}
            >
              Save exam marks ({Object.keys(markDraft).length})
            </button>
            <Link
              href={`/teacher/results?classId=${classId}&subjectId=${filters.subjectId}`}
            >
              Open Exam Centre / full analysis
            </Link>
          </div>
          {filters.examId && filters.subjectId && (
            <details>
              <summary>Explore exam results and teaching actions</summary>
              <AssessmentIntelligenceConsole
                examId={filters.examId}
                classId={classId}
                subjectId={filters.subjectId}
                refreshKey={data.results.map((r) => r.updated_at).join("|")}
                onOpenMarkbook={() =>
                  setMessage(
                    "Enter marks in the last column of the workbook below.",
                  )
                }
              />
            </details>
          )}
          <div className={styles.toolbar}>
            <label>
              Compare another assigned class{" "}
              <select
                aria-label="Compare class"
                disabled={busy || !filters.examId || !filters.subjectId}
                value={comparison?.classId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setComparison(null);
                    return;
                  }
                  void run(async () => {
                    const other = await loadWorkbook(id);
                    if (
                      other.data.schoolId !== data.schoolId ||
                      !other.data.subjects.some(
                        (s) => s.id === filters.subjectId,
                      )
                    )
                      throw new Error(
                        "Choose an assigned class in this school and subject.",
                      );
                    setComparison(other.data);
                  });
                }}
              >
                <option value="">Choose class</option>
                {data.classes
                  .filter(
                    (c) =>
                      c.id !== classId &&
                      c.subjectIds.includes(filters.subjectId),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {comparison && filters.subjectId && filters.examId && (
            <div className={styles.scroll}>
              <table className={styles.grid}>
                <caption>
                  Same exam and subject · current class enrolments
                </caption>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Mean mark</th>
                    <th>Marks recorded</th>
                    <th>Absent</th>
                    <th>Not entered</th>
                  </tr>
                </thead>
                <tbody>
                  {[data, comparison].map((c) => {
                    const results = c.results.filter(
                      (r) =>
                        r.exam_id === filters.examId &&
                        r.subject_id === filters.subjectId &&
                        c.learners.some((l) => l.id === r.student_id),
                    );
                    const scores = results.filter((r) => !r.is_absent);
                    return (
                      <tr key={c.classId}>
                        <td>{c.className}</td>
                        <td>
                          {scores.length
                            ? (
                                scores.reduce((sum, r) => sum + r.marks, 0) /
                                scores.length
                              ).toFixed(1)
                            : "No recorded scores"}
                        </td>
                        <td>{scores.length}</td>
                        <td>{results.filter((r) => r.is_absent).length}</td>
                        <td>{c.learners.length - results.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.muted}>
            Marks are out of 100. ABS means absent; a blank means not entered.
            Comparisons need the same subject and exam type. Position uses the
            whole current class; equal marks share a position.{" "}
            {currentExam?.is_locked ? "This exam is locked." : ""}
          </p>
        </section>
      )}
      {sheet.kind === "attendance" && (
        <section className={styles.card}>
          <div className={styles.toolbar}>
            <label>
              Daily register date{" "}
              <input
                type="date"
                value={dailyDate}
                max={nairobiDateStr()}
                onChange={(e) => {
                  if (Object.keys(attendanceDraft).length) {
                    setError("Save attendance before changing date.");
                    return;
                  }
                  setDailyDate(e.target.value);
                }}
              />
            </label>
            <button
              disabled={busy || !focusIds.length}
              onClick={() =>
                setAttendanceDraft((d) => ({
                  ...d,
                  ...Object.fromEntries(focusIds.map((id) => [id, "present"])),
                }))
              }
            >
              Selected learners present
            </button>
            <button
              disabled={busy || !focusIds.length}
              onClick={() =>
                setAttendanceDraft((d) => ({
                  ...d,
                  ...Object.fromEntries(focusIds.map((id) => [id, "absent"])),
                }))
              }
            >
              Selected learners absent
            </button>
            <button
              disabled={busy || !Object.keys(attendanceDraft).length}
              onClick={() => void saveAcademic("attendance")}
            >
              Save attendance ({Object.keys(attendanceDraft).length})
            </button>
            <Link href={`/teacher/attendance?classId=${classId}`}>
              Open full register
            </Link>
          </div>
          <p className={styles.muted}>
            Only the learners you mark are saved. Unrecorded learners stay
            unrecorded. Lesson attendance is available in the full register.
          </p>
        </section>
      )}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          aria-label="Find learners or ask a class question"
          placeholder="Find a learner, or type: missing homework"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected([]);
          }}
        />
        <details><summary>Filter by recorded evidence</summary><div className={styles.actions}>
        {[
          "Needs attention",
          "Missing homework",
          "Frequent absence",
          "Who improved",
          "Who dropped",
          "Below 50",
          "Missing marks",
        ].map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuery(q);
              setSelected([]);
            }}
          >
            {q}
          </button>
        ))}
        </div></details>
      </div>
      {query && !filtered.understood && (
        <p className={styles.muted}>
          Searching learner names and admission numbers. Use the quick questions
          above for supported class filters.
        </p>
      )}
      <div className={styles.summary}>
        <span>
          <strong>
            {rows.length} / {data.learners.length}
          </strong>{" "}
          learners shown
        </span>
        <span>
          <strong>
            {projection.rows.filter((r) => r.reasons.length).length}
          </strong>{" "}
          have recorded reasons to check in
        </span>
        <span>
          <strong>{focusIds.length}</strong> selected
        </span>
      </div>
      <h2 className={styles.printTitle}>
        {sheet.title} · {data.className}
      </h2>
      <div className={styles.scroll}>
        <table className={styles.grid}>
          <caption className={styles.muted}>
            {sheet.title} ·{" "}
            {filters.subjectId
              ? data.subjects.find((s) => s.id === filters.subjectId)?.name
              : "All assigned subjects"}{" "}
            · {filters.start || "All dates"} to {filters.end || "today"}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <label>
                  <input
                    type="checkbox"
                    aria-label="Select all visible learners"
                    checked={allVisibleSelected}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? rows.map((r) => r.learner.id) : [],
                      )
                    }
                  />
                  <button
                    onClick={() => {
                      setSort("name");
                      setDescending(sort === "name" ? !descending : false);
                    }}
                  >
                    Learner {sort === "name" ? (descending ? "↓" : "↑") : ""}
                  </button>
                </label>
              </th>
              {columns
                .filter((c) => c.id !== "name")
                .map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={
                      sort === c.id
                        ? descending
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                  >
                    <button
                      onClick={() => {
                        setSort(c.id);
                        setDescending(sort === c.id ? !descending : false);
                      }}
                    >
                      {c.label} {sort === c.id ? (descending ? "↓" : "↑") : ""}
                    </button>
                  </th>
                ))}
              {sheet.kind === "attendance" && (
                <th scope="col">Daily register · {dailyDate}</th>
              )}
              {sheet.kind === "exams" && (
                <th scope="col">
                  Enter mark · {currentExam?.name ?? "Choose exam"}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.learner.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.learner.name}`}
                    checked={selected.includes(r.learner.id)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked
                          ? [...s, r.learner.id]
                          : s.filter((id) => id !== r.learner.id),
                      )
                    }
                  />
                  <Link
                    href={`/teacher/classhub/${classId}/student/${r.learner.id}`}
                  >
                    {r.learner.name}
                  </Link>
                  {r.reasons.length > 0 && (
                    <div className={styles.muted}>{r.reasons.join(" · ")}</div>
                  )}
                </td>
                {columns
                  .filter((c) => c.id !== "name")
                  .map((c) => (
                    <td key={c.id}>
                      {c.id.startsWith("custom_") && c.type !== "formula" ? (
                        <Editor
                          disabled={busy}
                          value={r.values[c.id] ?? null}
                          column={{ ...c, id: c.id.slice(7) }}
                          label={`${c.label} for ${r.learner.name}`}
                          onCommit={(value) => {
                            if (value !== r.values[c.id])
                              applyChanges([
                                {
                                  studentId: r.learner.id,
                                  columnId: c.id.slice(7),
                                  value,
                                },
                              ]);
                          }}
                        />
                      ) : (
                        display(r.values[c.id])
                      )}
                    </td>
                  ))}
                {sheet.kind === "attendance" && (
                  <td>
                    <select
                      aria-label={`Attendance for ${r.learner.name}`}
                      disabled={busy}
                      value={String(
                        attendanceDraft[r.learner.id] ??
                          (() => {
                            const a = data.attendance.find(
                              (a) =>
                                a.student_id === r.learner.id &&
                                a.date === dailyDate &&
                                a.timetable_slot_id === null,
                            );
                            return a ? (a.is_late ? "late" : a.status) : "";
                          })(),
                      )}
                      onChange={(e) =>
                        setAttendanceDraft((d) => ({
                          ...d,
                          [r.learner.id]: e.target.value,
                        }))
                      }
                    >
                      <option value="" disabled>
                        Not recorded
                      </option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                    </select>
                  </td>
                )}
                {sheet.kind === "exams" && (
                  <td>
                    <Editor
                      disabled={
                        busy ||
                        !filters.subjectId ||
                        !currentExam ||
                        currentExam.is_locked
                      }
                      column={{ id: "mark", label: "Mark", type: "text" }}
                      value={
                        markDraft[r.learner.id] ??
                        (() => {
                          const mark = data.results.find(
                            (m) =>
                              m.student_id === r.learner.id &&
                              m.exam_id === filters.examId &&
                              m.subject_id === filters.subjectId,
                          );
                          return mark
                            ? mark.is_absent
                              ? "ABS"
                              : mark.marks
                            : null;
                        })()
                      }
                      label={`Exam mark for ${r.learner.name}`}
                      onCommit={(value) => {
                        try {
                          if (value === null) return;
                          const parsed =
                            String(value).toUpperCase() === "ABS"
                              ? "ABS"
                              : parseCell(String(value), "number");
                          if (
                            parsed !== "ABS" &&
                            (typeof parsed !== "number" ||
                              parsed < 0 ||
                              parsed > 100)
                          )
                            throw new Error("Use a mark from 0 to 100 or ABS.");
                          const existing = data.results.find(
                            (m) =>
                              m.student_id === r.learner.id &&
                              m.exam_id === filters.examId &&
                              m.subject_id === filters.subjectId,
                          );
                          const saved = existing
                            ? existing.is_absent
                              ? "ABS"
                              : existing.marks
                            : null;
                          if (parsed !== saved)
                            setMarkDraft((d) => ({
                              ...d,
                              [r.learner.id]: parsed,
                            }));
                          else
                            setMarkDraft((d) => {
                              const next = { ...d };
                              delete next[r.learner.id];
                              return next;
                            });
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Check this mark.",
                          );
                        }
                      }}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className={styles.card}><summary>Export, print and draft history</summary>
      <div className={styles.actions}>
        <button
          disabled={busy || !undo.current.length}
          onClick={() => {
            if (!doc) return;
            const previous = undo.current.pop();
            if (previous) {
              redo.current.push(doc);
              setDoc(previous);
              setDirty(true);
              setHistoryVersion(historyVersion + 1);
            }
          }}
        >
          Undo sheet edit
        </button>
        <button
          disabled={busy || !redo.current.length}
          onClick={() => {
            const next = redo.current.pop();
            if (next) {
              undo.current.push(doc);
              setDoc(next);
              setDirty(true);
              setHistoryVersion(historyVersion + 1);
            }
          }}
        >
          Redo
        </button>
        <button disabled={busy} onClick={() => void exportSheet("xlsx")}>
          Excel
        </button>
        <button disabled={busy} onClick={() => void exportSheet("csv")}>
          CSV
        </button>
        <button disabled={busy} onClick={() => void exportSheet("pdf")}>
          PDF
        </button>
        <button onClick={() => window.print()}>Print</button>
        <button onClick={exportDraft}>Back up my sheet draft</button>
      </div>
      </details>
      <details className={styles.card}>
        <summary>Columns, saved views and my sheet settings</summary>
        <div className={styles.columns}>
          {projection.columns
            .filter((c) => c.id !== "name")
            .map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={!hidden.includes(c.id)}
                  onChange={(e) =>
                    setHidden((h) =>
                      e.target.checked
                        ? h.filter((id) => id !== c.id)
                        : [...h, c.id],
                    )
                  }
                />
                {c.label}
              </label>
            ))}
        </div>
        <div className={styles.toolbar}>
          <label>
            Column / view name{" "}
            <input
              value={newTitle}
              maxLength={80}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Book brought"
            />
          </label>
          <select
            aria-label="Column type"
            value={columnType}
            onChange={(e) => setColumnType(e.target.value as Column["type"])}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="check">Yes / No</option>
            <option value="formula">Calculation</option>
          </select>
          {columnType === "formula" && (
            <>
              <select
                aria-label="Calculation"
                value={formula}
                onChange={(e) =>
                  setFormula(e.target.value as Column["operation"])
                }
              >
                <option value="average">Average</option>
                <option value="sum">Total</option>
                <option value="difference">First minus second</option>
              </select>
              {sheet.columns
                .filter((c) => c.type === "number")
                .map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={sources.includes(c.id)}
                      onChange={(e) =>
                        setSources((s) =>
                          e.target.checked
                            ? [...s, c.id]
                            : s.filter((id) => id !== c.id),
                        )
                      }
                    />
                    {c.label}
                  </label>
                ))}
            </>
          )}
          <button disabled={busy || !newTitle.trim()} onClick={addColumn}>
            Add custom column
          </button>
          <button
            disabled={busy || !newTitle.trim()}
            onClick={() => {
              const view: View = {
                id: crypto.randomUUID(),
                title: newTitle.trim(),
                sheetId: sheet.id,
                query,
                sort,
                descending,
                hidden,
                ...filters,
              };
              change({ ...doc, views: [...doc.views, view] });
              setNewTitle("");
            }}
          >
            Save this view
          </button>
          <button
            disabled={busy || !newTitle.trim()}
            onClick={() => {
              change({
                ...doc,
                sheets: doc.sheets.map((s) =>
                  s.id === sheet.id ? { ...s, title: newTitle.trim() } : s,
                ),
              });
              setNewTitle("");
            }}
          >
            Rename sheet
          </button>
        </div>
        <div className={styles.columns}>
          {sheet.columns.map((c, index) => (
            <div key={c.id}>
              {c.label}{" "}
              <button
                disabled={busy || index === 0}
                aria-label={`Move ${c.label} left`}
                onClick={() => {
                  const next = structuredClone(doc);
                  const cols = next.sheets.find(
                    (s) => s.id === sheet.id,
                  )!.columns;
                  [cols[index - 1], cols[index]] = [
                    cols[index],
                    cols[index - 1],
                  ];
                  change(next);
                }}
              >
                ←
              </button>
              <button
                disabled={
                  busy || sheet.columns.some((x) => x.sources?.includes(c.id))
                }
                aria-label={`Remove ${c.label}`}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Remove ${c.label} and its custom values? Undo will restore them until you leave this page.`,
                    )
                  )
                    return;
                  const next = structuredClone(doc);
                  next.sheets.find((s) => s.id === sheet.id)!.columns =
                    sheet.columns.filter((x) => x.id !== c.id);
                  for (const cells of Object.values(next.cells[sheet.id] ?? {}))
                    delete cells[c.id];
                  change(next);
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className={styles.actions}>
          {doc.views.map((v) => (
            <span key={v.id}>
              <button onClick={() => applyView(v)}>{v.title}</button>
              <button
                disabled={busy}
                aria-label={`Remove view ${v.title}`}
                onClick={() =>
                  change({
                    ...doc,
                    views: doc.views.filter((x) => x.id !== v.id),
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
          <button
            disabled={busy || doc.sheets.length <= 1}
            onClick={() => {
              if (
                !window.confirm(
                  `Remove ${sheet.title} and its private custom cells? Connected attendance, marks and homework will remain available. You can undo before leaving.`,
                )
              )
                return;
              const next = structuredClone(doc);
              next.sheets = next.sheets.filter((s) => s.id !== sheet.id);
              delete next.cells[sheet.id];
              next.views = next.views.filter((v) => v.sheetId !== sheet.id);
              change(next);
              switchSheet(next.sheets[0].id);
            }}
          >
            Remove this sheet
          </button>
        </div>
        <p className={styles.muted}>
          Custom columns are your private tracking notes. Official marks,
          attendance and learning evidence are saved through their existing
          features. Calculations require every input; missing values stay blank.
        </p>
      </details>
      <details className={styles.card}>
        <summary>Paste from Excel or import a file</summary>
        <p className={styles.muted}>
          Start each row with the learner ID or unique admission number, then
          the selected column value(s). For several custom columns, use the
          order shown on your sheet. We match identities rather than spreadsheet
          row order. Dates use YYYY-MM-DD. Use Yes / No for checkboxes.
        </p>
        <label>
          Fill column{" "}
          <select
            value={pasteTarget}
            onChange={(e) => {
              setPasteTarget(e.target.value);
              setPreview([]);
            }}
          >
            <option value="">Choose column</option>
            {sheet.columns.some((c) => c.type !== "formula") && (
              <option value="all">All editable custom columns</option>
            )}
            {sheet.kind === "exams" && (
              <option value="exam">Selected exam mark</option>
            )}
            {sheet.columns
              .filter((c) => c.type !== "formula")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={hasHeadings}
            onChange={(e) => {
              setHasHeadings(e.target.checked);
              setPreview([]);
            }}
          />
          First row contains headings
        </label>
        <textarea
          aria-label="Paste learner identifiers and values"
          rows={4}
          value={paste}
          onChange={(e) => {
            setPaste(e.target.value);
            setPreview([]);
          }}
          placeholder={"1024\t68\n1025\tABS"}
        />
        <div className={styles.actions}>
          <button disabled={busy || !pasteTarget} onClick={() => checkPaste()}>
            Preview paste
          </button>
          <button
            disabled={busy || !pasteTarget}
            onClick={() =>
              void run(async () => {
                const custom = sheet.columns.find((c) => c.id === pasteTarget);
                const targets =
                  pasteTarget === "all"
                    ? sheet.columns.filter((c) => c.type !== "formula")
                    : pasteTarget === "exam"
                      ? [{ id: "exam", label: "Exam mark" }]
                      : custom
                        ? [custom]
                        : [];
                if (!targets.length) throw new Error("Choose a column first.");
                const XLSX = await import("xlsx");
                const values = [
                  ["Learner ID", ...targets.map((c) => c.label)],
                  ...data.learners.map((l) => [
                    l.id,
                    ...targets.map(() => null),
                  ]),
                ];
                const book = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(
                  book,
                  XLSX.utils.aoa_to_sheet(values),
                  "Import values",
                );
                XLSX.writeFile(book, "class-workbook-import-template.xlsx");
                setMessage(
                  "Template downloaded. Fill the values, then import with First row contains headings checked.",
                );
              })
            }
          >
            Download import template
          </button>
          <label>
            CSV / Excel / backup{" "}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.[0]) void importFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {preview.length > 0 && (
          <>
            <div className={styles.preview}>
              {preview.map((c) => (
                <p key={`${c.studentId}:${c.columnId}`}>
                  {data.learners.find((l) => l.id === c.studentId)?.name} ·{" "}
                  {c.columnId === "exam"
                    ? "Exam mark"
                    : sheet.columns.find((x) => x.id === c.columnId)?.label}
                  : {display(c.value)}
                </p>
              ))}
            </div>
            <button
              disabled={busy}
              onClick={() => {
                if (pasteTarget === "exam")
                  setMarkDraft((d) => ({
                    ...d,
                    ...Object.fromEntries(
                      preview.map((c) => [c.studentId, c.value]),
                    ),
                  }));
                else applyChanges(preview);
                setPreview([]);
                setMessage("Added to your draft. Check the sheet, then save.");
              }}
            >
              Apply reviewed values to draft
            </button>
          </>
        )}
      </details>

      {!rows.length && (
        <p className={styles.notice}>
          {data.learners.length
            ? "No learners match these filters. Clear filters to see your class."
            : "No enrolled learners yet. Add learners from your class page; every sheet will use the same list."}
        </p>
      )}
      <section className={styles.card}>
        <h2>Work with selected learners</h2>
        <div className={styles.toolbar}>
          <label>
            Custom column{" "}
            <select
              aria-label="Bulk fill column"
              value={pasteTarget}
              onChange={(e) => setPasteTarget(e.target.value)}
            >
              <option value="">Choose column</option>
              {sheet.columns
                .filter((c) => c.type !== "formula")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
          </label>
          <input
            aria-label="Value for selected learners"
            placeholder="Value for selected learners"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
          />
          <button
            disabled={
              busy || !focusIds.length || !pasteTarget || pasteTarget === "exam"
            }
            onClick={() => {
              try {
                const column = sheet.columns.find((c) => c.id === pasteTarget);
                if (!column) return;
                const value = parseCell(bulkValue, column.type);
                applyChanges(
                  focusIds.map((studentId) => ({
                    studentId,
                    columnId: column.id,
                    value,
                  })),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Check the value.");
              }
            }}
          >
            Fill selected learners
          </button>
        </div>
        <div className={styles.toolbar}>
          <input
            aria-label="New group name"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Fractions revision"
            maxLength={80}
          />
          <button
            disabled={busy || !focusIds.length || !newTitle.trim()}
            onClick={() =>
              void run(async () => {
                const key = JSON.stringify([
                  data.classId,
                  newTitle.trim(),
                  focusIds.slice().sort(),
                ]);
                if (groupRequest.current?.key !== key)
                  groupRequest.current = { key, id: crypto.randomUUID() };
                await createSelectedGroup(
                  data,
                  newTitle.trim(),
                  focusIds,
                  groupRequest.current.id,
                );
                const updated = await loadWorkbook(classId);
                setData(updated.data);
                setNewTitle("");
                groupRequest.current = null;
                setMessage(
                  "Group created. It is available in Groups and group homework.",
                );
              })
            }
          >
            Make a group ({focusIds.length})
          </button>
        </div>
        <h2>Continue with this class</h2>
        <div className={styles.actions}>
          <Link href={`/teacher/classhub/${classId}/groups`}>
            Manage groups
          </Link>
          <Link href={`/teacher/classhub/${classId}/homework`}>
            Give / mark homework
          </Link>
          <Link href={`/teacher/classhub/${classId}/progress`}>
            Learning progress
          </Link>
          <Link
            href={`/teacher/assessment/gradebook?classId=${classId}&subjectId=${filters.subjectId}`}
          >
            Assessment gradebook
          </Link>
          <Link href={`/teacher/assessment/interventions?classId=${classId}`}>
            Review support plans
          </Link>
        </div>
        <p className={styles.muted}>
          Select learners to mark attendance in bulk. Open a learner for their
          full record. Parent follow-up is a private tracker; recording a note
          does not send a message. Resource and contribution trackers do not
          collect payments.
        </p>
      </section>
    </section>
  );
}
