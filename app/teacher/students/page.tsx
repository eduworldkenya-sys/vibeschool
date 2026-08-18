"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Context = {
  teacher_id: string;
  school_id: string | null;
  state: "ready" | "needs_school" | "needs_class";
  schools: Array<{ id: string; name: string; active: boolean }>;
  classes: Array<{ class_id: string; class_name: string; stream: string | null; subject_id: string; subject_name: string }>;
};

type Student = { id: string; name: string; admission_number: string | null; profile_id: string | null };
type ClassGroup = { id: string; name: string; stream: string | null; subjects: string[]; students: Student[] };

export default function StudentsPage() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadContext = useCallback(async (requestedSchoolId?: string | null) => {
    const { data, error: contextError } = await supabase.rpc("teacher_get_operating_context", {
      p_requested_school_id: requestedSchoolId ?? undefined,
    });
    if (contextError) throw contextError;
    return data as unknown as Context;
  }, []);

  const loadGroups = useCallback(async (ctx: Context) => {
    if (!ctx.school_id || ctx.classes.length === 0) {
      setGroups([]);
      return;
    }
    const classMap = new Map<string, { name: string; stream: string | null; subjects: Set<string> }>();
    for (const assignment of ctx.classes) {
      const current = classMap.get(assignment.class_id) ?? { name: assignment.class_name, stream: assignment.stream, subjects: new Set<string>() };
      current.subjects.add(assignment.subject_name);
      classMap.set(assignment.class_id, current);
    }
    const classIds = Array.from(classMap.keys());
    const { data, error: rosterError } = await supabase
      .from("student_classes")
      .select("class_id,student_id,students(id,name,admission_number,profile_id,deleted_at)")
      .eq("school_id", ctx.school_id)
      .eq("is_current", true)
      .in("class_id", classIds);
    if (rosterError) throw rosterError;

    const grouped = new Map<string, Student[]>();
    for (const row of data ?? []) {
      const student = (row as any).students;
      if (!student || student.deleted_at) continue;
      const list = grouped.get(row.class_id) ?? [];
      if (!list.some((item) => item.id === student.id)) {
        list.push({ id: student.id, name: student.name, admission_number: student.admission_number ?? null, profile_id: student.profile_id ?? null });
      }
      grouped.set(row.class_id, list);
    }

    setGroups(classIds.map((classId) => {
      const cls = classMap.get(classId)!;
      return {
        id: classId,
        name: cls.name,
        stream: cls.stream,
        subjects: Array.from(cls.subjects).sort(),
        students: (grouped.get(classId) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      };
    }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const ctx = await loadContext();
      setContext(ctx);
      await loadGroups(ctx);
    } catch (loadError) {
      console.error("[TeacherStudents] load", loadError);
      setError("Learners could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [loadContext, loadGroups, router]);

  useEffect(() => { void load(); }, [load]);

  async function changeSchool(schoolId: string) {
    if (!schoolId || schoolId === context?.school_id) return;
    setLoading(true);
    setError(null);
    try {
      const { error: setError } = await supabase.rpc("teacher_set_active_school", { p_school_id: schoolId });
      if (setError) throw setError;
      const next = await loadContext(schoolId);
      setContext(next);
      await loadGroups(next);
    } catch (schoolError) {
      console.error("[TeacherStudents] school", schoolError);
      setError("That school could not be selected.");
    } finally {
      setLoading(false);
    }
  }

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(() => groups.map((group) => ({
    ...group,
    students: normalized ? group.students.filter((student) => student.name.toLowerCase().includes(normalized) || (student.admission_number ?? "").toLowerCase().includes(normalized)) : group.students,
  })).filter((group) => group.students.length > 0), [groups, normalized]);
  const total = groups.reduce((sum, group) => sum + group.students.length, 0);
  const activeSchool = context?.schools.find((school) => school.id === context.school_id)?.name ?? "No active school";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px" }}>
      <section style={{ background: "linear-gradient(135deg,#312e81,#4f46e5)", borderRadius: 20, padding: 18, color: "#fff", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", opacity: .72, letterSpacing: 1 }}>Learners</div>
        <h1 style={{ margin: "4px 0", fontSize: 23 }}>Students & progress</h1>
        <div style={{ fontSize: 12, opacity: .78 }}>{loading ? "Loading current enrollment…" : `${total} current learners across ${groups.length} assigned classes · ${activeSchool}`}</div>
        {context && context.schools.length > 1 && <select aria-label="Active school" value={context.school_id ?? ""} onChange={(event) => void changeSchool(event.target.value)} style={{ marginTop: 12, width: "100%", minHeight: 44, border: 0, borderRadius: 12, padding: "0 12px", background: "#fff", color: "#111827", fontWeight: 800 }}>{context.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>}
      </section>

      {error && <div role="alert" style={{ borderRadius: 14, background: "#fef2f2", color: "#991b1b", padding: 13, marginBottom: 12, fontSize: 13 }}>{error} <button type="button" onClick={() => void load()} style={{ border: 0, background: "transparent", color: "#991b1b", fontWeight: 900, textDecoration: "underline" }}>Retry</button></div>}

      <input aria-label="Search learners" type="search" placeholder="Search by name or admission number" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: "100%", minHeight: 47, border: "1px solid #d1d5db", borderRadius: 13, padding: "0 13px", background: "#fff", fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />

      {loading ? <div aria-label="Loading learners" style={{ display: "grid", gap: 9 }}>{[1,2,3].map((item) => <div key={item} style={{ height: 110, borderRadius: 17, background: "#e5e7eb" }} />)}</div> : context?.state === "needs_school" ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center" }}><h2 style={{ margin: 0, fontSize: 17 }}>Connect a school first</h2><p style={{ color: "#6b7280", fontSize: 13 }}>Learner access is granted through your school and class assignments.</p><button type="button" onClick={() => router.push("/teacher/onboarding/school")} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Connect school</button></section>
      ) : context?.state === "needs_class" ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center" }}><h2 style={{ margin: 0, fontSize: 17 }}>No class assignments yet</h2><p style={{ color: "#6b7280", fontSize: 13 }}>Once a class is assigned, its current learners will appear here automatically.</p><button type="button" onClick={() => router.push("/teacher/onboarding/class")} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Set up class</button></section>
      ) : groups.length === 0 ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center", color: "#6b7280", fontSize: 13 }}>No current learners are enrolled in your assigned classes.</section>
      ) : filtered.length === 0 ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center", color: "#6b7280", fontSize: 13 }}>No current learners match “{query}”.</section>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>{filtered.map((group) => <section key={group.id} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", border: "1px solid #e5e7eb", boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}><div style={{ padding: "11px 13px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}><div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>{group.name}{group.stream ? ` ${group.stream}` : ""}</div><div style={{ marginTop: 3, fontSize: 10, color: "#6b7280" }}>{group.subjects.join(" · ")} · {group.students.length} current learners</div></div>{group.students.map((student, index) => <button key={student.id} type="button" onClick={() => router.push(`/teacher/classhub/${group.id}/student/${student.id}`)} style={{ width: "100%", minHeight: 60, display: "flex", alignItems: "center", gap: 11, textAlign: "left", border: 0, borderBottom: index < group.students.length - 1 ? "1px solid #f3f4f6" : 0, background: "#fff", padding: "10px 13px" }}><div style={{ width: 37, height: 37, borderRadius: 99, display: "grid", placeItems: "center", flexShrink: 0, background: student.profile_id ? "#ecfdf5" : "#f3f4f6", color: student.profile_id ? "#065f46" : "#6b7280", fontWeight: 900 }}>{student.name.charAt(0).toUpperCase()}</div><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 900, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div><div style={{ marginTop: 2, fontSize: 10, color: "#9ca3af" }}>{student.admission_number ? `Adm · ${student.admission_number}` : "No admission number"}</div></div>{!student.profile_id && <span style={{ fontSize: 9, fontWeight: 800, color: "#0369a1", background: "#f0f9ff", borderRadius: 99, padding: "4px 8px" }}>Unclaimed</span>}<span aria-hidden="true" style={{ color: "#9ca3af", fontSize: 20 }}>›</span></button>)}</section>)}</div>
      )}
    </div>
  );
}
