"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Btn, C, TwinDot } from "./ui";
import {
  loadTwinBrain, resolveTwinReply, updateFingerprint,
  buildContextString, TwinBrainState,
} from "@/lib/twin/brain";
import { TwinMessage, TwinAction } from "@/lib/types";

interface Props { open: boolean; onClose: () => void; }

const MAX_HISTORY = 10;

async function saveToMemory(userId: string, userMsg: string, twinReply: string) {
  try {
    await supabase.from("twin_memory").insert([
      { user_id: userId, type: "teacher_query", content: userMsg.slice(0, 300),   subject: "general" },
      { user_id: userId, type: "teacher_reply", content: twinReply.slice(0, 300), subject: "general" },
    ]);
  } catch {}
}

export default function TwinDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const [input,     setInput]     = useState("");
  const [thinking,  setThinking]  = useState(false);
  const [messages,  setMessages]  = useState<TwinMessage[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [listening, setListening] = useState(false);
  const [offline,   setOffline]   = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);
  const brainRef    = useRef<TwinBrainState | null>(null);
  const userIdRef   = useRef<string | null>(null);
  const recognRef   = useRef<any>(null);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    setOffline(!navigator.onLine);
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      userIdRef.current = data.user.id;
      try {
        const brain = await loadTwinBrain(data.user.id);
        brainRef.current = brain;
        const { firstName, snap, rulesOutput } = brain;
        const credLine = snap?.credits !== null && snap?.credits !== undefined
          ? ` ${snap.credits} credit${snap.credits === 1 ? "" : "s"} remaining.` : "";
        const openingInsight = rulesOutput?.priority === "critical" || rulesOutput?.priority === "urgent"
          ? `\n\n⚡ ${rulesOutput.message}` : "";
        setMessages([{ role: "twin", text: `Ready, ${firstName}.${credLine}${openingInsight}`, source: "js" }]);
      } catch {
        setMessages([{ role: "twin", text: "Ready. Ask me anything.", source: "offline" }]);
      } finally { setLoading(false); }
    });
  }, []);

  useEffect(() => {
    if (open && bottomRef.current) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages, thinking, open]);

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recognRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = "en"; r.continuous = false; r.interimResults = false;
    r.onresult = (e: any) => { const t = e.results[0]?.[0]?.transcript ?? ""; if (t) setInput(prev => (prev + " " + t).trim()); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start(); recognRef.current = r; setListening(true);
  }

  function handleChipTap(action: TwinAction) {
    if (action.route) {
      setMessages(m => [...m, { role: "user", text: action.label }]);
      onClose();
      router.push(action.route);
      return;
    }
    if (action.resolveQuery) {
      const brain = brainRef.current;
      setMessages(m => [...m, { role: "user", text: action.label }]);
      if (!brain) return;
      const reply = resolveTwinReply(action.resolveQuery, brain);
      if (reply) {
        const updatedFp = updateFingerprint(userIdRef.current!, action.resolveQuery, brain);
        brainRef.current = { ...brain, fingerprint: updatedFp };
        setMessages(m => [...m, { role: "twin", text: reply.text, source: reply.source, actions: reply.actions }]);
        if (userIdRef.current) saveToMemory(userIdRef.current, action.resolveQuery, reply.text);
      }
    }
  }

  const send = useCallback(async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setThinking(true);
    const brain = brainRef.current;
    try {
      if (brain) {
        const reply = resolveTwinReply(userMsg, brain);
        if (reply) {
          const updatedFp = updateFingerprint(userIdRef.current!, userMsg, brain);
          brainRef.current = { ...brain, fingerprint: updatedFp };
          setMessages(m => [...m, { role: "twin", text: reply.text, source: reply.source, actions: reply.actions }]);
          setThinking(false);
          if (userIdRef.current) saveToMemory(userIdRef.current, userMsg, reply.text);
          return;
        }
      }
      if (!navigator.onLine) {
        setMessages(m => [...m, { role: "twin", text: "You are offline. Ask about attendance, students, schedule, or curriculum — I can answer those from cache.", source: "offline" }]);
        setThinking(false); return;
      }
      const context   = brain ? buildContextString(brain) : "No context.";
      const firstName = brain?.firstName ?? "Teacher";
      const history   = [
        ...messages.slice(-MAX_HISTORY).map(m => ({ role: m.role === "twin" ? "assistant" : "user", content: m.text })),
        { role: "user" as const, content: userMsg },
      ];
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/twin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ context, firstName, messages: history }),
      });
      const data  = await response.json();
      const reply = data.reply ?? "I could not process that. Please try again.";
      if (brain && userIdRef.current) {
        const updatedFp = updateFingerprint(userIdRef.current, userMsg, brain);
        brainRef.current = { ...brain, fingerprint: updatedFp };
      }
      setMessages(m => [...m, { role: "twin", text: reply, source: "ai" }]);
      if (userIdRef.current) saveToMemory(userIdRef.current, userMsg, reply);
    } catch {
      setMessages(m => [...m, { role: "twin", text: "Something went wrong. If offline, ask about attendance, students, or your schedule.", source: "offline" }]);
    } finally { setThinking(false); }
  }, [input, thinking, messages]);

  const priority = brainRef.current?.rulesOutput?.priority ?? "calm";
  const firstName = brainRef.current?.firstName ?? "";
  const headerBg = priority === "critical" ? "linear-gradient(135deg,#7f1d1d,#991b1b)"
    : priority === "urgent" ? "linear-gradient(135deg,#78350f,#92400e)" : C.dark;

  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }} />}
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: open ? 80 : -560, zIndex: 790, width: "calc(100% - 32px)", maxWidth: 600, background: "#fff", borderRadius: 20, boxShadow: "0 -4px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", height: 480, transition: "bottom 0.34s cubic-bezier(0.34,1.56,0.64,1)", overflow: "hidden" }}>
        <div style={{ background: headerBg, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, transition: "background 0.4s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{firstName ? `${firstName}'s Twin` : "Your Twin"}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                {loading ? "Reading your school…" : offline ? "Offline · cached knowledge" : thinking ? "Thinking…" : priority === "critical" ? "⚡ Action needed" : "Knows your school · Remembers you"}
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
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8, width: "100%" }}>
                {m.role === "twin" && (
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: m.source === "offline" ? "#fef3c7" : C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: m.source === "offline" ? "#92400e" : C.accent }}>
                    {m.source === "offline" ? "○" : "✦"}
                  </div>
                )}
                <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: m.role === "user" ? C.accent : C.surface, color: m.role === "user" ? "#fff" : C.textPrimary, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {m.text}
                  {m.source && m.source !== "ai" && m.source !== "offline" && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>instant · no AI used</div>}
                </div>
              </div>
              {m.role === "twin" && m.actions && m.actions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 34 }}>
                  {m.actions.map((a, ai) => (
                    <button
                      key={ai}
                      onClick={() => handleChipTap(a)}
                      style={{ padding: "6px 12px", borderRadius: 14, border: `1px solid ${C.accent}`, background: C.accentLight, color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
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
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} placeholder={listening ? "Listening…" : "Ask your Twin anything…"} style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: C.textPrimary }} />
          <Btn onClick={send}>{thinking ? "…" : "Send"}</Btn>
        </div>
      </div>
    </>
  );
}
