"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useStudent } from "@/lib/student-context";
import { supabase } from "@/lib/supabase";
import Skel from "@/components/student/Skel";

interface ExItem {
  id:               string;
  title:            string;
  instructions:     string | null;
  status:           "pending" | "done";
  feedback:         string | null;
}

export default function StudentExercisesPage() {
  const { identity, loading: idLoading } = useStudent();
  const [list, setList]       = useState<ExItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (idLoading || !identity?.classId) { if (!idLoading) setLoading(false); return; }

    async function load() {
      const [exRes, subRes] = await Promise.all([
        supabase.from("exercises").select("id,title,instructions").eq("class_id", identity!.classId!).order("created_at", { ascending: false }),
        supabase.from("exercise_submissions").select("exercise_id,status,feedback").eq("student_id", identity!.studentId),
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
  }, [identity, idLoading]);

  if (loading) return <div style={{ padding: 24 }}><Skel h={80} /><Skel h={80} /><Skel h={80} /></div>;

  const pending = list.filter(e => e.status === "pending");
  const done    = list.filter(e => e.status === "done");

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--vs-text)" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4, color: "var(--vs-text)" }}>Exercises</h1>
      <p style={{ fontSize: 13, color: "var(--vs-muted)", marginBottom: 20 }}>In-class practice from your teacher.</p>

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--vs-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📐</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>No exercises yet</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {pending.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>To Do</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pending.map(e => (
                  <div key={e.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderLeft: "4px solid #f59e0b", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--vs-text)", marginBottom: 4 }}>{e.title}</div>
                    {e.instructions && <p style={{ fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.5, margin: "0 0 6px" }}>{e.instructions}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Done</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {done.map(e => (
                  <div key={e.id} style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderLeft: "4px solid #10b981", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--vs-text)" }}>{e.title}</div>
                      <span style={{ padding: "3px 8px", borderRadius: 20, background: "#d1fae5", color: "#065f46", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>Done</span>
                    </div>
                    {e.feedback && <p style={{ fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.5, margin: "6px 0 0" }}>{e.feedback}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
