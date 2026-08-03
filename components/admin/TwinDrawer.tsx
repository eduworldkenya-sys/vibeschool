"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Message { role: "user" | "twin"; text: string; }
interface Props { open: boolean; onClose: () => void; }

export default function AdminTwinDrawer({ open, onClose }: Props) {
  const [input,     setInput]     = useState("");
  const [thinking,  setThinking]  = useState(false);
  const [firstName, setFirstName] = useState("");
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [context,   setContext]   = useState("");
  const bottomRef   = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      const profileRes = await supabase
        .from("profiles")
        .select("full_name, school_id")
        .eq("id", data.user.id)
        .single();

      const name     = profileRes.data?.full_name?.split(" ")[0] ?? "there";
      const schoolId = profileRes.data?.school_id;
      setFirstName(name);

      if (!schoolId) return;

      const [schoolRes, staffRes, classesRes] = await Promise.all([
        supabase.from("schools").select("name").eq("id", schoolId).single(),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("role", "teacher"),
        supabase.from("classes").select("id, name, stream").eq("school_id", schoolId),
      ]);

      const schoolName  = schoolRes.data?.name ?? "Unknown School";
      const staffCount  = staffRes.count ?? 0;
      const classList   = (classesRes.data ?? [])
        .map((c: { name: string; stream: string | null }) => `${c.name}${c.stream ? ` ${c.stream}` : ""}`)
        .join(", ") || "None";

      // Enrolled-student count: students currently assigned to one of this
      // school's classes (class_id not null). Not a raw count of every
      // student record ever created for this school.
      const classIds = (classesRes.data ?? []).map((c: { id: string }) => c.id);
      const studentsRes = classIds.length > 0
        ? await supabase.from("students").select("id", { count: "exact", head: true }).in("class_id", classIds)
        : { count: 0 as number | null };
      const studentCount = studentsRes.count ?? 0;

      const today = new Date().toISOString().split("T")[0];
      const attRes = await supabase
        .from("attendance")
        .select("status")
        .eq("school_id", schoolId)
        .eq("date", today);

      const attRecords = attRes.data ?? [];
      const present    = attRecords.filter((r: { status: string }) => r.status === "present").length;
      const attPct     = attRecords.length > 0 ? Math.round((present / attRecords.length) * 100) : 0;

      const ctx = `Admin: ${profileRes.data?.full_name ?? name}
School: ${schoolName}
Total Students: ${studentCount}
Total Staff: ${staffCount}
Classes: ${classList}
Attendance Today: ${attPct}%
Today: ${new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

      setContext(ctx);
      setMessages([{
        role: "twin",
        text: "Good day, " + name + ". I have your school overview ready. Ask me about attendance, staff, students, or any school operations.",
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

      const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/super-action", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are the Admin Twin — an intelligent AI assistant embedded in VibeSchool, a Kenyan school management platform following the CBC curriculum.

You know this school context:
${context}

You help with:
- School-wide attendance analysis
- Staff performance and management insights
- Student enrollment and class distribution
- Finance and budget overviews
- CBC curriculum compliance across the school
- Operational decision support

Keep responses concise, professional, and data-driven. You are always on the admin side.
Never say you are Claude or made by Anthropic. You are simply "Your Twin".`,
          messages: [
            ...history,
            { role: "user", content: userMsg },
          ],
        }),
      });

      const data  = await response.json();
      const reply = data.reply ?? "I could not process that. Please try again.";
      setMessages(m => [...m, { role: "twin", text: reply }]);
    } catch {
      setMessages(m => [...m, { role: "twin", text: "Something went wrong. Check your connection and try again." }]);
    } finally {
      setThinking(false);
    }
  }

  const accent     = "#6366f1";
  const accentLight = "rgba(99,102,241,0.12)";
  const dark       = "#1e1b4b";
  const surface    = "#f8fafc";
  const border     = "#e2e8f0";
  const textPrimary = "#0f172a";

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }}
        />
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
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: accentLight, border: "1.5px solid rgba(99,102,241,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: accent }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Admin Twin</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                {thinking ? "Thinking…" : "School overview · Always ready"}
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
            placeholder="Ask about your school…"
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
