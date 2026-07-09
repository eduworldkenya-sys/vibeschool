"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ChildOption { id: string; name: string; classId: string | null; className: string; }
interface ProjItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "submitted" | "marked";
  mark: number | null;
  feedback: string | null;
}

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  return d < today;
}

function badge(status: ProjItem["status"], overdue: boolean) {
  if (status === "marked")    return { label: "Marked",    bg: "#d1fae5", color: "#065f46" };
  if (status === "submitted") return { label: "Submitted", bg: "#dbeafe", color: "#1e40af" };
  if (overdue)                return { label: "Overdue",   bg: "#fee2e2", color: "#991b1b" };
  return                             { label: "Pending",   bg: "#fef3c7", color: "#92400e" };
}

export default function ParentProjectsPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [activeChildId, setActiveChildId] = useState("");
  const [list, setList] = useState<ProjItem[]>([]);
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
      const [projRes, subRes] = await Promise.all([
        supabase.from("projects").select("id,title,description,due_date").eq("class_id", child!.classId!).eq("status", "active").order("due_date", { ascending: true }),
        supabase.from("project_submissions").select("project_id,status,mark,feedback").eq("student_id", activeChildId),
      ]);
      const subMap = new Map<string, { status: string; mark: number | null; feedback: string | null }>();
      for (const s of (subRes.data ?? [])) subMap.set(s.project_id, { status: s.status, mark: s.mark ?? null, feedback: s.feedback ?? null });

      const items: ProjItem[] = ((projRes.data ?? []) as { id: string; title: string; description: string | null; due_date: string | null }[]).map(p => {
        const sub = subMap.get(p.id);
        return { ...p, status: (sub?.status as ProjItem["status"]) ?? "pending", mark: sub?.mark ?? null, feedback: sub?.feedback ?? null };
      });
      setList(items);
      setLoading(false);
    }
    load();
  }, [activeChildId, children]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px", fontFamily: "system-ui, sans-serif" }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16 }}>← Back</button>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Projects</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Longer-term project work.</p>

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
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛠️</div>
          <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 600 }}>No projects recorded yet.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map(p => {
            const overdue = isOverdue(p.due_date) && p.status === "pending";
            const b = badge(p.status, overdue);
            return (
              <div key={p.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", borderLeft: `4px solid ${overdue ? "#ef4444" : p.status === "pending" ? "#f59e0b" : "#10b981"}`, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{p.title}</div>
                  <span style={{ padding: "3px 8px", borderRadius: 20, background: b.bg, color: b.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{b.label}</span>
                </div>
                {p.description && <p style={{ fontSize: 12, color: "#6b7280", margin: "6px 0 0", lineHeight: 1.5 }}>{p.description}</p>}
                {p.due_date && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Due {new Date(p.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</div>}
                {p.status === "marked" && p.mark !== null && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "#065f46" }}>Score: {p.mark}</div>}
                {p.feedback && <p style={{ fontSize: 12, color: "#065f46", margin: "8px 0 0", lineHeight: 1.5, background: "#f0fdf4", borderRadius: 8, padding: "8px 10px" }}>{p.feedback}</p>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
