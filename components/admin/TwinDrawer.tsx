"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import TwinRoleSwitcher from "@/components/twin/TwinRoleSwitcher";
import { getTwinAuthorityContext, requireTwinRole, selectTwinRoleBinding } from "@/lib/twin/core";

interface Message { role: "user" | "twin"; text: string; }
interface Props { open: boolean; onClose: () => void; }
type RpcResult<T> = { data: T | null; error: { message?: string } | null };
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

type AdminSnapshot = { schoolId: string; schoolName: string; teacherCount: number; learnerCount: number; classNames: string[]; attendanceTodayRecorded: number; attendanceTodayPct: number | null; health: Record<string, unknown>; scopeCount: number; };
const HELP = "I work from your authorized school scope without generative AI. Ask about attendance today, learners, teachers, classes, classroom learning health, evidence capture, linked parents, homework feedback, or what needs attention.";
function rec(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function num(value: unknown): number { const n = typeof value === "number" ? value : Number(value); return Number.isFinite(n) ? n : 0; }

export default function AdminTwinDrawer({ open, onClose }: Props) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    void (async () => {
      try {
        const authority = await getTwinAuthorityContext();
        const adminBindings = requireTwinRole(authority, "admin");
        const binding = selectTwinRoleBinding(authority, "admin");
        const schoolId = binding.schoolId;
        if (!schoolId) throw new Error("Admin Twin has no authorized school scope.");
        const profileRes = await supabase.from("profiles").select("full_name").eq("id", authority.userId).single();
        const firstName = profileRes.data?.full_name?.split(" ")[0] ?? "Admin";
        const today = new Date().toISOString().split("T")[0];
        const [schoolRes, staffRes, classesRes, learnersRes, attendanceRes, healthRes] = await Promise.all([
          supabase.from("schools").select("name").eq("id", schoolId).single(),
          supabase.from("school_members").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("role", "teacher"),
          supabase.from("classes").select("id, name, stream").eq("school_id", schoolId),
          supabase.from("student_classes").select("student_id", { count: "exact", head: true }).eq("school_id", schoolId).eq("is_current", true),
          supabase.from("attendance").select("status").eq("school_id", schoolId).eq("date", today),
          rpc<Json>("admin_get_classroom_learning_health", { p_school_id: schoolId }),
        ]);
        if (healthRes.error) throw new Error(healthRes.error.message || "Learning health unavailable");
        const attendanceRows = attendanceRes.data ?? [];
        const present = attendanceRows.filter((row: { status: string }) => row.status === "present").length;
        const next: AdminSnapshot = {
          schoolId, schoolName: schoolRes.data?.name ?? "School", teacherCount: staffRes.count ?? 0, learnerCount: learnersRes.count ?? 0,
          classNames: (classesRes.data ?? []).map((c: { name: string; stream: string | null }) => `${c.name}${c.stream ? ` ${c.stream}` : ""}`),
          attendanceTodayRecorded: attendanceRows.length, attendanceTodayPct: attendanceRows.length > 0 ? Math.round((present / attendanceRows.length) * 100) : null,
          health: rec(healthRes.data), scopeCount: adminBindings.length,
        };
        setSnapshot(next);
        const scheduled = num(next.health.scheduled_occurrences), completed = num(next.health.completed_occurrences);
        setMessages([{ role: "twin", text: `Good day, ${firstName}. ${next.schoolName} has ${next.learnerCount} current learner enrollments and ${next.teacherCount} teacher memberships. ${scheduled > 0 ? `${completed}/${scheduled} teaching occurrences are completed in the 30-day window.` : "No teaching occurrences are recorded in the 30-day window."}${next.scopeCount > 1 ? ` You hold Admin authority in ${next.scopeCount} schools; this view is scoped to ${next.schoolName}.` : ""}` }]);
      } catch (error) {
        setMessages([{ role: "twin", text: error instanceof Error ? error.message : "Admin Twin could not resolve an authorized school role." }]);
      }
    })();
  }, []);

  useEffect(() => { if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking, open]);

  function resolve(query: string): string {
    if (!snapshot) return "The authorized school snapshot is not available, so I cannot answer that safely.";
    const q = query.toLowerCase().replace(/\s+/g, " ").trim(), h = snapshot.health;
    if (q.includes("attendance")) return snapshot.attendanceTodayPct === null ? "No attendance records have been entered for today yet. Missing attendance is not treated as absence or presence." : `Today's recorded attendance is ${snapshot.attendanceTodayPct}% across ${snapshot.attendanceTodayRecorded} attendance records.`;
    if (/learner|student|enrol/.test(q)) return `${snapshot.schoolName} has ${snapshot.learnerCount} current learner enrollments.`;
    if (/teacher|staff/.test(q)) return `${snapshot.schoolName} has ${snapshot.teacherCount} current teacher memberships.`;
    if (q.includes("class")) return snapshot.classNames.length ? `Classes: ${snapshot.classNames.join(", ")}.` : "No classes are currently recorded for this school.";
    if (q.includes("parent")) return `${num(h.linked_parents)} distinct parents are currently linked to learners in this school.`;
    if (/homework|feedback/.test(q)) return `In the last 30 days: ${num(h.homework_submissions)} homework submissions and ${num(h.released_feedback)} released feedback records.`;
    if (/evidence|learning health|teaching|progress|curriculum/.test(q)) return `30-day classroom learning health: ${num(h.completed_occurrences)}/${num(h.scheduled_occurrences)} teaching occurrences completed; ${num(h.occurrences_with_attendance)} with attendance; ${num(h.occurrences_with_homework)} with homework; ${num(h.occurrences_with_evidence)} with lesson evidence; ${num(h.occurrences_with_progress)} with progress records.`;
    if (/attention|what should|what next|priority/.test(q)) {
      const scheduled = num(h.scheduled_occurrences), completed = num(h.completed_occurrences), evidence = num(h.occurrences_with_evidence), attendance = num(h.occurrences_with_attendance);
      if (scheduled > completed) return `${scheduled - completed} scheduled teaching occurrence${scheduled - completed === 1 ? " is" : "s are"} not recorded as completed. Verify workflow state before acting.`;
      if (completed > evidence) return `${completed - evidence} completed teaching occurrence${completed - evidence === 1 ? " has" : "s have"} no linked lesson evidence. Evidence capture is the next operational gap.`;
      if (completed > attendance) return `${completed - attendance} completed teaching occurrence${completed - attendance === 1 ? " has" : "s have"} no linked attendance record.`;
      return "No higher-priority gap is visible in the current classroom learning-health counters.";
    }
    return HELP;
  }

  async function send() { if (!input.trim() || thinking) return; const userMsg = input.trim(); setInput(""); setMessages(m => [...m, { role: "user", text: userMsg }]); setThinking(true); try { setMessages(m => [...m, { role: "twin", text: resolve(userMsg) }]); } finally { setThinking(false); } }

  const accent = "#6366f1", accentLight = "rgba(99,102,241,0.12)", dark = "#1e1b4b", surface = "#f8fafc", border = "#e2e8f0", textPrimary = "#0f172a";
  return <>{open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }} />}<div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: open ? 80 : -520, zIndex: 790, width: "calc(100% - 32px)", maxWidth: 600, background: "#fff", borderRadius: 20, boxShadow: "0 -4px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", height: 440, transition: "bottom .34s cubic-bezier(.34,1.56,.64,1)", overflow: "hidden" }}><div style={{ background: dark, padding: "12px 14px 12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Admin Twin</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>{thinking ? "Checking school records…" : "Role-scoped school health · No AI required"}</div></div><div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}><TwinRoleSwitcher currentRole="admin" /><button onClick={onClose} aria-label="Close Admin Twin" style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", fontSize: 22 }}>×</button></div></div><div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>{messages.map((m, i) => <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>{m.role === "twin" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>✦</div>}<div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 14, background: m.role === "user" ? accent : surface, color: m.role === "user" ? "#fff" : textPrimary, fontSize: 13, whiteSpace: "pre-wrap" }}>{m.text}{m.role === "twin" && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>authorized role · deterministic · no AI</div>}</div></div>)}<div ref={bottomRef} /></div><div style={{ padding: "10px 14px", borderTop: `1px solid ${border}`, display: "flex", gap: 8 }}><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && void send()} placeholder="Ask about your school…" style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${border}` }} /><button onClick={() => void send()} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontWeight: 700 }}>{thinking ? "…" : "Send"}</button></div></div></>;
}