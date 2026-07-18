"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";
import { getActiveTerm, currentWeekOf, totalWeeksOf, type ActiveTerm } from "@/lib/academicTerm";
import { nairobiDateAdd, nairobiWeekStart, nairobiDateStr } from "@/lib/time";

interface SubjectWeekRow {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  grade: string;
  strand: string | null;
  subStrand: string | null;
  topic: string | null;
  hasScheme: boolean;
  hasPlan: boolean;
  hasNotes: boolean;
  hasHomework: boolean;
  hasAssessment: boolean;
}

function Skeleton({ h = 56, w = "100%" }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 12,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", flexShrink: 0,
    }} />
  );
}

interface Chip { key: "scheme" | "plan" | "notes" | "homework" | "assess"; label: string; done: boolean; }

function StatusChip({ chip, onTap }: { chip: Chip; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      style={{
        flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 11, fontWeight: 600,
        border: chip.done ? "1px solid #6ee7b7" : `1px solid ${C.border}`,
        background: chip.done ? C.accentLight : "#ffffff",
        color: chip.done ? "#065f46" : C.textMuted,
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {chip.done ? "✓ " : ""}{chip.label}
    </button>
  );
}

export default function TeacherWeekViewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [term, setTerm] = useState<ActiveTerm | null>(null);
  const [weekNum, setWeekNum] = useState<number>(1);
  const [totalWeeks, setTotalWeeks] = useState<number>(13);
  const [rows, setRows] = useState<SubjectWeekRow[]>([]);
  const [hasClasses, setHasClasses] = useState(true);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [memberRes, profileRes, teacherProfRes] = await Promise.all([
        supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
        supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle(),
        supabase.from("teacher_profiles").select("school_id").eq("profile_id", user.id).maybeSingle(),
      ]);
      const sId = memberRes.data?.school_id ?? profileRes.data?.school_id ?? teacherProfRes.data?.school_id ?? "";

      if (!sId) { setError("No school linked to your account yet."); setLoading(false); return; }

      const activeTerm = await getActiveTerm(sId);
      if (!activeTerm) { setError("No active term. Contact your admin."); setLoading(false); return; }
      setTerm(activeTerm);

      const wStart = nairobiDateAdd(nairobiWeekStart(), offset * 7);
      const baseWeek = currentWeekOf(activeTerm);
      const wk = Math.max(1, baseWeek + offset);
      setWeekNum(wk);
      setTotalWeeks(totalWeeksOf(activeTerm));

      const tcRes = await supabase
        .from("teacher_classes")
        .select("class_id, subject_id, classes(id,name), subjects(id,name)")
        .eq("teacher_id", user.id);

      const combos = ((tcRes.data ?? []) as any[])
        .filter(r => r.class_id && r.subject_id)
        .map(r => ({
          classId: r.class_id as string,
          className: (Array.isArray(r.classes) ? r.classes[0]?.name : r.classes?.name) ?? "Class",
          subjectId: r.subject_id as string,
          subjectName: (Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name) ?? "Subject",
        }));

      if (combos.length === 0) { setHasClasses(false); setRows([]); setLoading(false); return; }
      setHasClasses(true);

      const classIds = Array.from(new Set(combos.map(c => c.classId)));

      const classGradeRes = await supabase.from("classes").select("id,name").in("id", classIds);
      const gradeMap = new Map(((classGradeRes.data ?? []) as any[]).map(c => [c.id, c.name as string]));

      const [
        curriculumRes,
        strandProgressRes,
        plansRes,
        notesRes,
        homeworkRes,
        assessRes,
      ] = await Promise.all([
        supabase.from("curriculum")
          .select("id,grade,subject,strand,sub_strand,topic,week,term")
          .eq("term", activeTerm.term)
          .eq("week", wk)
          .in("grade", Array.from(new Set(Array.from(gradeMap.values())))),
        supabase.from("strand_progress")
          .select("class_id,curriculum_id,term,week")
          .eq("teacher_id", user.id)
          .eq("term", activeTerm.term)
          .eq("week", wk)
          .in("class_id", classIds),
        supabase.from("lesson_plans")
          .select("id,class_id,subject_id,week_start")
          .eq("teacher_id", user.id)
          .eq("week_start", wStart)
          .in("class_id", classIds),
        supabase.from("progress_records")
          .select("id,class_id,subject_id,taught_date")
          .eq("teacher_id", user.id)
          .gte("taught_date", wStart)
          .in("class_id", classIds),
        supabase.from("homework")
          .select("id,class_id,subject,due_date")
          .eq("teacher_id", user.id)
          .in("class_id", classIds),
        supabase.from("cbc_assessments")
          .select("id,class_id,subject_id,term,academic_year")
          .eq("term", activeTerm.term)
          .eq("academic_year", activeTerm.academic_year)
          .in("class_id", classIds),
      ]);

      const curriculumRows = (curriculumRes.data ?? []) as any[];
      const plans = (plansRes.data ?? []) as any[];
      const notes = (notesRes.data ?? []) as any[];
      const homework = (homeworkRes.data ?? []) as any[];
      const assessments = (assessRes.data ?? []) as any[];
      const strandProgress = (strandProgressRes.data ?? []) as any[];

      const result: SubjectWeekRow[] = combos.map(combo => {
        const grade = gradeMap.get(combo.classId) ?? "";
        const curr = curriculumRows.find(c => c.grade === grade && c.subject === combo.subjectName);

        const hasScheme = strandProgress.some(sp => sp.class_id === combo.classId);

        // Intentionally matched by class_id + subject, not by the specific
        // curriculum unit shown above (`curr`) — this is a "did you do the
        // weekly workflow" checklist, so a freeform plan/note/homework not
        // tied to this week's scheme suggestion should still count as done.
        // (curriculum_unit_id exists on lesson_plans/progress_records/homework/
        // cbc_assessments/curriculum_content but is an unused duplicate of
        // curriculum_id — confirmed empty everywhere, 2026-07-10. Don't build
        // against it.)
        const hasPlan = plans.some(p =>
          p.class_id === combo.classId && p.subject_id === combo.subjectId
        );
        const hasNotes = notes.some(n =>
          n.class_id === combo.classId && n.subject_id === combo.subjectId
        );
        const hasHomework = homework.some(h =>
          h.class_id === combo.classId && h.subject === combo.subjectName
        );
        const hasAssessment = assessments.some(a => a.class_id === combo.classId && a.subject_id === combo.subjectId);

        return {
          classId: combo.classId,
          className: combo.className,
          subjectId: combo.subjectId,
          subjectName: combo.subjectName,
          grade,
          strand: curr?.strand ?? null,
          subStrand: curr?.sub_strand ?? null,
          topic: curr?.topic ?? null,
          hasScheme, hasPlan, hasNotes, hasHomework, hasAssessment,
        };
      });

      result.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
      setRows(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong loading your week.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(weekOffset); }, [weekOffset, load]);

  function chipsFor(row: SubjectWeekRow): Chip[] {
    return [
      { key: "scheme",    label: "Scheme",   done: row.hasScheme },
      { key: "plan",      label: "Plan",     done: row.hasPlan },
      { key: "notes",     label: "Notes",    done: row.hasNotes },
      { key: "homework",  label: "HW",       done: row.hasHomework },
      { key: "assess",    label: "Assess",   done: row.hasAssessment },
    ];
  }

  function navigateToChip(row: SubjectWeekRow, key: Chip["key"]) {
    const base: Record<Chip["key"], string> = {
      scheme:   `/teacher/scheme?class_id=${row.classId}&subject_id=${row.subjectId}`,
      plan:     `/teacher/lessonplan?classId=${row.classId}`,
      notes:    `/teacher/progress?class_id=${row.classId}&subject_id=${row.subjectId}`,
      homework: `/teacher/homework`,
      assess:   `/teacher/assessment?class_id=${row.classId}&subject_id=${row.subjectId}`,
    };
    router.push(base[key]);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.surface, padding: 16 }}>
        <Skeleton h={48} />
        <div style={{ height: 16 }} />
        {[0, 1, 2].map(i => <div key={i} style={{ marginBottom: 12 }}><Skeleton h={120} /></div>)}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: C.surface, padding: 16 }}>
        <div style={{ fontSize: 14, color: C.error, marginBottom: 12 }}>{error}</div>
      </div>
    );
  }

  if (!hasClasses) {
    return (
      <div style={{ minHeight: "100vh", background: C.surface, padding: 16, textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>
          No classes set up yet
        </div>
        <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 20 }}>
          Set up your class to see your teaching week.
        </div>
        <button
          onClick={() => router.push("/teacher/onboarding/class")}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600,
          }}
        >
          Set up your class →
        </button>
      </div>
    );
  }

  const today = nairobiDateStr();
  const outsideTerm = term ? (today < term.start_date || today > term.end_date) : false;

  return (
    <div style={{ minHeight: "100vh", background: C.surface, paddingBottom: 96 }}>
      <div style={{ padding: "20px 16px 12px", background: C.bg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            style={{ background: "none", border: "none", fontSize: 22, color: C.textMuted, padding: 4 }}
          >
            ‹
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary }}>
              Week {weekNum}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {term ? `Term ${term.term} · ${term.academic_year}` : ""}
              {totalWeeks ? ` · of ${totalWeeks}` : ""}
            </div>
          </div>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            style={{ background: "none", border: "none", fontSize: 22, color: C.textMuted, padding: 4 }}
          >
            ›
          </button>
        </div>
        {weekOffset !== 0 && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button
              onClick={() => setWeekOffset(0)}
              style={{
                fontSize: 12, fontWeight: 600, color: C.accent, background: "none",
                border: `1px solid ${C.accent}`, borderRadius: 999, padding: "4px 14px",
              }}
            >
              Today
            </button>
          </div>
        )}
        {outsideTerm && (
          <div style={{
            marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#fef3c7",
            color: "#92400e", fontSize: 12, fontWeight: 600, textAlign: "center",
          }}>
            Outside term dates
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted, fontSize: 14 }}>
            No subjects found for this week.
          </div>
        )}

        {rows.map(row => {
          const chips = chipsFor(row);
          const doneCount = chips.filter(c => c.done).length;
          const allDone = doneCount === chips.length;
          const nextChip = chips.find(c => !c.done);

          return (
            <div
              key={`${row.classId}-${row.subjectId}`}
              style={{
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: 14, boxShadow: C.shadow,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
                    {row.subjectName}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                    {row.className}
                  </div>
                </div>
              </div>

              {row.strand ? (
                <div style={{ marginTop: 8, fontSize: 13, color: C.textPrimary }}>
                  {row.strand}{row.subStrand ? ` · ${row.subStrand}` : ""}
                  {row.topic && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{row.topic}</div>}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>
                  No curriculum entry for this week yet
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {chips.map(chip => (
                  <StatusChip key={chip.key} chip={chip} onTap={() => navigateToChip(row, chip.key)} />
                ))}
              </div>

              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
                  {doneCount} of {chips.length} complete
                </div>
                <button
                  onClick={() => navigateToChip(row, nextChip?.key ?? "assess")}
                  style={{
                    padding: "7px 16px", borderRadius: 8,
                    border: allDone ? `1px solid ${C.border}` : "none",
                    background: allDone ? C.surface : C.accent,
                    color: allDone ? C.textMuted : "#fff",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  {allDone ? "View →" : doneCount === 0 ? "Start →" : "Continue →"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
