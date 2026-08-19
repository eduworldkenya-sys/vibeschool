"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nairobiDateStr } from "@/lib/time";

type Context = {
  teacher_id: string;
  school_id: string | null;
  state: "ready" | "needs_school" | "needs_class";
  schools: Array<{ id: string; name: string; active: boolean }>;
  classes: Array<{ class_id: string; class_name: string; stream: string | null; subject_id: string; subject_name: string }>;
};

type HomeworkItem = {
  id: string;
  title: string;
  subject: string;
  due_date: string;
  type: string;
  class_id: string;
  class_name: string;
  class_stream: string;
  submitted: number;
  roster: number;
};

type Filter = "all" | "active" | "overdue";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
}

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async (requestedSchoolId?: string | null) => {
    const { data, error: contextError } = await supabase.rpc("teacher_get_operating_context", {
      p_requested_school_id: requestedSchoolId ?? undefined,
    });
    if (contextError) throw contextError;
    return data as unknown as Context;
  }, []);

  const loadItems = useCallback(async (ctx: Context) => {
    if (!ctx.school_id || ctx.classes.length === 0) {
      setItems([]);
      return;
    }
    const classIds = Array.from(new Set(ctx.classes.map((item) => item.class_id)));
    const classMap = new Map<string, { name: string; stream: string }>();
    for (const assignment of ctx.classes) {
      if (!classMap.has(assignment.class_id)) {
        classMap.set(assignment.class_id, {
          name: assignment.class_name,
          stream: assignment.stream ?? "",
        });
      }
    }

    const [homeworkRes, rosterRes] = await Promise.all([
      supabase
        .from("homework")
        .select("id,title,subject,due_date,type,class_id,homework_submissions(id)")
        .eq("teacher_id", ctx.teacher_id)
        .eq("school_id", ctx.school_id)
        .in("class_id", classIds)
        .order("due_date", { ascending: false }),
      supabase
        .from("student_classes")
        .select("class_id,student_id")
        .eq("school_id", ctx.school_id)
        .eq("is_current", true)
        .in("class_id", classIds),
    ]);
    if (homeworkRes.error) throw homeworkRes.error;
    if (rosterRes.error) throw rosterRes.error;

    const rosterCounts = new Map<string, number>();
    for (const row of rosterRes.data ?? []) {
      rosterCounts.set(row.class_id, (rosterCounts.get(row.class_id) ?? 0) + 1);
    }

    setItems(((homeworkRes.data ?? []) as any[]).map((row) => {
      const cls = classMap.get(row.class_id);
      return {
        id: row.id,
        title: row.title,
        subject: row.subject ?? "",
        due_date: row.due_date,
        type: row.type ?? "assignment",
        class_id: row.class_id,
        class_name: cls?.name ?? "Class",
        class_stream: cls?.stream ?? "",
        submitted: Array.isArray(row.homework_submissions) ? row.homework_submissions.length : 0,
        roster: rosterCounts.get(row.class_id) ?? 0,
      } satisfies HomeworkItem;
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
      await loadItems(ctx);
    } catch (loadError) {
      console.error("[TeacherHomework] load", loadError);
      setError("Homework could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [loadContext, loadItems, router]);

  useEffect(() => { void load(); }, [load]);

  async function changeSchool(schoolId: string) {
    if (!schoolId || schoolId === context?.school_id) return;
    setLoading(true);
    setError(null);
    try {
      const { error: setSchoolError } = await supabase.rpc("teacher_set_active_school", { p_school_id: schoolId });
      if (setSchoolError) throw setSchoolError;
      const next = await loadContext(schoolId);
      setContext(next);
      await loadItems(next);
    } catch (schoolError) {
      console.error("[TeacherHomework] school", schoolError);
      setError("That school could not be selected. Your previous school remains active.");
    } finally {
      setLoading(false);
    }
  }

  const today = nairobiDateStr();
  const active = useMemo(() => items.filter((item) => item.due_date.slice(0, 10) >= today), [items, today]);
  const overdue = useMemo(() => items.filter((item) => item.due_date.slice(0, 10) < today), [items, today]);
  const shown = filter === "active" ? active : filter === "overdue" ? overdue : items;
  const submittedTotal = items.reduce((sum, item) => sum + item.submitted, 0);
  const rosterTotal = items.reduce((sum, item) => sum + item.roster, 0);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px" }}>
      <section style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", borderRadius: 20, padding: 18, color: "#fff", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", opacity: .72, letterSpacing: 1 }}>Homework</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div><h1 style={{ margin: "4px 0 0", fontSize: 23 }}>Assignments & learner work</h1><div style={{ marginTop: 4, fontSize: 12, opacity: .78 }}>Current school · current class memberships</div></div>
          <button type="button" onClick={() => router.push("/teacher/pulse")} style={{ minWidth: 44, minHeight: 44, border: 0, borderRadius: 12, background: "rgba(255,255,255,.16)", color: "#fff", fontSize: 20 }}>‹</button>
        </div>

        {context && context.schools.length > 1 && (
          <select aria-label="Active school" value={context.school_id ?? ""} onChange={(event) => void changeSchool(event.target.value)} style={{ marginTop: 12, width: "100%", minHeight: 44, border: 0, borderRadius: 12, padding: "0 12px", background: "#fff", color: "#111827", fontWeight: 800 }}>
            {context.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginTop: 12 }}>
          {[{ label: "Assignments", value: items.length }, { label: "Submitted", value: submittedTotal }, { label: "Expected", value: rosterTotal }].map((metric) => (
            <div key={metric.label} style={{ borderRadius: 11, padding: "8px 5px", textAlign: "center", background: "rgba(255,255,255,.14)" }}><div style={{ fontSize: 17, fontWeight: 900 }}>{metric.value}</div><div style={{ fontSize: 9, opacity: .72 }}>{metric.label}</div></div>
          ))}
        </div>
      </section>

      {error && <div role="alert" style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 13, marginBottom: 12, fontSize: 13 }}>{error} <button type="button" onClick={() => void load()} style={{ border: 0, background: "transparent", color: "#991b1b", fontWeight: 900, textDecoration: "underline" }}>Retry</button></div>}

      {context?.state === "needs_school" ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center" }}><h2 style={{ margin: 0, fontSize: 17 }}>Connect a school first</h2><p style={{ color: "#6b7280", fontSize: 13 }}>Homework must belong to an authorized school and class.</p><button type="button" onClick={() => router.push("/teacher/onboarding/school")} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Connect school</button></section>
      ) : context?.state === "needs_class" ? (
        <section style={{ background: "#fff", borderRadius: 18, padding: 28, textAlign: "center" }}><h2 style={{ margin: 0, fontSize: 17 }}>No class assignment yet</h2><p style={{ color: "#6b7280", fontSize: 13 }}>Set up a class before creating learner work.</p><button type="button" onClick={() => router.push("/teacher/onboarding/class")} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Set up class</button></section>
      ) : (
        <>
          <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 12 }}>
            {(["all", "active", "overdue"] as Filter[]).map((value) => (
              <button key={value} type="button" onClick={() => setFilter(value)} style={{ minHeight: 40, border: filter === value ? "1px solid #0f766e" : "1px solid #e5e7eb", borderRadius: 99, background: filter === value ? "#0f766e" : "#fff", color: filter === value ? "#fff" : "#374151", padding: "0 15px", fontWeight: 900, textTransform: "capitalize" }}>{value}</button>
            ))}
          </div>

          {loading ? (
            <div aria-label="Loading homework" style={{ display: "grid", gap: 9 }}>{[1,2,3].map((item) => <div key={item} style={{ height: 100, borderRadius: 16, background: "#e5e7eb" }} />)}</div>
          ) : shown.length === 0 ? (
            <section style={{ background: "#fff", borderRadius: 18, padding: 30, textAlign: "center", boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}><h2 style={{ margin: 0, fontSize: 17 }}>No homework here</h2><p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5 }}>Create work from a class or directly from a lesson so class, subject and teaching evidence stay linked.</p>{context?.classes[0]?.class_id && <button type="button" onClick={() => router.push(`/teacher/classhub/${context.classes[0].class_id}/homework`)} style={{ minHeight: 44, border: 0, borderRadius: 12, background: "#0f766e", color: "#fff", padding: "0 16px", fontWeight: 900 }}>Open class homework</button>}</section>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {shown.map((item) => {
                const isOverdue = item.due_date.slice(0, 10) < today;
                const percentage = item.roster > 0 ? Math.round((item.submitted / item.roster) * 100) : 0;
                return (
                  <button key={item.id} type="button" onClick={() => router.push(`/teacher/classhub/${item.class_id}/homework/${item.id}`)} style={{ width: "100%", minHeight: 102, textAlign: "left", border: "1px solid #e5e7eb", borderLeft: `4px solid ${isOverdue ? "#ef4444" : "#0f766e"}`, borderRadius: 16, background: "#fff", padding: 14, boxShadow: "0 1px 5px rgba(0,0,0,.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{item.title}</div><div style={{ marginTop: 3, fontSize: 11, color: "#6b7280" }}>{item.class_name}{item.class_stream ? ` ${item.class_stream}` : ""}{item.subject ? ` · ${item.subject}` : ""}</div></div><div style={{ flexShrink: 0, textAlign: "right" }}><div style={{ fontSize: 10, fontWeight: 900, color: isOverdue ? "#991b1b" : "#065f46" }}>{isOverdue ? "Overdue" : "Active"}</div><div style={{ marginTop: 3, fontSize: 10, color: "#6b7280" }}>Due {formatDate(item.due_date)}</div></div></div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: "#374151" }}><span style={{ textTransform: "capitalize" }}>{item.type}</span><strong>{item.submitted}/{item.roster} submitted</strong></div>
                    <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}><div style={{ width: `${Math.min(100, percentage)}%`, height: "100%", background: isOverdue && percentage < 100 ? "#ef4444" : "#0f766e" }} /></div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
