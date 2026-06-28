"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { fetchPulseData } from "@/lib/pulse/fetcher";
import { Btn, C, TwinDot } from "./ui";

const MAX_HISTORY = 10;

async function saveToMemory(userId: string, userMsg: string, twinReply: string) {
  try {
    await supabase.from("twin_memory").insert([
      { user_id: userId, type: "teacher_query",  content: userMsg.slice(0, 300),   subject: "general" },
      { user_id: userId, type: "teacher_reply",  content: twinReply.slice(0, 300), subject: "general" },
    ]);
  } catch { /* non-critical */ }
}

interface Message { role: "user" | "twin"; text: string; }
interface Props { open: boolean; onClose: () => void; }

async function buildTwinContext(userId: string): Promise<{ ctx: string; firstName: string; credits: number | null }> {
  const today = new Date().toLocaleDateString("en-KE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const profileRes = await supabase
    .from("profiles")
    .select("full_name, school_id")
    .eq("id", userId)
    .single();

  const fullName = profileRes.data?.full_name ?? "Teacher";
  const firstName = fullName.split(" ")[0];
  const schoolId = profileRes.data?.school_id ?? null;

  const schoolRes = schoolId
    ? await supabase.from("schools").select("name").eq("id", schoolId).single()
    : { data: null };
  const schoolName = schoolRes.data?.name ?? "Independent";

  let snap: Awaited<ReturnType<typeof fetchPulseData>> | null = null;
  try {
    if (schoolId) {
      const credRes = await supabase.rpc("get_credit_balance", { p_teacher_id: userId });
      const credits = credRes.data?.success ? (credRes.data.balance ?? null) : null;
      snap = await fetchPulseData(userId, schoolId, credits);
    }
  } catch { snap = null; }

  const pendingIds = new Set((snap?.attPending ?? []).map(c => c.class_id));
  const classLines: string[] = [];

  if (snap && snap.todaySlots.length > 0) {
    const seenClasses = new Set<string>();
    for (const slot of snap.todaySlots) {
      if (seenClasses.has(slot.class_id)) continue;
      seenClasses.add(slot.class_id);
      const attStatus = pendingIds.has(slot.class_id) ? "NOT SUBMITTED" : "Submitted";
      const curr = snap.currStats.find(c => c.classId === slot.class_id);
      const coverageLine = curr && curr.total > 0
        ? `Scheme: ${curr.covered}/${curr.total} strands covered (${Math.round((curr.covered / curr.total) * 100)}%)`
        : "Scheme: No curriculum data";
      classLines.push(`- ${slot.class_name}, ${slot.subject}\n  Attendance today: ${attStatus}\n  ${coverageLine}`);
    }
  } else if (snap && snap.currStats.length > 0) {
    for (const c of snap.currStats) {
      const pct = c.total > 0 ? Math.round((c.covered / c.total) * 100) : 0;
      classLines.push(`- ${c.subject}: ${c.covered}/${c.total} strands (${pct}%)`);
    }
  }

  const riskLines = (snap?.atRisk ?? [])
    .map(s => `  • ${s.name} — ${s.reason}`)
    .join("\n");

  const termPct = snap ? Math.round(snap.termProgressPct) : null;
  const credits = snap?.credits ?? null;

  const ctx = [
    `Teacher: ${fullName}`,
    `School: ${schoolName}`,
    `Today: ${today}`,
    termPct !== null ? `Term progress: ${termPct}% complete` : null,
    credits !== null ? `Credits remaining: ${credits}` : null,
    snap?.streak && snap.streak >= 3 ? `Attendance streak: ${snap.streak} consecutive days` : null,
    "",
    classLines.length > 0 ? `Classes today:\n${classLines.join("\n")}` : "No classes scheduled today.",
    riskLines ? `\nAt-risk students:\n${riskLines}` : null,
    snap?.tpadDays !== null && snap?.tpadDays !== undefined && snap.tpadDays <= 14
      ? `\nTPAD self-appraisal due in ${snap.tpadDays} day${snap.tpadDays === 1 ? "" : "s"}.`
      : null,
  ].filter(Boolean).join("\n");

  return { ctx, firstName, credits };
}

export default function TwinDrawer({ open, onClose }: Props) {
  const [input,     setInput]     = useState("");
  const [thinking,  setThinking]  = useState(false);
  const [firstName, setFirstName] = useState("");
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [context,   setContext]   = useState("");
  const [loading,   setLoading]   = useState(true);
  const [listening, setListening] = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);
  const userIdRef   = useRef<string | null>(null);
  const recognRef   = useRef<any>(null);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      userIdRef.current = data.user.id;
      try {
        const { ctx, firstName: name, credits } = await buildTwinContext(data.user.id);
        setContext(ctx);
        setFirstName(name);
        const credLine = credits !== null ? ` You have ${credits} credit${credits === 1 ? "" : "s"}.` : "";
        setMessages([{
          role: "twin",
          text: `Ready, ${name}.${credLine} Ask me about your classes, attendance, students, or lesson plans.`,
        }]);
      } catch {
        setMessages([{ role: "twin", text: "Ready. Ask me anything about your classes." }]);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, thinking, open]);

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recognRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = "en";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      if (t) setInput(prev => (prev + " " + t).trim());
    };
    r.onend  = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    recognRef.current = r;
    setListening(true);
  }

  const send = useCallback(async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setThinking(true);

    try {
      const historyRaw = [...messages, { role: "user" as const, text: userMsg }].slice(-MAX_HISTORY);
      const history = historyRaw.map(m => ({
        role:    m.role === "twin" ? "assistant" : "user",
        content: m.text,
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/twin-chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ context, firstName, messages: history }),
      });

      const data  = await response.json();
      const reply = data.reply ?? "I could not process that. Please try again.";
      setMessages(m => [...m, { role: "twin", text: reply }]);
      if (userIdRef.current) saveToMemory(userIdRef.current, userMsg, reply);
    } catch {
      setMessages(m => [...m, { role: "twin", text: "Something went wrong. Check your connection and try again." }]);
    } finally {
      setThinking(false);
    }
  }, [input, thinking, messages, context, firstName]);

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

        <div style={{ background: C.dark, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Your Twin</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                {loading ? "Reading your day…" : thinking ? "Thinking…" : "Knows your school · Remembers you"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.accent }}>✦</div>
              <TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} />
            </div>
          )}
          {!loading && messages.map((m, i) => (
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

        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          <button onClick={toggleVoice} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", flexShrink: 0, background: listening ? "#ef4444" : C.accentLight, color: listening ? "#fff" : C.accent, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, transition: "all 0.2s" }} title={listening ? "Stop" : "Speak"}>{listening ? "■" : "🎤"}</button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={listening ? "Listening…" : "Ask your Twin anything…"}
            style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: C.textPrimary }}
          />
          <Btn onClick={send}>{thinking ? "…" : "Send"}</Btn>
        </div>

      </div>
    </>
  );
}
