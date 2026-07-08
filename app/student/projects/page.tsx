"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudent } from "@/lib/student-context";
import { supabase } from "@/lib/supabase";
import Skel from "@/components/student/Skel";

interface ProjItem {
  id:          string;
  title:       string;
  description: string | null;
  due_date:    string | null;
  status:      "pending" | "submitted" | "marked";
  mark:        number | null;
}

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  return d < today;
}

function badge(status: ProjItem["status"], overdue: boolean) {
  if (status === "marked")    return { label: "Marked",    bg: "#d1fae5", color: "#065f46" };
  if (status === "submitted") return { label: "Submitted", bg: "#d1fae5", color: "#065f46" };
  if (overdue)                return { label: "Overdue",   bg: "#fee2e2", color: "#991b1b" };
  return                             { label: "Pending",   bg: "#fef3c7", color: "#92400e" };
}

export default function StudentProjectsPage() {
  const router = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const [list, setList]       = useState<ProjItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (idLoading || !identity?.classId) { if (!idLoading) setLoading(false); return; }

    async function load() {
      const [projRes, subRes] = await Promise.all([
        supabase.from("projects").select("id,title,description,due_date").eq("class_id", identity!.classId!).eq("status", "active").order("due_date", { ascending: true }),
        supabase.from("project_submissions").select("project_id,status,mark").eq("student_id", identity!.studentId),
      ]);

      const subMap = new Map<string, { status: string; mark: number | null }>();
      for (const s of (subRes.data ?? [])) subMap.set(s.project_id, { status: s.status, mark: s.mark ?? null });

      const items: ProjItem[] = ((projRes.data ?? []) as { id: string; title: string; description: string | null; due_date: string | null }[]).map(p => {
        const sub = subMap.get(p.id);
        return { ...p, status: (sub?.status as ProjItem["status"]) ?? "pending", mark: sub?.mark ?? null };
      });

      setList(items);
      setLoading(false);
    }
    load();
  }, [identity, idLoading]);

  if (loading) return <div style={{ padding: 24 }}><Skel h={90} /><Skel h={90} /></div>;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--vs-text)" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4, color: "var(--vs-text)" }}>Projects</h1>
      <p style={{ fontSize: 13, color: "var(--vs-muted)", marginBottom: 20 }}>Longer-term work — submit a photo of your progress.</p>

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--vs-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🛠️</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>No projects yet</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map(p => {
            const overdue = isOverdue(p.due_date) && p.status === "pending";
            const b = badge(p.status, overdue);
            return (
              <button key={p.id} onClick={() => router.push(`/student/projects/${p.id}`)} style={{ width: "100%", textAlign: "left", background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderLeft: `4px solid ${overdue ? "#ef4444" : p.status === "pending" ? "#f59e0b" : "#10b981"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--vs-text)", flex: 1 }}>{p.title}</div>
                  <span style={{ padding: "3px 8px", borderRadius: 20, background: b.bg, color: b.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{b.label}</span>
                </div>
                {p.due_date && <div style={{ fontSize: 12, color: "var(--vs-muted)" }}>Due {new Date(p.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</div>}
                {p.status === "marked" && p.mark !== null && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#065f46" }}>Score: {p.mark}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
