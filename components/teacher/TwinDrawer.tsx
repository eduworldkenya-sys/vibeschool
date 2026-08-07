"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, C, TwinDot } from "./ui";
import { askTeacherTwin, getTeacherTwinState, type TeacherTwinState } from "@/lib/teacher/twin";
import type { TwinMessage } from "@/lib/types";

interface Props { open: boolean; onClose: () => void }
const MAX_HISTORY = 10;

function openingBrief(state: TeacherTwinState): string {
  const now = state.decision.now;
  if (!now) return "Your Teacher Twin is ready. I will ground answers in your verified school workflow.";
  return `${now.title}. ${now.reason ?? "This is your highest-priority verified teaching action right now."}`;
}

function priorityColor(priority: string): string {
  if (priority === "critical") return "linear-gradient(135deg,#7f1d1d,#991b1b)";
  if (priority === "urgent" || priority === "high") return "linear-gradient(135deg,#78350f,#92400e)";
  return C.dark;
}

export default function TwinDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<TwinMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [offline, setOffline] = useState(false);
  const [state, setState] = useState<TeacherTwinState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognRef = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(!navigator.onLine);
    try {
      const next = await getTeacherTwinState();
      setState(next);
      setMessages(current => current.length > 0 ? current : [{ role: "twin", text: openingBrief(next), source: "js" }]);
    } catch {
      setMessages(current => current.length > 0 ? current : [{ role: "twin", text: "I could not load verified Teacher Twin state. Open the Twin workspace and retry when you are online.", source: "offline" }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (open) {
      void load();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [open, load]);
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

  const send = useCallback(async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(current => [...current, { role: "user", text: userMsg }]);
    setThinking(true);
    try {
      if (!navigator.onLine) throw new Error("offline");
      const history = [
        ...messages.slice(-MAX_HISTORY).map(message => ({ role: message.role === "twin" ? "assistant" as const : "user" as const, content: message.text })),
        { role: "user" as const, content: userMsg },
      ];
      const reply = await askTeacherTwin({ messages: history, firstName: state?.fullName?.split(" ")[0] || "Teacher" });
      setMessages(current => [...current, { role: "twin", text: reply, source: "ai" }]);
      void load();
    } catch {
      setMessages(current => [...current, { role: "twin", text: "I cannot verify live school evidence right now. I will not guess. Please retry when the connection is available.", source: "offline" }]);
    } finally {
      setThinking(false);
    }
  }, [input, thinking, messages, state?.fullName, load]);

  const now = state?.decision.now;
  const firstName = state?.fullName?.split(" ")[0] ?? "";
  const headerBg = priorityColor(now?.priority ?? "calm");

  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }} />}
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: open ? 80 : -580, zIndex: 790, width: "calc(100% - 32px)", maxWidth: 600, background: "#fff", borderRadius: 20, boxShadow: "0 -4px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", height: 500, transition: "bottom 0.34s cubic-bezier(0.34,1.56,0.64,1)", overflow: "hidden" }}>
        <div style={{ background: headerBg, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{firstName ? `${firstName}'s Teacher Twin` : "Teacher Twin"}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{loading ? "Reading verified school state…" : offline ? "Offline · verification unavailable" : thinking ? "Thinking from verified context…" : `State confidence ${Math.round((state?.confidence ?? 0) * 100)}%`}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {now && <button onClick={() => { onClose(); router.push(now.actionUrl ?? "/teacher/twin"); }} style={{ border: 0, borderBottom: `1px solid ${C.border}`, background: "#f8fafc", padding: "9px 16px", textAlign: "left", cursor: "pointer", color: C.textPrimary }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: C.accent, letterSpacing: 0.8 }}>NOW · {now.priority.toUpperCase()}</span>
          <strong style={{ display: "block", fontSize: 12, marginTop: 2 }}>{now.title}</strong>
        </button>}

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}><TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} /></div>}
          {!loading && messages.map((message, index) => (
            <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: message.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>
              <div style={{ maxWidth: "82%", padding: "10px 14px", borderRadius: message.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: message.role === "user" ? C.accent : C.surface, color: message.role === "user" ? "#fff" : C.textPrimary, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{message.text}</div>
            </div>
          ))}
          {thinking && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} /></div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "8px 14px 0", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => { onClose(); router.push("/teacher/twin"); }} style={{ border: 0, background: "none", color: C.accent, fontSize: 11, fontWeight: 800, cursor: "pointer", padding: 0 }}>Open full Twin workspace</button>
          <span style={{ fontSize: 9, color: C.textMuted }}>AI explains · server brain decides</span>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          <button onClick={toggleVoice} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", flexShrink: 0, background: listening ? "#ef4444" : C.accentLight, color: listening ? "#fff" : C.accent, cursor: "pointer", fontSize: 15 }} title={listening ? "Stop" : "Speak"}>{listening ? "■" : "🎤"}</button>
          <input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => event.key === "Enter" && !event.shiftKey && void send()} placeholder={listening ? "Listening…" : "Ask about your verified teaching workflow…"} style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: C.textPrimary }} />
          <Btn onClick={() => void send()} disabled={thinking}>{thinking ? "…" : "Send"}</Btn>
        </div>
      </div>
    </>
  );
}
