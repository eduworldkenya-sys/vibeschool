"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Btn, C, TwinDot } from "./ui";

interface Message { role: "user" | "twin"; text: string; }
interface Props { open: boolean; onClose: () => void; }

export default function TwinDrawer({ open, onClose }: Props) {
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

      const [profileRes, classesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, school_id").eq("id", data.user.id).single(),
        supabase.from("classes").select("id, name, stream, subject").eq("teacher_id", data.user.id),
      ]);

      const name     = profileRes.data?.full_name?.split(" ")[0] ?? "there";
      const schoolId = profileRes.data?.school_id;
      setFirstName(name);

      const classIds = (classesRes.data ?? []).map((c: { id: string }) => c.id);
      const [schoolRes, studentsRes] = await Promise.all([
        schoolId
          ? supabase.from("schools").select("name").eq("id", schoolId).single()
          : Promise.resolve({ data: null }),
        classIds.length > 0
          ? supabase.from("students").select("class_id").in("class_id", classIds)
          : Promise.resolve({ data: [] }),
      ]);

      const schoolName = schoolRes.data?.name ?? "Unknown School";
      const countMap: Record<string, number> = {};
      for (const s of (studentsRes.data ?? [])) {
        countMap[s.class_id] = (countMap[s.class_id] ?? 0) + 1;
      }

      const classLines = (classesRes.data ?? [])
        .map((c: { id: string; name: string; stream: string; subject: string }) =>
          `- ${c.name}${c.stream ? ` (${c.stream})` : ""}, Subject: ${c.subject}, Students: ${countMap[c.id] ?? 0}`
        ).join("\n");

      const ctx = `Teacher: ${profileRes.data?.full_name ?? name}
School: ${schoolName}
Classes:
${classLines || "- No classes yet"}
Today: ${new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

      setContext(ctx);

      setMessages([{
        role: "twin",
        text: `Good day, ${name}. I know your classes and I am ready to help. Ask me about attendance, lesson plans, student performance, or anything else.`,
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

      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token ?? ""
      const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/super-action", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, firstName,  context, firstName, 
          
          
          system: `You are the teacher's Twin — an intelligent AI assistant embedded in VibeSchool, a Kenyan school management platform following the CBC curriculum.

You know this teacher's context:
${context}

You help with:
- Attendance analysis and patterns
- Lesson plan suggestions aligned to CBC strands
- Student performance insights
- Parent communication drafts
- CBC curriculum guidance
- Timetable and scheme of work advice

Keep responses concise, warm, and practical. You are always on the teacher's side.
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
        bottom:        open ? 130 : -520,
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

        <div style={{ background: C.dark, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Your Twin</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                {thinking ? "Thinking…" : "Always here · Knows your classes"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
              {m.role === "twin" && (
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: C.accent }}>✦</div>
              )}
              <div style={{
                maxWidth:     "78%",
                padding:      "10px 14px",
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                background:   m.role === "user" ? C.accent : C.surface,
                color:        m.role === "user" ? "#fff" : C.textPrimary,
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
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.accent }}>✦</div>
              <TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask your Twin anything about your classes…"
            style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: C.textPrimary }}
          />
          <Btn onClick={send}>{thinking ? "…" : "Send"}</Btn>
        </div>

      </div>
    </>
  );
}
