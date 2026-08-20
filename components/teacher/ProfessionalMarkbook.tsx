"use client";

import React from "react";

type Student = {
  id: string;
  name: string;
  class_name?: string;
};

type Result = {
  id: string;
  student_id: string;
  marks: number;
  is_absent: boolean;
};

type Props = {
  students: Student[];
  results: Result[];
  draftMarks: Record<string, string>;
  passMark: number;
  locked: boolean;
  savingId: string | null;
  savedId: string | null;
  errorByStudent: Record<string, string>;
  onChangeMark: (studentId: string, value: string) => void;
  onSaveMark: (student: Student, isAbsent?: boolean) => Promise<boolean>;
  onClearAbsent: (student: Student) => Promise<boolean>;
  reportCardHref: (studentId: string) => string;
};

function getGrade(marks: number): string {
  if (marks >= 80) return "EE";
  if (marks >= 60) return "ME";
  if (marks >= 40) return "AE";
  return "BE";
}

function gradeTone(grade: string): { background: string; color: string } {
  if (grade === "EE") return { background: "#ecfdf5", color: "#047857" };
  if (grade === "ME") return { background: "#eff6ff", color: "#1d4ed8" };
  if (grade === "AE") return { background: "#fffbeb", color: "#b45309" };
  return { background: "#fef2f2", color: "#b91c1c" };
}

export default function ProfessionalMarkbook({
  students,
  results,
  draftMarks,
  passMark,
  locked,
  savingId,
  savedId,
  errorByStudent,
  onChangeMark,
  onSaveMark,
  onClearAbsent,
  reportCardHref,
}: Props) {
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const savedMap = React.useMemo(() => new Map(results.map(result => [result.student_id, result])), [results]);
  const recordedCount = results.length;
  const remainingCount = Math.max(0, students.length - recordedCount);

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
            {recordedCount}/{students.length} recorded{remainingCount > 0 ? ` · ${remainingCount} remaining` : " · complete"}
          </div>
        </div>
        <div style={{ fontSize: 12, color: locked ? "#991b1b" : "#57534e", fontWeight: 700 }}>
          {locked ? "Locked — read only" : "Enter saves · ↑↓ moves between learners"}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9" }}>
              {['#', 'Learner', 'Mark /100', 'Grade', 'Status', 'Saved', ''].map(label => (
                <th key={label} style={{ padding: "10px 12px", textAlign: label === 'Mark /100' ? 'center' : 'left', fontSize: 11, color: "#78716c", fontWeight: 800, borderBottom: "1px solid #e7e5e4", whiteSpace: "nowrap" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const result = savedMap.get(student.id);
              const isAbsent = result?.is_absent ?? false;
              const raw = draftMarks[student.id] ?? "";
              const mark = Number(raw);
              const validMark = raw.trim() !== "" && Number.isFinite(mark) && mark >= 0 && mark <= 100;
              const grade = !isAbsent && validMark ? getGrade(mark) : null;
              const tone = grade ? gradeTone(grade) : { background: "#f5f5f4", color: "#a8a29e" };
              const rowError = errorByStudent[student.id];
              const isSaving = savingId === student.id;
              const justSaved = savedId === student.id;

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
                      <strong>{isAbsent ? "ABS" : result?.marks ?? "—"}</strong>
                    ) : (
                      <input
                        ref={node => { inputRefs.current[student.id] = node; }}
                        aria-label={`Mark for ${student.name}`}
                        inputMode="decimal"
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={isAbsent ? "" : raw}
                        disabled={isAbsent || isSaving}
                        onChange={event => onChangeMark(student.id, event.target.value)}
                        onBlur={() => { if (!isAbsent && raw.trim() !== "") void onSaveMark(student); }}
                        onKeyDown={async event => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            const ok = await onSaveMark(student);
                            if (ok) focusRelative(index, event.shiftKey ? -1 : 1);
                          }
                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            focusRelative(index, 1);
                          }
                          if (event.key === "ArrowUp") {
                            event.preventDefault();
                            focusRelative(index, -1);
                          }
                        }}
                        style={{ width: 84, padding: "9px 8px", borderRadius: 10, border: `1.5px solid ${rowError ? '#ef4444' : '#d6d3d1'}`, textAlign: "center", fontSize: 15, fontWeight: 800, outline: "none", background: isAbsent ? "#f5f5f4" : "#fff" }}
                      />
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ display: "inline-block", minWidth: 38, padding: "5px 8px", borderRadius: 999, textAlign: "center", fontSize: 11, fontWeight: 800, ...tone }}>{isAbsent ? "ABS" : grade ?? "—"}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: isAbsent ? "#991b1b" : validMark ? (mark >= passMark ? "#047857" : "#b91c1c") : "#a8a29e" }}>
                    {isAbsent ? "Absent" : validMark ? (mark >= passMark ? "At/above pass" : "Below pass") : "Not entered"}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: isSaving ? "#92400e" : justSaved ? "#047857" : result ? "#57534e" : "#a8a29e", fontWeight: 700 }}>
                    {isSaving ? "Saving…" : justSaved ? "Saved ✓" : result ? "Saved" : "—"}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => { void (isAbsent ? onClearAbsent(student) : onSaveMark(student, true)); }}
                        disabled={isSaving}
                        style={{ padding: "7px 9px", borderRadius: 9, border: "1px solid #e7e5e4", background: isAbsent ? "#fef2f2" : "#fff", color: isAbsent ? "#b91c1c" : "#57534e", cursor: "pointer", fontSize: 11, fontWeight: 800 }}
                      >
                        {isAbsent ? "Clear ABS" : "ABS"}
                      </button>
                    )}
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
