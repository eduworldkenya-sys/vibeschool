"use client";

import React from "react";
import { examResultPercentage, examResultStateLabel, type CanonicalExamResult, type ExamResultState } from "@/lib/assessment/exam-results";

type Student = {
  id: string;
  name: string;
  source: "db" | "manual";
  class_name?: string;
};

type Props = {
  students: Student[];
  results: CanonicalExamResult[];
  draftMarks: Record<string, string>;
  maxMarks: number;
  passMark: number;
  locked: boolean;
  savingId: string | null;
  savedId: string | null;
  errorByStudent: Record<string, string>;
  onChangeMark: (studentId: string, value: string) => void;
  onSaveMark: (student: Student) => Promise<boolean>;
  onSaveState: (student: Student, state: Exclude<ExamResultState, "entered">) => Promise<boolean>;
  onClearResult: (student: Student) => Promise<boolean>;
  reportCardHref: (studentId: string) => string;
  onSaveAll: () => Promise<void>;
  savingAll: boolean;
};

const STATE_OPTIONS: Array<{ value: Exclude<ExamResultState, "entered">; label: string }> = [
  { value: "absent", label: "Absent" },
  { value: "not_assessed", label: "Not assessed" },
  { value: "exempt", label: "Exempt" },
  { value: "pending", label: "Pending" },
  { value: "incomplete", label: "Incomplete" },
  { value: "late", label: "Late" },
  { value: "transferred", label: "Transferred" },
  { value: "awaiting_marking", label: "Awaiting marking" },
];

const RESOLVED_STATES = new Set<ExamResultState>(["entered", "absent", "not_assessed", "exempt", "transferred"]);

export default function ProfessionalMarkbook({
  students,
  results,
  draftMarks,
  maxMarks,
  passMark,
  locked,
  savingId,
  savedId,
  errorByStudent,
  onChangeMark,
  onSaveMark,
  onSaveState,
  onClearResult,
  reportCardHref,
  onSaveAll,
  savingAll,
}: Props) {
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const [showPaste, setShowPaste] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [pasteMessage, setPasteMessage] = React.useState<string | null>(null);
  const savedMap = React.useMemo(() => new Map(results.map(result => [result.student_id, result])), [results]);
  const resolvedCount = results.filter(result => RESOLVED_STATES.has(result.result_state)).length;
  const remainingCount = Math.max(0, students.length - resolvedCount);

  function applyPastedMarks() {
    const lines = pasteText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      setPasteMessage("Paste one score per line.");
      return;
    }
    let applied = 0;
    let skipped = 0;
    lines.slice(0, students.length).forEach((line, index) => {
      const parts = line.split(/[\t,;]/).map(part => part.trim()).filter(Boolean);
      const raw = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const mark = Number(raw);
      if (Number.isFinite(mark) && mark >= 0 && mark <= maxMarks) {
        onChangeMark(students[index].id, String(mark));
        applied += 1;
      } else {
        skipped += 1;
      }
    });
    setPasteMessage(`${applied} score${applied === 1 ? "" : "s"} added${skipped ? ` · ${skipped} skipped` : ""}. Check them, then tap Save all.`);
  }

  function focusRelative(index: number, direction: 1 | -1) {
    const next = students[index + direction];
    if (!next) return;
    inputRefs.current[next.id]?.focus();
    inputRefs.current[next.id]?.select();
  }

  return (
    <section style={{ border: "1px solid #e7e5e4", borderRadius: 18, background: "#fff", overflow: "hidden" }} aria-label="Class markbook">
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e7e5e4", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1c1917" }}>Class markbook</div>
          <div style={{ marginTop: 3, fontSize: 12, color: "#78716c" }}>
            {resolvedCount}/{students.length} final{remainingCount > 0 ? ` · ${remainingCount} still need a final result` : " · complete"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {!locked && <button type="button" onClick={() => setShowPaste(v => !v)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", color: "#44403c", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Paste scores</button>}
          {!locked && <button type="button" onClick={() => void onSaveAll()} disabled={savingAll} style={{ padding: "8px 10px", borderRadius: 10, border: "none", background: "#111827", color: "#fff", cursor: savingAll ? "default" : "pointer", fontSize: 11, fontWeight: 800, opacity: savingAll ? .65 : 1 }}>{savingAll ? "Saving…" : "Save all"}</button>}
          <div style={{ fontSize: 12, color: locked ? "#991b1b" : "#57534e", fontWeight: 700 }}>
            {locked ? "Locked — read only" : `Scores are out of ${maxMarks} · Enter saves · ↑↓ moves`}
          </div>
        </div>
      </div>

      {showPaste && !locked && <div style={{ padding: "14px 16px", borderBottom: "1px solid #e7e5e4", background: "#fafaf9" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1c1917" }}>Paste scores</div>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#78716c" }}>Paste one score per line in class-list order. Spreadsheet rows are supported; VibeSchool uses the last value on each row. Valid range: 0–{maxMarks}.</p>
        <textarea value={pasteText} onChange={event => { setPasteText(event.target.value); setPasteMessage(null); }} placeholder={"38\n41\n27\n45"} rows={6} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d6d3d1", borderRadius: 12, padding: 11, resize: "vertical", font: "inherit", background: "#fff" }} />
        <div style={{ marginTop: 9, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={applyPastedMarks} style={{ padding: "8px 11px", borderRadius: 10, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Add to markbook</button>
          <button type="button" onClick={() => { setPasteText(""); setPasteMessage(null); }} style={{ padding: "8px 11px", borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Clear</button>
          {pasteMessage && <span role="status" style={{ fontSize: 11, color: "#57534e", fontWeight: 700 }}>{pasteMessage}</span>}
        </div>
      </div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 780, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9" }}>
              {["#", "Learner", `Score /${maxMarks}`, "Percent", "Result", "Saved", ""].map(label => (
                <th key={label} style={{ padding: "10px 12px", textAlign: label.startsWith("Score") ? "center" : "left", fontSize: 11, color: "#78716c", fontWeight: 800, borderBottom: "1px solid #e7e5e4", whiteSpace: "nowrap" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const result = savedMap.get(student.id);
              const raw = draftMarks[student.id] ?? "";
              const mark = Number(raw);
              const validMark = raw.trim() !== "" && Number.isFinite(mark) && mark >= 0 && mark <= maxMarks;
              const percentage = validMark ? examResultPercentage(mark, maxMarks) : result?.percentage ?? null;
              const rowError = errorByStudent[student.id];
              const isSaving = savingId === student.id;
              const justSaved = savedId === student.id;
              const state = result?.result_state ?? null;
              const passed = result?.result_state === "entered" && result.marks != null ? result.marks >= passMark : validMark ? mark >= passMark : null;

              return (
                <tr key={student.id} style={{ borderBottom: "1px solid #f5f5f4", background: rowError ? "#fff7f7" : "#fff" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#a8a29e", width: 44 }}>{index + 1}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{student.name}</div>
                    {student.class_name && <div style={{ marginTop: 2, fontSize: 11, color: "#a8a29e" }}>{student.class_name}</div>}
                    {rowError && <div role="alert" style={{ marginTop: 4, fontSize: 11, color: "#b91c1c", fontWeight: 700 }}>{rowError}</div>}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    {locked ? (
                      <strong>{result?.result_state === "entered" ? result.marks ?? "—" : "—"}</strong>
                    ) : (
                      <input
                        ref={node => { inputRefs.current[student.id] = node; }}
                        aria-label={`Score for ${student.name}`}
                        inputMode="decimal"
                        type="number"
                        min={0}
                        max={maxMarks}
                        step="0.5"
                        value={raw}
                        disabled={isSaving}
                        onChange={event => onChangeMark(student.id, event.target.value)}
                        onBlur={() => { if (raw.trim() !== "") void onSaveMark(student); }}
                        onKeyDown={async event => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            const ok = await onSaveMark(student);
                            if (ok) focusRelative(index, event.shiftKey ? -1 : 1);
                          }
                          if (event.key === "ArrowDown") { event.preventDefault(); focusRelative(index, 1); }
                          if (event.key === "ArrowUp") { event.preventDefault(); focusRelative(index, -1); }
                        }}
                        style={{ width: 84, padding: "9px 8px", borderRadius: 10, border: `1.5px solid ${rowError ? "#ef4444" : "#d6d3d1"}`, textAlign: "center", fontSize: 15, fontWeight: 800, outline: "none", background: "#fff" }}
                      />
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: percentage == null ? "#a8a29e" : "#44403c" }}>{percentage == null ? "—" : `${percentage}%`}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: state && state !== "entered" ? "#92400e" : passed === true ? "#047857" : passed === false ? "#b91c1c" : "#a8a29e" }}>
                    {state && state !== "entered" ? examResultStateLabel(state) : passed === true ? "At/above target" : passed === false ? "Below target" : "Not entered"}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: isSaving ? "#92400e" : justSaved ? "#047857" : result ? "#57534e" : "#a8a29e", fontWeight: 700 }}>
                    {isSaving ? "Saving…" : justSaved ? "Saved ✓" : result ? "Saved" : "—"}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {!locked && <select
                      aria-label={`Set result status for ${student.name}`}
                      value=""
                      disabled={isSaving}
                      onChange={event => {
                        const value = event.target.value;
                        if (value === "clear") void onClearResult(student);
                        else if (value) void onSaveState(student, value as Exclude<ExamResultState, "entered">);
                      }}
                      style={{ padding: "7px 8px", borderRadius: 9, border: "1px solid #e7e5e4", background: "#fff", color: "#57534e", fontSize: 11, fontWeight: 800 }}
                    >
                      <option value="">Set status…</option>
                      {STATE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      {result && <option value="clear">Clear record</option>}
                    </select>}
                    <a href={reportCardHref(student.id)} style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: "#4f46e5", textDecoration: "none" }}>Report</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
