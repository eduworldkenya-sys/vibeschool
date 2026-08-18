"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { hqSupabase } from "@/lib/hq/supabase";
import { loadHQBrain, resolveHQReply, buildHQOpeningBrief, HQBrainState } from "@/lib/twin/hq-brain";
import { TwinMessage, TwinAction } from "@/lib/types";

interface Props { open: boolean; onClose: () => void; }

const DETERMINISTIC_HELP = "I work from VibeSchool's governed platform records and rules without generative AI. Ask about schools, courses/content, moderation, platform health, users, activity, operational priorities, or use one of the available HQ actions.";

const C = {
  accent: "#10b981", accentLight: "rgba(16,185,129,0.15)", surface: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)", textPrimary: "#f9fafb", textMuted: "rgba(255,255,255,0.45)",
  dark: "#0a1628", panel: "#0f1d33",
};

function Dot({ delay = 0 }: { delay?: number }) {
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.accent, margin: "0 2px", animation: `twinPulse 1.4s ease-in-out ${delay}s infinite` }} />;
}

export default function HQTwinDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<TwinMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [offline, setOffline] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);
  const brainRef = useRef<HQBrainState | null>(null);
  const recognRef = useRef<any>(null);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    setOffline(!navigator.onLine);
    void (async () => {
      try {
        const { data: { user }, error: authError } = await hqSupabase.auth.getUser();
        if (authError || !user) throw new Error("HQ Twin requires the isolated HQ owner session.");

        const { data: access, error: accessError } = await hqSupabase.rpc("hq_check_owner_access", { p_surface: "hq-twin" });
        const allowed = !accessError && Boolean((access as { allowed?: boolean } | null)?.allowed);
        if (!allowed) throw new Error("HQ Twin owner authority was not verified.");

        const brain = await loadHQBrain(user.id);
        brainRef.current = brain;
        setMessages([{ role: "twin", text: buildHQOpeningBrief(brain), source: "js" }]);
      } catch (error) {
        setMessages([{ role: "twin", text: error instanceof Error ? error.message : "HQ Twin could not load the governed platform snapshot. I will not invent platform state.", source: "offline" }]);
      } finally { setLoading(false); }
    })();
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
      const reply = resolveHQReply(action.resolveQuery, brain);
      if (reply) setMessages(m => [...m, { role: "twin", text: reply.text, source: reply.source, actions: reply.actions }]);
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
        const reply = resolveHQReply(userMsg, brain);
        if (reply) {
          setMessages(m => [...m, { role: "twin", text: reply.text, source: reply.source, actions: reply.actions }]);
          return;
        }
      }
      setMessages(m => [...m, { role: "twin", text: DETERMINISTIC_HELP, source: offline ? "offline" : "js" }]);
    } catch {
      setMessages(m => [...m, { role: "twin", text: "HQ Twin remains deterministic. Ask about a known platform metric or action; I will not substitute a generated answer when governed data is unavailable.", source: "offline" }]);
    } finally { setThinking(false); }
  }, [input, thinking, offline]);

  const health = brainRef.current?.snap?.platformHealth ?? "healthy";
  const firstName = brainRef.current?.firstName ?? "";
  const headerBg = health === "critical" ? "linear-gradient(135deg,#7f1d1d,#991b1b)" : health === "warning" ? "linear-gradient(135deg,#78350f,#92400e)" : "linear-gradient(135deg,#0f1d33,#1e1b4b)";

  return (
    <>
      <style>{`@keyframes twinPulse { 0%,80%,100% { transform:scale(0.6); opacity:0.4 } 40% { transform:scale(1); opacity:1 } }`}</style>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.4)" }} />}
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: open ? 80 : -560, zIndex: 790, width: "calc(100% - 32px)", maxWidth: 600, background: C.panel, borderRadius: 20, boxShadow: "0 -4px 40px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", height: 480, transition: "bottom 0.34s cubic-bezier(0.34,1.56,0.64,1)", overflow: "hidden", border: `1px solid ${C.border}` }}>
        <div style={{ background: headerBg, padding: "12px 14px 12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0, transition: "background 0.4s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent, flexShrink: 0 }}>✦</div>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{firstName ? `${firstName}'s HQ Twin` : "HQ Twin"}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{loading ? "Verifying HQ owner authority…" : offline ? "Offline · cached" : thinking ? "Checking governed data…" : health === "critical" ? "⚡ Platform needs attention" : "Isolated HQ authority · No AI required"}</div></div>
          </div>
          <button onClick={onClose} aria-label="Close HQ Twin" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12, background: C.dark }}>
          {loading && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}><div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.accent }}>✦</div><Dot delay={0} /><Dot delay={0.2} /><Dot delay={0.4} /></div>}
          {!loading && messages.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8, width: "100%" }}>
                {m.role === "twin" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: m.source === "offline" ? "rgba(245,158,11,0.2)" : C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: m.source === "offline" ? "#f59e0b" : C.accent }}>{m.source === "offline" ? "○" : "✦"}</div>}
                <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: m.role === "user" ? C.accent : C.surface, color: m.role === "user" ? "#fff" : C.textPrimary, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", border: m.role === "twin" ? `1px solid ${C.border}` : "none" }}>{m.text}{m.source && m.source !== "offline" && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>governed data · deterministic · no AI</div>}</div>
              </div>
              {m.role === "twin" && m.actions && m.actions.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 34 }}>{m.actions.map((a, ai) => <button key={ai} onClick={() => handleChipTap(a)} style={{ padding: "6px 12px", borderRadius: 14, border: `1px solid ${C.accent}`, background: C.accentLight, color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{a.label}</button>)}</div>}
            </div>
          ))}
          {thinking && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.accent }}>✦</div><Dot delay={0} /><Dot delay={0.2} /><Dot delay={0.4} /></div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0, alignItems: "center", background: C.panel }}>
          <button onClick={toggleVoice} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", flexShrink: 0, background: listening ? "#ef4444" : C.accentLight, color: listening ? "#fff" : C.accent, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, transition: "all 0.2s" }} title={listening ? "Stop" : "Speak"}>{listening ? "■" : "🎤"}</button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && void send()} placeholder={listening ? "Listening…" : "Ask about schools, courses, moderation…"} style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.textPrimary }} />
          <button onClick={() => void send()} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{thinking ? "…" : "Send"}</button>
        </div>
      </div>
    </>
  );
}