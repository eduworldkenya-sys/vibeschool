"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TOKENS } from "@/lib/tokens";

interface HWDetail {
  id:           string;
  title:        string;
  subject:      string;
  instructions: string | null;
  due_date:     string;
  type:         string;
  teacher_name: string;
}
interface Submission {
  status:   string;
  mark:     number | null;
  feedback: string | null;
  photo_url: string | null;
}

function autoBandLabel(mark: number): string {
  if (mark >= 80) return "Excellent";
  if (mark >= 60) return "Good";
  if (mark >= 40) return "Fair";
  return "Needs Improvement";
}

function daysUntil(d: string): number {
  const t = new Date(); t.setHours(0,0,0,0);
  const due = new Date(d); due.setHours(0,0,0,0);
  return Math.round((due.getTime()-t.getTime())/86400000);
}

function dueBadge(due: string, status: string) {
  if (status==="marked")    return { label:"Marked",    bg:"#d1fae5", color:"#065f46" };
  if (status==="submitted") return { label:"Submitted", bg:"#dbeafe", color:"#1e40af" };
  const n = daysUntil(due);
  if (n<0)  return { label:"Overdue",      bg:"#fee2e2", color:"#991b1b" };
  if (n===0) return { label:"Due Today",   bg:"#fef3c7", color:"#92400e" };
  if (n===1) return { label:"Due Tomorrow",bg:"#fff7ed", color:"#c2410c" };
  return { label:`Due in ${n}d`, bg:"#f0fdf4", color:"#166534" };
}

export default function ParentHomeworkDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [hw,     setHw]     = useState<HWDetail | null>(null);
  const [sub,    setSub]    = useState<Submission | null>(null);
  const [loading,setLoading]= useState(true);
  const [childName, setChildName] = useState("");

  useEffect(() => {
    if (!id) return;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get parent's linked student IDs
      const { data: links } = await supabase.from("parent_student_links").select("student_id").eq("parent_id", user.id);
      const studentIds = (links ?? []).map(l => l.student_id);
      if (studentIds.length === 0) { setLoading(false); return; }

      const { data: hwRaw } = await supabase.from("homework").select("id,title,subject,instructions,due_date,type,teacher_id").eq("id", id).maybeSingle();
      if (!hwRaw) { setLoading(false); return; }

      const [teachRes, subRes, stuRes] = await Promise.all([
        hwRaw.teacher_id
          ? supabase.from("profiles").select("full_name").eq("id", hwRaw.teacher_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("homework_submissions").select("status,mark,feedback,photo_url").eq("homework_id", id).in("student_id", studentIds).maybeSingle(),
        supabase.from("students").select("name").in("id", studentIds).limit(1).maybeSingle(),
      ]);

      setHw({
        id: hwRaw.id,
        title: hwRaw.title,
        subject: hwRaw.subject ?? "Subject",
        instructions: hwRaw.instructions,
        due_date: hwRaw.due_date ?? new Date().toISOString(),
        type: hwRaw.type,
        teacher_name: teachRes.data?.full_name ?? "Teacher",
      });
      setSub(subRes.data ?? null);
      setChildName(stuRes.data?.name ?? "");
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: TOKENS.textMuted, fontFamily: TOKENS.fontFamily }}>Loading…</div>;
  if (!hw)     return <div style={{ padding: 24, textAlign: "center", color: TOKENS.textMuted, fontFamily: TOKENS.fontFamily }}>Assignment not found.</div>;

  const badge = dueBadge(hw.due_date, sub?.status ?? "pending");

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 100px", fontFamily: TOKENS.fontFamily, color: TOKENS.textPrimary }}>

      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: TOKENS.textMuted, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
        ← Back
      </button>

      {/* Header card */}
      <div style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)", borderRadius: 16, padding: 16, marginBottom: 16, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.3, margin: 0, flex: 1 }}>{hw.title}</h1>
          <span style={{ padding: "4px 10px", borderRadius: 20, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{badge.label}</span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
          {hw.subject} · {hw.teacher_name} · Due {new Date(hw.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
        </div>
        {childName && <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>👤 {childName}</div>}
      </div>

      {/* Instructions */}
      {hw.instructions && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: TOKENS.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Instructions</div>
          <p style={{ fontSize: 13, color: TOKENS.textPrimary, lineHeight: 1.7, margin: 0 }}>{hw.instructions}</p>
        </div>
      )}

      {/* Submission status */}
      {!sub ? (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#92400e" }}>Not submitted yet</div>
          <div style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>Remind {childName || "your child"} to complete and submit this.</div>
        </div>
      ) : sub.status === "marked" ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Teacher Feedback</div>
          {sub.mark !== null && (
            <div style={{ fontSize: 22, fontWeight: 800, color: "#166534", marginBottom: 4 }}>
              {sub.mark} marks · <span style={{ fontSize: 15 }}>{autoBandLabel(sub.mark)}</span>
            </div>
          )}
          {sub.feedback && <p style={{ fontSize: 13, color: TOKENS.textPrimary, lineHeight: 1.6, margin: 0 }}>{sub.feedback}</p>}
        </div>
      ) : (
        <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1e40af" }}>✅ Submitted — waiting for teacher to mark</div>
        </div>
      )}

      {/* Photo proof */}
      {sub?.photo_url && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: TOKENS.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Submitted Work</div>
          <img src={sub.photo_url} alt="Submitted work" style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 320 }} />
        </div>
      )}
    </div>
  );
}
