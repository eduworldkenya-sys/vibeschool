"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import { getTwinAuthorityContext, requireTwinRole } from "@/lib/twin/core";

interface Message { role: "user" | "twin"; text: string; }
interface Props { open: boolean; onClose: () => void; }
type RpcResult<T> = { data: T | null; error: { message?: string } | null };
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

type ChildDetail = {
  child: { id: string; name: string; className: string; schoolName: string };
  todayAttendance: { status?: string }[];
  attendance: { recorded: number; percentage: number | null };
  mastery: { subject: string; mastered: number; assessed: number; total: number }[];
};

type ChildSummary = ChildDetail & { statusLabel: string; needsAttention: boolean };
const HELP = "I work from your authorized VibeSchool family relationships without generative AI. Ask about your children, attendance today, class or school, recorded learning progress, which child needs attention, or what to do next.";

function rec(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function num(value: unknown): number | null { const n = typeof value === "number" ? value : Number(value); return Number.isFinite(n) ? n : null; }

function parseChildDetail(value: unknown): ChildDetail {
  const row = rec(value), child = rec(row.child), attendance = rec(row.attendance);
  return {
    child: { id: text(child.id), name: text(child.name) || "Child", className: text(child.class_name) || "Class not assigned", schoolName: text(child.school_name) || "School not assigned" },
    todayAttendance: (Array.isArray(row.today_attendance) ? row.today_attendance : []).map(item => ({ status: text(rec(item).status) })),
    attendance: { recorded: num(attendance.recorded) ?? 0, percentage: num(attendance.percentage) },
    mastery: (Array.isArray(row.mastery) ? row.mastery : []).map(item => { const m = rec(item); return { subject: text(m.subject) || "Subject", mastered: num(m.mastered) ?? 0, assessed: num(m.assessed) ?? 0, total: num(m.total) ?? 0 }; }),
  };
}

function summarise(detail: ChildDetail): ChildSummary {
  const pct = detail.attendance.percentage;
  const insufficient = detail.attendance.recorded < 5 || pct === null;
  const needsAttention = !insufficient && pct < 80;
  return { ...detail, needsAttention, statusLabel: insufficient ? "Not enough recent attendance evidence" : needsAttention ? "Attendance needs attention" : "Attendance evidence is on track" };
}

export default function ParentTwinDrawer({ open, onClose }: Props) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    void (async () => {
      try {
        const authority = await getTwinAuthorityContext();
        const bindings = requireTwinRole(authority, "parent");
        const learnerIds = Array.from(new Set(bindings.flatMap(binding => binding.resourceIds)));
        const details = await Promise.all(learnerIds.map(async studentId => {
          const { data, error } = await rpc<Json>("get_parent_child_dashboard", { p_student_id: studentId });
          if (error) throw new Error(error.message || "Child dashboard unavailable");
          return summarise(parseChildDetail(data));
        }));
        setChildren(details);
        const attention = details.filter(child => child.needsAttention).length;
        setMessages([{ role: "twin", text: details.length === 0 ? "No active linked learner is available in your Parent Twin scope." : `I can see ${details.length} linked ${details.length === 1 ? "child" : "children"} through your authorized family relationships. ${attention > 0 ? `${attention} attendance pattern needs attention.` : "No high-priority attendance pattern is currently detected."}` }]);
      } catch (error) {
        setMessages([{ role: "twin", text: error instanceof Error ? error.message : "Parent Twin could not resolve your authorized family role." }]);
      }
    })();
  }, []);

  useEffect(() => { if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking, open]);

  function findChild(query: string): ChildSummary | null {
    const q = query.toLowerCase();
    const named = children.find(child => q.includes(child.child.name.toLowerCase()) || q.includes(child.child.name.split(/\s+/)[0]?.toLowerCase()));
    return named ?? (children.length === 1 ? children[0] : null);
  }

  function resolve(query: string): string {
    const q = query.toLowerCase().replace(/\s+/g, " ").trim();
    if (/children|linked child|who are my/.test(q)) return children.length ? children.map(child => `${child.child.name} — ${child.child.className}, ${child.child.schoolName}. ${child.statusLabel}.`).join("\n") : "No active linked learner is available.";
    if (/attention|worry|concern|what should|what next/.test(q)) {
      const attention = children.filter(child => child.needsAttention);
      return attention.length ? attention.map(child => `${child.child.name}: ${child.statusLabel}; ${child.attendance.percentage}% across ${child.attendance.recorded} recent attendance records.`).join("\n") : "No high-priority attendance pattern is currently detected. Missing or sparse evidence is not treated as a positive result.";
    }
    const child = findChild(q);
    if (!child) return children.length > 1 ? "Name the child you mean so Twin can keep the family scope precise." : HELP;
    if (/class|school/.test(q)) return `${child.child.name} is recorded in ${child.child.className} at ${child.child.schoolName}.`;
    if (/attendance|present|absent|today/.test(q)) {
      const today = child.todayAttendance[0]?.status || "not marked";
      const recent = child.attendance.recorded < 5 || child.attendance.percentage === null ? `Only ${child.attendance.recorded} recent attendance records are available, so I will not infer a reliable pattern.` : `Recent 30-day attendance is ${child.attendance.percentage}% across ${child.attendance.recorded} recorded days.`;
      return `${child.child.name}: today is ${today}. ${recent}`;
    }
    if (/performance|progress|mastery|doing|learning|subject/.test(q)) return child.mastery.length ? `${child.child.name}'s recorded learning evidence:\n${child.mastery.map(m => `${m.subject}: ${m.mastered}/${m.total} outcomes mastered; ${m.assessed}/${m.total} assessed`).join("\n")}` : `${child.child.name} does not yet have enough recorded learning-outcome evidence for a subject summary. Missing evidence is not treated as good or bad performance.`;
    return HELP;
  }

  async function send() {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim(); setInput(""); setMessages(m => [...m, { role: "user", text: userMsg }]); setThinking(true);
    try { setMessages(m => [...m, { role: "twin", text: resolve(userMsg) }]); }
    finally { setThinking(false); }
  }

  const accent = "#10b981", accentLight = "rgba(16,185,129,0.12)", dark = "#1e1b4b", surface = "#f8fafc", border = "#e2e8f0", textPrimary = "#0f172a";
  return <>{open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }} />}<div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: open ? 80 : -520, zIndex: 790, width: "calc(100% - 32px)", maxWidth: 600, background: "#fff", borderRadius: 20, boxShadow: "0 -4px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", height: 440, transition: "bottom .34s cubic-bezier(.34,1.56,.64,1)", overflow: "hidden" }}><div style={{ background: dark, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Parent Twin</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>{thinking ? "Checking family evidence…" : "Relationship-scoped · No AI required"}</div></div><button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", fontSize: 22 }}>×</button></div><div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>{messages.map((m, i) => <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>{m.role === "twin" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>✦</div>}<div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 14, background: m.role === "user" ? accent : surface, color: m.role === "user" ? "#fff" : textPrimary, fontSize: 13, whiteSpace: "pre-wrap" }}>{m.text}{m.role === "twin" && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>authorized relationship · deterministic · no AI</div>}</div></div>)}<div ref={bottomRef} /></div><div style={{ padding: "10px 14px", borderTop: `1px solid ${border}`, display: "flex", gap: 8 }}><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && void send()} placeholder="Ask about your child…" style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${border}` }} /><button onClick={() => void send()} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontWeight: 700 }}>{thinking ? "…" : "Send"}</button></div></div></>;
}
