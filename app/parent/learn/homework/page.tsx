"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TOKENS } from "@/lib/tokens";

interface Child { id: string; name: string; class_id: string | null; }
interface HWItem {
  id:        string;
  title:     string;
  subject:   string;
  due_date:  string;
  type:      string;
  status:    "pending" | "submitted" | "marked" | "overdue";
  mark:      number | null;
  childId:   string;
  childName: string;
}

function isOverdue(due: string): boolean {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(due); d.setHours(0,0,0,0);
  return d < today;
}

function daysUntil(d: string): number {
  const t = new Date(); t.setHours(0,0,0,0);
  const due = new Date(d); due.setHours(0,0,0,0);
  return Math.round((due.getTime()-t.getTime())/86400000);
}

function dueBadge(due: string, status: HWItem["status"]) {
  if (status==="marked")    return { label:"Marked",    bg:"#d1fae5", color:"#065f46" };
  if (status==="submitted") return { label:"Submitted", bg:"#dbeafe", color:"#1e40af" };
  if (status==="overdue")   return { label:"Overdue",   bg:"#fee2e2", color:"#991b1b" };
  const n = daysUntil(due);
  if (n===0) return { label:"Due Today",    bg:"#fef3c7", color:"#92400e" };
  if (n===1) return { label:"Due Tomorrow", bg:"#fff7ed", color:"#c2410c" };
  return { label:`Due in ${n}d`, bg:"#f0fdf4", color:"#166534" };
}

export default function ParentHomeworkPage() {
  const router = useRouter();
  const [children,     setChildren]     = useState<Child[]>([]);
  const [activeChild,  setActiveChild]  = useState<string | null>(null);
  const [hwList,       setHwList]       = useState<HWItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [hwLoading,    setHwLoading]    = useState(false);

  // Load parent's children
  useEffect(() => {
    async function loadChildren() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: links } = await supabase
        .from("parent_student_links")
        .select("student_id")
        .eq("parent_id", user.id);

      if (!links || links.length === 0) { setLoading(false); return; }

      const ids = links.map(l => l.student_id);
      const { data: students } = await supabase
        .from("students")
        .select("id, name, class_id")
        .in("id", ids)
        .order("name");

      const kids = (students ?? []) as Child[];
      setChildren(kids);
      if (kids.length > 0) setActiveChild(kids[0].id);
      setLoading(false);
    }
    loadChildren();
  }, []);

  // Load homework when active child changes
  useEffect(() => {
    if (!activeChild) return;
    const child = children.find(c => c.id === activeChild);
    if (!child?.class_id) { setHwList([]); return; }

    async function loadHW() {
      setHwLoading(true);
      const [hwRes, subRes] = await Promise.all([
        supabase.from("homework").select("id,title,subject,due_date,type").eq("class_id", child!.class_id!).order("due_date", { ascending: true }),
        supabase.from("homework_submissions").select("homework_id,status,mark").eq("student_id", activeChild!),
      ]);

      const subMap = new Map<string, { status: string; mark: number | null }>();
      for (const submission of subRes.data ?? []) {
        if (!submission.homework_id) continue;
        subMap.set(submission.homework_id, {
          status: submission.status,
          mark: submission.mark,
        });
      }

      const items: HWItem[] = ((hwRes.data ?? []) as { id:string; title:string; subject:string; due_date:string; type:string }[]).map(h => {
        const sub = subMap.get(h.id);
        let status: HWItem["status"] = "pending";
        if (sub?.status === "marked")    status = "marked";
        else if (sub?.status === "submitted") status = "submitted";
        else if (isOverdue(h.due_date))  status = "overdue";
        return { ...h, status, mark: sub?.mark ?? null, childId: activeChild!, childName: child!.name };
      });

      setHwList(items);
      setHwLoading(false);
    }
    loadHW();
  }, [activeChild, children]);

  const overdue   = hwList.filter(h => h.status === "overdue");
  const pending   = hwList.filter(h => h.status === "pending");
  const done      = hwList.filter(h => h.status === "submitted" || h.status === "marked");

  if (loading) return (
    <div style={{ padding: 24, fontFamily: TOKENS.fontFamily, color: TOKENS.textMuted, textAlign: "center" }}>Loading…</div>
  );

  if (children.length === 0) return (
    <div style={{ padding: 24, fontFamily: TOKENS.fontFamily, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: TOKENS.textPrimary, marginBottom: 6 }}>No children linked yet</div>
      <div style={{ fontSize: 13, color: TOKENS.textMuted }}>Ask your school to link your account to your child.</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px", fontFamily: TOKENS.fontFamily, color: TOKENS.textPrimary }}>

      {/* Child switcher */}
      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, background: "#f1f5f9", padding: 4, borderRadius: 14, marginBottom: 20 }}>
          {children.map(c => (
            <button key={c.id} onClick={() => setActiveChild(c.id)} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: TOKENS.fontFamily, cursor: "pointer", background: activeChild===c.id ? "#fff" : "transparent", color: activeChild===c.id ? TOKENS.textPrimary : TOKENS.textMuted, boxShadow: activeChild===c.id ? "0 2px 4px rgba(0,0,0,0.06)" : "none", transition: "all 0.2s" }}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Hero */}
      {overdue.length > 0 ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#991b1b", marginBottom: 4 }}>⚠️ {overdue.length} overdue</div>
          <div style={{ fontSize: 13, color: TOKENS.textPrimary }}>Action needed for {children.find(c=>c.id===activeChild)?.name}.</div>
        </div>
      ) : (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#166534", marginBottom: 4 }}>✅ All clear</div>
          <div style={{ fontSize: 13, color: TOKENS.textPrimary }}>{children.find(c=>c.id===activeChild)?.name} has no overdue work.</div>
        </div>
      )}

      {hwLoading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: TOKENS.textMuted }}>Loading homework…</div>
      ) : hwList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: TOKENS.textMuted }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>No homework posted yet</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {overdue.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>⚠️ Overdue</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {overdue.map(h => <HWCard key={h.id} h={h} onClick={() => router.push(`/parent/homework/${h.id}`)} />)}
              </div>
            </div>
          )}
          {pending.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: TOKENS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>⏳ Upcoming</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pending.map(h => <HWCard key={h.id} h={h} onClick={() => router.push(`/parent/homework/${h.id}`)} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>✅ Done</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {done.map(h => <HWCard key={h.id} h={h} onClick={() => router.push(`/parent/homework/${h.id}`)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HWCard({ h, onClick }: { h: HWItem; onClick: () => void }) {
  const badge = dueBadge(h.due_date, h.status);
  return (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", background: "#fff", border: "1px solid #e5e7eb", borderLeft: `5px solid ${h.status==="overdue"?"#ef4444":h.status==="marked"||h.status==="submitted"?"#10b981":"#f59e0b"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: TOKENS.textPrimary, flex: 1, lineHeight: 1.4 }}>{h.title}</div>
        <span style={{ padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>
      </div>
      <div style={{ fontSize: 12, color: TOKENS.textMuted }}>{h.subject} · Due {new Date(h.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</div>
      {h.status==="marked" && h.mark!==null && (
        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "#065f46" }}>Score: {h.mark} marks</div>
      )}
    </button>
  );
}
