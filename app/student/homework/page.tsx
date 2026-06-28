"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import { readCache, writeCache } from "@/lib/student-cache";
import Skel from "@/components/student/Skel";
import { Homework, HomeworkSubmission } from "@/lib/types";

interface HWListItem extends Homework {
  status: "pending" | "submitted" | "marked";
  mark:   number | null;
}

type Filter = "all" | "pending" | "submitted" | "overdue";

function isOverdue(due: string): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  return d < today;
}

function daysUntil(d: string): number {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - t.getTime()) / 86400000);
}

function dueBadge(due: string, status: HWListItem["status"]) {
  if (status === "marked")    return { label: "Marked",    bg: "#d1fae5", color: "#065f46" };
  if (status === "submitted") return { label: "Submitted", bg: "#d1fae5", color: "#065f46" };
  const n = daysUntil(due);
  if (n < 0)   return { label: "Overdue",     bg: "#fee2e2", color: "#991b1b" };
  if (n === 0) return { label: "Due Today",   bg: "#fef3c7", color: "#92400e" };
  if (n <= 2)  return { label: `Due in ${n}d`, bg: "#fff7ed", color: "#c2410c" };
  return { label: `Due in ${n}d`, bg: "var(--vs-accent-soft)", color: "var(--vs-accent)" };
}

function IconWork() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function HomeworkListPage() {
  const router  = useRouter();
  const { identity, loading: idLoading } = useStudent();
  const [items,   setItems]   = useState<HWListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<Filter>("all");

  useEffect(() => {
    if (idLoading || !identity || !identity.classId) { setLoading(false); return; }

    const cached = readCache<HWListItem[]>("homework", identity.studentId);
    if (cached) { setItems(cached); setLoading(false); }

    async function load() {
      let hwQuery = supabase
        .from("homework")
        .select("*")
        .eq("class_id", identity!.classId)
        .order("due_date", { ascending: true });

      if (identity!.schoolId) {
        hwQuery = hwQuery.eq("school_id", identity!.schoolId);
      }

      const [hwRes, subRes] = await Promise.all([
        hwQuery,
        supabase.from("homework_submissions").select("*").eq("student_id", identity!.studentId),
      ]);

      const subMap = new Map<string, HomeworkSubmission>();
      for (const s of (subRes.data as HomeworkSubmission[] | null) ?? []) {
        subMap.set(s.homework_id, s);
      }

      const result: HWListItem[] = ((hwRes.data as Homework[] | null) ?? []).map(h => {
        const sub = subMap.get(h.id);
        return { ...h, status: sub?.status ?? "pending", mark: sub?.mark ?? null };
      });

      writeCache("homework", identity!.studentId, result);
      setItems(result);
      setLoading(false);
    }
    load();
  }, [identity, idLoading]);

  const pending   = items.filter(h => h.status === "pending" && !isOverdue(h.due_date));
  const submitted = items.filter(h => h.status === "submitted" || h.status === "marked");
  const overdue   = items.filter(h => h.status === "pending" && isOverdue(h.due_date));

  const filtered = filter === "pending"   ? pending
    : filter === "submitted" ? submitted
    : filter === "overdue"   ? overdue
    : items;

  const isLoading = idLoading || (loading && items.length === 0);

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <Skel h={90} radius={16} /><Skel h={44} radius={12} />
      <Skel h={80} radius={12} /><Skel h={80} radius={12} /><Skel h={80} radius={12} />
    </div>
  );

  if (!identity?.classId) return (
    <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>No class assigned yet — homework will appear here once you are added to a class.</div>
    </div>
  );

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all",       label: "All",       count: items.length     },
    { id: "pending",   label: "Pending",   count: pending.length   },
    { id: "submitted", label: "Submitted", count: submitted.length },
    { id: "overdue",   label: "Overdue",   count: overdue.length   },
  ];

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>
      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", borderRadius: 20, padding: "16px", marginBottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 4 }}>MY ASSIGNMENTS</div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 12 }}>Homework</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Total",     value: items.length },
            { label: "Pending",   value: pending.length,  alert: pending.length > 0 },
            { label: "Submitted", value: submitted.length },
            { label: "Overdue",   value: overdue.length,  alert: overdue.length > 0 },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: (s as {alert?:boolean}).alert ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            flexShrink: 0, padding: "8px 14px", borderRadius: 20, border: "none",
            cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
            background: filter === f.id ? "#0f766e" : "var(--vs-card)",
            color:      filter === f.id ? "#fff"    : "var(--vs-muted)",
            boxShadow:  filter === f.id ? "0 2px 8px rgba(15,118,110,0.3)" : "none",
          }}>
            {f.label} {f.count > 0 && <span style={{ opacity: 0.75 }}>· {f.count}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ color: "var(--vs-muted)", display: "flex", justifyContent: "center", marginBottom: 12 }}><IconWork /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--vs-text)", marginBottom: 6 }}>
            {filter === "all" ? "No homework yet" : `No ${filter} homework`}
          </div>
          <div style={{ fontSize: 12, color: "var(--vs-muted)" }}>
            {filter === "all" ? "Your teacher has not posted any assignments yet." : "Nothing here right now."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(h => {
            const badge = dueBadge(h.due_date, h.status);
            const overdueItem = h.status === "pending" && isOverdue(h.due_date);
            return (
              <button
                key={h.id}
                onClick={() => router.push(`/student/homework/${h.id}`)}
                style={{
                  width: "100%", background: "var(--vs-card)", border: "none",
                  borderRadius: 14, padding: 0, cursor: "pointer", fontFamily: "inherit",
                  textAlign: "left",
                  borderLeft: `4px solid ${overdueItem ? "#ef4444" : h.status !== "pending" ? "#10b981" : "#0f766e"}`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)", flex: 1, lineHeight: 1.4 }}>{h.title}</div>
                    <span style={{ padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: h.instructions ? 8 : 0 }}>
                    <span style={{ fontSize: 11, color: "var(--vs-muted)" }}>{h.subject}</span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--vs-border)", flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "var(--vs-surface)", color: "var(--vs-muted)" }}>{h.type === "smart" ? "Smart" : "Book"}</span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--vs-border)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--vs-muted)" }}>
                      Due {new Date(h.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  {h.instructions && (
                    <div style={{ fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {h.instructions}
                    </div>
                  )}
                  {h.status === "marked" && h.mark !== null && (
                    <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#d1fae5", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#065f46" }}>
                      <IconCheck /> {h.mark} marks
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <span style={{ color: "var(--vs-muted)" }}><IconArrow /></span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
