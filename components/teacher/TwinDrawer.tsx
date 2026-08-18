"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Btn, C, TwinDot } from "./ui";
import TwinRoleSwitcher from "@/components/twin/TwinRoleSwitcher";
import { getTeacherTwinState, resolveTeacherTwinQuery, type TeacherTwinReply, type TeacherTwinState } from "@/lib/teacher/twin";
import type { TwinMessage } from "@/lib/types";

interface Props { open: boolean; onClose: () => void; }

export default function TwinDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<TwinMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [offline, setOffline] = useState(false);
  const [lastAction, setLastAction] = useState<{ url: string; label: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);
  const stateRef = useRef<TeacherTwinState | null>(null);
  const recognRef = useRef<any>(null);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    setOffline(!navigator.onLine);
    void getTeacherTwinState()
      .then(state => {
        stateRef.current = state;
        const now = state.decision.now;
        const firstName = state.fullName.split(" ")[0] || "Teacher";
        setMessages([{ role: "twin", source: "js", text: now ? `${firstName}, ${now.title}.${now.reason ? ` ${now.reason}` : ""}` : `${firstName}, your Teacher Twin state is ready.` }]);
        if (now?.actionUrl) setLastAction({ url: now.actionUrl, label: now.actionLabel || "Open" });
      })
      .catch(error => {
        setMessages([{ role: "twin", source: "offline", text: error instanceof Error ? error.message : "Teacher Twin could not load the authorized school state." }]);
      })
      .finally(() => setLoading(false));
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

  function applyReply(reply: TeacherTwinReply) {
    setMessages(m => [...m, { role: "twin", text: reply.text, source: "js" }]);
    setLastAction(reply.actionUrl ? { url: reply.actionUrl, label: reply.actionLabel || "Open" } : null);
  }

  const send = useCallback(async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setThinking(true);
    try {
      let state = stateRef.current;
      if (!state) {
        state = await getTeacherTwinState();
        stateRef.current = state;
      }
      applyReply(resolveTeacherTwinQuery(userMsg, state));
    } catch (error) {
      setMessages(m => [...m, { role: "twin", text: error instanceof Error ? error.message : "Teacher Twin could not read the authorized state for that request.", source: "offline" }]);
      setLastAction(null);
    } finally { setThinking(false); }
  }, [input, thinking]);

  const state = stateRef.current;
  const priority = state?.decision.now?.priority ?? "calm";
  const firstName = state?.fullName.split(" ")[0] ?? "";
  const headerBg = priority === "critical" ? "linear-gradient(135deg,#7f1d1d,#991b1b)" : priority === "urgent" ? "linear-gradient(135deg,#78350f,#92400e)" : C.dark;

  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }} />}
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: open ? 80 : -560, zIndex: 790, width: "calc(100% - 32px)", maxWidth: 600, background: "#fff", borderRadius: 20, boxShadow: "0 -4px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", height: 480, transition: "bottom 0.34s cubic-bezier(0.34,1.56,0.64,1)", overflow: "hidden" }}>
        <div style={{ background: headerBg, padding: "12px 14px 12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0, transition: "background 0.4s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent, flexShrink: 0 }}>✦</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{firstName ? `${firstName}'s Twin` : "Teacher Twin"}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{loading ? "Reading authorized teacher state…" : offline ? "Offline · last loaded state" : thinking ? "Checking school state…" : priority === "critical" ? "⚡ Action needed" : "Server-authoritative · No AI required"}</div></div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}><TwinRoleSwitcher currentRole="teacher" /><button onClick={onClose} aria-label="Close Teacher Twin" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button></div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}><div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.accent }}>✦</div><TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} /></div>}
          {!loading && messages.map((m, i) => <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 6 }}><div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8, width: "100%" }}>{m.role === "twin" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: m.source === "offline" ? "#fef3c7" : C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: m.source === "offline" ? "#92400e" : C.accent }}>{m.source === "offline" ? "○" : "✦"}</div>}<div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: m.role === "user" ? C.accent : C.surface, color: m.role === "user" ? "#fff" : C.textPrimary, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.text}{m.role === "twin" && m.source !== "offline" && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>authorized data · deterministic · no AI</div>}</div></div></div>)}
          {lastAction && !thinking && <button onClick={() => { onClose(); router.push(lastAction.url); }} style={{ alignSelf: "flex-start", marginLeft: 34, padding: "7px 13px", borderRadius: 14, border: `1px solid ${C.accent}`, background: C.accentLight, color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{lastAction.label} →</button>}
          {thinking && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.accent }}>✦</div><TwinDot delay={0} /><TwinDot delay={0.2} /><TwinDot delay={0.4} /></div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}><button onClick={toggleVoice} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", flexShrink: 0, background: listening ? "#ef4444" : C.accentLight, color: listening ? "#fff" : C.accent, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15 }} title={listening ? "Stop" : "Speak"}>{listening ? "■" : "🎤"}</button><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && void send()} placeholder={listening ? "Listening…" : "Ask about your lesson, attendance, marking…"} style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: C.textPrimary }} /><Btn onClick={() => void send()}>{thinking ? "…" : "Send"}</Btn></div>
      </div>
    </>
  );
}