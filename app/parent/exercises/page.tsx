"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ChildOption { id: string; name: string; classId: string | null; className: string; }
interface ExItem {
  id: string;
  title: string;
  instructions: string | null;
  status: "pending" | "done";
  feedback: string | null;
}

export default function ParentExercisesPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeChildId, setActiveChildId] = useState("");
  const [list, setList] = useState<ExItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChildren() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) { router.push("/login"); return; }

      const { data: links } = await supabase.from("parent_student_links").select("student_id").eq("parent_id", authData.user.id);
      if (!links || links.length === 0) { setError("No linked child profiles found."); setLoading(false); return; }

      const { data: students } = await supabase.from("students").select("id, name, class_id, classes(name, stream)").in("id", links.map(l => l.student_id));
      const mapped: ChildOption[] = (students ?? []).map(s => {
        const cls = s.classes as unknown as { name: string; stream: string } | null;
        return { id: s.id, name: s.name, classId: s.class_id ?? null, className: cls ? `${cls.name} ${cls.stream}`.trim() : "Unassigned" };
      });
      setChildren(mapped);
      if (mapped.length > 0) setActiveChildId(mapped[0].id);
      else { setError("No registered child profiles found."); setLoading(false); }
    }
    loadChildren();
  }, [router]);

  useEffect(() => {
    if (!activeChildId) return;
    const child = children.find(c => c.id === activeChildId);
    if (!child?.classId) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      const [exRes, subRes] = await Promise.all([
        supabase.from("exercises").select("id,title,instructions").eq("class_id", child!.classId!).order("created_at", { ascending: false }),
        supabase.from("exercise_submissions").select("exercise_id,status,feedback").eq("student_id", activeChildId),
      ]);
      const subMap = new Map<string, { status: string; feedback: string | null }>();
      for (const s of (subRes.data ?? [])) subMap.set(s.exercise_id, { status: s.status, feedback: s.feedback ?? null });

      const items: ExItem[] = (exRes.data ?? []).map(e => {
        const sub = subMap.get(e.id);
        return { ...e, status: sub?.status === "marked" ? "done" : "pending", feedback: sub?.feedback ?? null };
      });
      setList(items);
      setLoading(false);
    }
    load();
  }, [activeChildId, children]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px", fontFamily: "system-ui, sans-serif" }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16 }}>← Back</button>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Exercises</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>In-class practice status.</p>

      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {children.map(c => (
            <button key={c.id} onClick={() => setActiveChildId(c.id)} style={{ padding: "8px 14px", borderRadius: 20, border: "1px solid #e5e7eb", background: c.id === activeChildId ? "#111827" : "#fff", color: c.id === activeChildId ? "#fff" : "#111827", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              {c.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {error && <div style={{ padding: "48px 24px", textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb", color: "#6b7280", fontSize: 13 }}>{error}</div>}

      {!error && (loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📐</div>
          <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 600 }}>No exercises recorded yet.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map(e => (
            <div key={e.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", borderLeft: `4px solid ${e.status === "done" ? "#10b981" : "#f59e0b"}`, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{e.title}</div>
                <span style={{ padding: "3px 8px", borderRadius: 20, background: e.status === "done" ? "#d1fae5" : "#fef3c7", color: e.status === "done" ? "#065f46" : "#92400e", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {e.status === "done" ? "Done" : "Pending"}
                </span>
              </div>
              {e.instructions && <p style={{ fontSize: 12, color: "#6b7280", margin: "6px 0 0", lineHeight: 1.5 }}>{e.instructions}</p>}
              {e.feedback && <p style={{ fontSize: 12, color: "#065f46", margin: "8px 0 0", lineHeight: 1.5, background: "#f0fdf4", borderRadius: 8, padding: "8px 10px" }}>{e.feedback}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
