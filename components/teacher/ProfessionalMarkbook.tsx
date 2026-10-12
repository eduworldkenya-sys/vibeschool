"use client";

import React from "react";
import { examResultStateLabel, type ExamResultState } from "@/lib/assessment/exam-results";

type Student = {
  id: string;
  name: string;
  source: "db" | "manual";
  class_name?: string;
  admission_number?: string | null;
};

type Result = {
  id: string;
  student_id: string;
  marks: number | null;
  is_absent: boolean;
  result_state?: string;
};

type Props = {
  students: Student[];
  results: Result[];
  draftMarks: Record<string, string>;
  passMark: number;
  maxMarks: number;
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
const FINAL_STATES = new Set<ExamResultState>(["entered", "absent", "not_assessed", "exempt", "transferred"]);

export default function ProfessionalMarkbook({
  students,
  results,
  draftMarks,
  maxMarks,
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
  const [openMore, setOpenMore] = React.useState<string | null>(null);
  const savedMap = React.useMemo(() => new Map(results.map(result => [result.student_id, result])), [results]);
  const resolvedCount = results.filter(result => FINAL_STATES.has((result.result_state ?? (result.is_absent ? "absent" : "entered")) as ExamResultState)).length;
  const remainingCount = Math.max(0, students.length - resolvedCount);

  async function applyPastedMarks() {
    const lines=pasteText.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if(!lines.length){setPasteMessage('Paste admission number and mark in two columns.');return}
    const ids=new Map<string,Student>();
    const admissions=new Map<string,Student>();
    const ambiguous=new Set<string>();
    for(const student of students){
      ids.set(student.id,student)
      const adm=student.admission_number?.trim()
      if(adm){
        if(admissions.has(adm))ambiguous.add(adm)
        admissions.set(adm,student)
      }
    }
    const staged:{student:Student,raw:string}[]=[]
    const seen=new Set<string>()
    for(const line of lines){
      const parts=line.split(/[\t,;]/).map(part=>part.trim())
      if(parts.length!==2 || !parts[0]){
        setPasteMessage('Every row must have an admission number or learner ID, then a mark. Nothing was added.')
        return
      }
      const [key,value]=parts
      if(ambiguous.has(key)){
        setPasteMessage('Admission number '+key+' belongs to multiple learners. Nothing was added.')
        return
      }
      const learner=ids.get(key)??admissions.get(key)
      if(!learner || seen.has(learner.id)){
        setPasteMessage('Unknown or repeated learner: '+key+'. Nothing was added.')
        return
      }
      seen.add(learner.id)
      const absent=/^(abs|absent)$/i.test(value)
      const mark=Number(value)
      if(!absent && (value==='' || !Number.isFinite(mark) || mark<0 || mark>maxMarks)){
        setPasteMessage('Invalid mark for '+key+'. Use 0–'+maxMarks+' or ABS. Nothing was added.')
        return
      }
      staged.push({student:learner,raw:absent?'ABS':String(mark)})
    }
    let absentCount=0
    for(const row of staged){
      if(row.raw==='ABS'){
        const ok=await onSaveState(row.student,'absent')
        if(!ok){setPasteMessage('Could not save absence for '+row.student.name+'. Check the highlighted row.');return}
        absentCount+=1
      }else onChangeMark(row.student.id,row.raw)
    }
    setPasteMessage(`${staged.length} learners matched by ID · ${absentCount} absences saved. Review remaining marks, then select Save all.`)
  }

  function focusRelative(index: number, direction: 1 | -1) {
    const next = students[index + direction];
    if (!next) return;
    inputRefs.current[next.id]?.focus();
    inputRefs.current[next.id]?.select();
  }

  function MarkInput({ student, index, nonScoreState, raw, rowError, isSaving }: { student: Student; index: number; nonScoreState: ExamResultState | null; raw: string; rowError?: string; isSaving: boolean }) {
    if (locked) {
      const result = savedMap.get(student.id);
      return <strong>{nonScoreState ? examResultStateLabel(nonScoreState) : result?.marks ?? "—"}</strong>;
    }
    return (
      <input
        ref={node => { inputRefs.current[student.id] = node; }}
        aria-label={`Mark for ${student.name}`}
        inputMode="decimal"
        type="number"
        min={0}
        max={maxMarks}
        step="0.5"
        value={nonScoreState ? "" : raw}
        disabled={Boolean(nonScoreState) || isSaving}
        onChange={event => onChangeMark(student.id, event.target.value)}
        onBlur={() => { if (!nonScoreState && raw.trim() !== "") void onSaveMark(student); }}
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
        style={{ width: 84, padding: "9px 8px", borderRadius: 10, border: `1.5px solid ${rowError ? "#ef4444" : "#d6d3d1"}`, textAlign: "center", fontSize: 15, fontWeight: 800, outline: "none", background: nonScoreState ? "#f5f5f4" : "#fff" }}
      />
    );
  }

  return (
    <section style={{ border: "1px solid #e7e5e4", borderRadius: 18, background: "#fff", overflow: "hidden" }} aria-label="Enter exam marks">
      <style jsx>{`
        .desktop-table{display:block}
        .mobile-list{display:none}
        @media (max-width: 720px){
          .desktop-table{display:none}
          .mobile-list{display:grid;gap:8;padding:10px}
        }
      `}</style>

      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e7e5e4", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1c1917" }}>Enter marks</div>
          <div style={{ marginTop: 3, fontSize: 12, color: "#78716c" }}>
            {resolvedCount}/{students.length} final{remainingCount > 0 ? ` · ${remainingCount} still need a final result` : " · complete"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {!locked && <button type="button" onClick={() => setShowPaste(v => !v)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", color: "#44403c", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Paste marks</button>}
          {!locked && <button type="button" onClick={() => void onSaveAll()} disabled={savingAll} style={{ padding: "8px 10px", borderRadius: 10, border: "none", background: "var(--teacher-ink, #1c2923)", color: "#fff", cursor: savingAll ? "default" : "pointer", fontSize: 11, fontWeight: 800, opacity: savingAll ? .65 : 1 }}>{savingAll ? "Saving…" : "Save all"}</button>}
          <div style={{ fontSize: 12, color: locked ? "#991b1b" : "#57534e", fontWeight: 700 }}>
            {locked ? "Locked — read only" : "Enter saves · Enter key moves down"}
          </div>
        </div>
      </div>

      {showPaste && !locked && <div style={{ padding: "14px 16px", borderBottom: "1px solid #e7e5e4", background: "#fafaf9" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1c1917" }}>Paste marks</div>
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#78716c" }}>Paste two columns: admission number or learner ID, then mark. Do not match by list position. Use ABS or Absent for a learner who missed the exam.</p>
        <textarea value={pasteText} onChange={event => { setPasteText(event.target.value); setPasteMessage(null); }} placeholder={"101\\t78\\n102\\t64\\n103\\tABS"} rows={6} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d6d3d1", borderRadius: 12, padding: 11, resize: "vertical", font: "inherit", background: "#fff" }} />
        <div style={{ marginTop: 9, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => { void applyPastedMarks(); }} style={{ padding: "8px 11px", borderRadius: 10, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Add to marks</button>
          <button type="button" onClick={() => { setPasteText(""); setPasteMessage(null); }} style={{ padding: "8px 11px", borderRadius: 10, border: "1px solid #d6d3d1", background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>Clear</button>
          {pasteMessage && <span role="status" style={{ fontSize: 11, color: "#57534e", fontWeight: 700 }}>{pasteMessage}</span>}
        </div>
      </div>}

      <div className="desktop-table" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9" }}>
              {["#", "Learner", `Mark /${maxMarks}`, "Recorded", "Status", "Saved", "More"].map(label => (
                <th key={label} style={{ padding: "10px 12px", textAlign: label === `Mark /${maxMarks}` ? "center" : "left", fontSize: 11, color: "#78716c", fontWeight: 800, borderBottom: "1px solid #e7e5e4", whiteSpace: "nowrap" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const result = savedMap.get(student.id);
              const state = (result?.result_state ?? (result?.is_absent ? "absent" : result ? "entered" : null)) as ExamResultState | null;
              const raw = draftMarks[student.id] ?? "";
              const mark = Number(raw);
              const validMark = raw.trim() !== "" && Number.isFinite(mark) && mark >= 0 && mark <= maxMarks;
              const rowError = errorByStudent[student.id];
              const isSaving = savingId === student.id;
              const justSaved = savedId === student.id;
              return (
                <tr key={student.id} style={{ borderBottom: "1px solid #f5f5f4", background: rowError ? "#fff7f7" : "#fff" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#a8a29e", width: 44 }}>{index + 1}</td>
                  <td style={{ padding: "10px 12px" }}><div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{student.name}</div>{rowError && <div role="alert" style={{ marginTop: 4, fontSize: 11, color: "#b91c1c", fontWeight: 700 }}>{rowError}</div>}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}><MarkInput student={student} index={index} nonScoreState={state&&state!=="entered"?state:null} raw={raw} rowError={rowError} isSaving={isSaving} /></td>
                  <td style={{ padding: "10px 12px" }}><span style={{ display: "inline-block", minWidth: 46, padding: "5px 8px", borderRadius: 999, textAlign: "center", fontSize: 11, fontWeight: 750, background:state&&state!=="entered"?"#fff7df":"#f1f7f1", color:state&&state!=="entered"?"#92400e":"#276047" }}>{state ? examResultStateLabel(state) : "—"}</span></td>
                  <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: state&&state!=="entered" ? "#92400e" : validMark ? "#286043" : "#a8a29e" }}>{state&&state!=="entered" ? examResultStateLabel(state) : validMark ? (result ? "Recorded" : "Draft") : "Not entered"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: isSaving ? "#92400e" : justSaved ? "#047857" : result ? "#57534e" : "#a8a29e", fontWeight: 700 }}>{isSaving ? "Saving…" : justSaved ? "Saved ✓" : result ? "Saved" : "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap", position: "relative" }}>
                    <button type="button" onClick={() => setOpenMore(openMore === student.id ? null : student.id)} style={{ minWidth: 36, minHeight: 36, borderRadius: 9, border: "1px solid #e7e5e4", background: "#fff", fontWeight: 750, cursor: "pointer" }}>⋯</button>
                    {openMore === student.id && <div style={{ position: "absolute", right: 12, top: 46, zIndex: 5, minWidth: 160, padding: 6, border: "1px solid #e7e5e4", borderRadius: 10, background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.12)", textAlign: "left" }}>
                      {!locked && <>{STATE_OPTIONS.map(option=><button key={option.value} type="button" disabled={isSaving} onClick={()=>{setOpenMore(null);void onSaveState(student,option.value)}} style={menuButton}>{option.label}</button>)}{result&&<button type="button" disabled={isSaving} onClick={()=>{setOpenMore(null);void onClearResult(student)}} style={menuButton}>Clear result</button>}</>}
                      <a href={reportCardHref(student.id)} style={{ ...menuButton, display: "block", textDecoration: "none" }}>View report</a>
                    </div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-list">
        {students.map((student, index) => {
          const result = savedMap.get(student.id);
          const state = (result?.result_state ?? (result?.is_absent ? "absent" : result ? "entered" : null)) as ExamResultState | null;
          const raw = draftMarks[student.id] ?? "";
          const rowError = errorByStudent[student.id];
          const isSaving = savingId === student.id;
          const justSaved = savedId === student.id;
          return <article key={student.id} style={{ border: `1px solid ${rowError ? "#fecaca" : "#e7e5e4"}`, borderRadius: 14, padding: 12, background: rowError ? "#fff7f7" : "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, color: "#a8a29e" }}>{index + 1}</div><strong style={{ display: "block", fontSize: 14, color: "#1c1917", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</strong></div>
              <button type="button" onClick={() => setOpenMore(openMore === student.id ? null : student.id)} style={{ minWidth: 38, minHeight: 38, borderRadius: 10, border: "1px solid #e7e5e4", background: "#fff", fontWeight: 750 }}>⋯</button>
            </div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#78716c", marginBottom: 5 }}>MARK</div><MarkInput student={student} index={index} nonScoreState={state&&state!=="entered"?state:null} raw={raw} rowError={rowError} isSaving={isSaving} /></div>
              {!locked && <select aria-label={`Set result status for ${student.name}`} value="" disabled={isSaving} onChange={event=>{const value=event.target.value;if(value==='clear')void onClearResult(student);else if(value)void onSaveState(student,value as Exclude<ExamResultState,"entered">)}} style={{ minHeight:44,padding:"0 10px",borderRadius:12,border:"1px solid #d6d3d1",background:"#fff",fontWeight:800 }}><option value="">Status…</option>{STATE_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}{result&&<option value="clear">Clear result</option>}</select>}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: isSaving ? "#92400e" : justSaved ? "#047857" : result ? "#57534e" : "#a8a29e", fontWeight: 700 }}>{isSaving ? "Saving…" : justSaved ? "Saved ✓" : state ? `${examResultStateLabel(state)} · Saved` : "Not entered"}</div>
            {rowError && <div role="alert" style={{ marginTop: 6, fontSize: 11, color: "#b91c1c", fontWeight: 700 }}>{rowError}</div>}
            {openMore === student.id && <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              <a href={reportCardHref(student.id)} style={{ ...menuButton, display: "block", textDecoration: "none" }}>View learner report</a>
            </div>}
          </article>;
        })}
      </div>
    </section>
  );
}

const menuButton: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "none", borderRadius: 8, background: "#fff", color: "#374151", padding: "9px 10px", textAlign: "left", fontSize: 12, fontWeight: 700, cursor: "pointer" };
