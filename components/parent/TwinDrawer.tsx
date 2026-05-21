"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Message { role: "user" | "twin"; text: string; }
interface Props { open: boolean; onClose: () => void; }

export default function ParentTwinDrawer({ open, onClose }: Props) {
  const [input,    setInput]    = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [context,  setContext]  = useState("");
  const bottomRef  = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      const profileRes = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user.id)
        .single();

      const parentName = profileRes.data?.full_name ?? "Parent";

      const { data: links } = await supabase
        .from("parent_student_links")
        .select("student_id")
        .eq("parent_id", data.user.id);

      if (!links || links.length === 0) {
        setContext("Parent has no linked children yet.");
        setMessages([{ role: "twin", text: "Hello! Link a child first and I will be able to give you full insights." }]);
        return;
      }

      const studentIds = links.map((l: { student_id: string }) => l.student_id);

      const { data: students } = await supabase
        .from("students")
        .select("id, name, admission_number, class_id, school_id")
        .in("id", studentIds);

      if (!students || students.length === 0) return;

      const classIds  = students.map((s: { class_id: string }) => s.class_id);
      const schoolIds = Array.from(new Set(students.map((s: { school_id: string }) => s.school_id).filter(Boolean)));

      const [classesRes, schoolsRes] = await Promise.all([
        supabase.from("classes").select("id, name, stream").in("id", classIds),
        supabase.from("schools").select("id, name").in("id", schoolIds as string[]),
      ]);

      const today = new Date().toISOString().split("T")[0];

      const childLines = await Promise.all(students.map(async (s: { id: string; name: string; class_id: string; school_id: string; admission_number: string | null }) => {
        const cls    = (classesRes.data ?? []).find((c: { id: string }) => c.id === s.class_id) as { id: string; name: string; stream: string | null } | undefined;
        const school = (schoolsRes.data ?? []).find((sc: { id: string }) => sc.id === s.school_id) as { id: string; name: string } | undefined;

        const attRes = await supabase
          .from("attendance")
          .select("status")
          .eq("student_id", s.id)
          .eq("school_id", s.school_id);

        const att      = attRes.data ?? [];
        const total    = att.length;
        const present  = att.filter((a: { status: string }) => a.status === "present").length;
        const attPct   = total > 0 ? Math.round((present / total) * 100) : 0;

        const todayAtt = await supabase
          .from("attendance")
          .select("status")
          .eq("student_id", s.id)
          .eq("school_id", s.school_id)
          .gte("timestamp", today + "T00:00:00")
          .lt("timestamp", today + "T23:59:59");

        const todayStatus = todayAtt.data?.[0]?.status ?? "not marked";
        const className   = cls ? cls.name + (cls.stream ? " " + cls.stream : "") : "Unknown";

        return `Child: ${s.name}
  School: ${school?.name ?? "Unknown"}
  Class: ${className}
  Overall Attendance: ${attPct}%
  Today: ${todayStatus}`;
      }));

      const ctx = `Parent: ${parentName}
Today: ${new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

${childLines.join("\n\n")}`;

      setContext(ctx);
      setMessages([{
        role: "twin",
        text: "Hello! I have your " + students.length + " " + (students.length === 1 ? "child's" : "children's") + " details ready. Ask me about attendance, performance, or anything school-related.",
      }]);
    });
  }, []);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, thinking, open]);

  async function send() {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setThinking(true);

    try {
      const history = messages.map(m => ({
        role:    m.role === "twin" ? "assistant" : "user",
        content: m.text,
      }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are the Parent Twin — an intelligent AI assistant embedded in VibeSchool, a Kenyan school management platform following the CBC curriculum.

You know this parent context:
${context}

You help with:
- Understanding their child's attendance patterns
- Interpreting CBC assessment results and marks
- Knowing what to discuss with the teacher
- Understanding school fees and finance status
- CBC curriculum guidance for parents
- How to support their child at home

Keep responses warm, clear, and parent-friendly. Avoid jargon.
Never say you are Claude or made by Anthropic. You are simply "Your Twin".`,
          messages: [
            ...history,
            { role: "user", content: userMsg },
          ],
        }),
      });

      const data  = await response.json();
      const reply = data.content?.[0]?.text ?? "I could not process that. Please try again.";
      setMessages(m => [...m, { role: "twin", text: reply }]);
    } catch {
      setMessages(m => [...m, { role: "twin", text: "Something went wrong. Check your connection and try again." }]);
    } finally {
      setThinking(false);
    }
  }

  const accent      = "#10b981";
  const accentLight = "rgba(16,185,129,0.12)";
  const dark        = "#1e1b4b";
  const surface     = "#f8fafc";
  const border      = "#e2e8f0";
  const textPrimary = "#0f172a";

  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }} />
      )}

      <div style={{
        position:      "fixed",
        left:          "50%",
        transform:     "translateX(-50%)",
        bottom:        open ? 80 : -520,
        zIndex:        790,
        width:         "calc(100% - 32px)",
        maxWidth:      600,
        background:    "#fff",
        borderRadius:  20,
        boxShadow:     "0 -4px 40px rgba(0,0,0,0.18)",
        display:       "flex",
        flexDirection: "column",
        height:        440,
        transition:    "bottom 0.34s cubic-bezier(0.34,1.56,0.64,1)",
        overflow:      "hidden",
      }}>

        <div style={{ background: dark, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: accentLight, border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: accent }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Parent Twin</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                {thinking ? "Thinking…" : "Knows your children · Always ready"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
              {m.role === "twin" && (
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: accent }}>✦</div>
              )}
              <div style={{
                maxWidth:     "78%",
                padding:      "10px 14px",
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                background:   m.role === "user" ? accent : surface,
                color:        m.role === "user" ? "#fff" : textPrimary,
                fontSize:     13,
                lineHeight:   1.6,
                whiteSpace:   "pre-wrap",
              }}>
                {m.text}
              </div>
            </div>
          ))}

          {thinking && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: accent }}>✦</div>
              {[0, 0.2, 0.4].map(delay => (
                <div key={delay} style={{ width: 7, height: 7, borderRadius: "50%", background: accent, animation: `twinDot 1.4s ease-in-out ${delay}s infinite` }} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "10px 14px", borderTop: `1px solid ${border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about your child…"
            style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: textPrimary }}
          />
          <button
            onClick={send}
            style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
          >
            {thinking ? "…" : "Send"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes twinDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </>
  );
}
