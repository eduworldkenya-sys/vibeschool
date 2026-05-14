"use client";
import { useState, useRef, useEffect } from "react";
import { Btn, C, TwinDot } from "./ui";

interface Message {
  role: "user" | "twin";
  text: string;
}

const CANNED_RESPONSES = [
  "Brian Kamau and David Otieno are both showing declining trends. I recommend reaching out to both parents this week.",
  "Period 3 resource flag: lab equipment for the Geometry lesson is unconfirmed. Mark it available or request a substitute.",
  "You are 14 topics into an 18-topic scheme with 4 weeks remaining. On track — no action needed.",
  "I can draft a parent message for David Otieno. Just say 'draft message for David's parent'.",
  "The class average for Linear Equations was 68%. Three students need follow-up: Brian, David, and Felix.",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function TwinDrawer({ open, onClose }: Props) {
  const [input, setInput]     = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "twin", text: "Good morning, Ms. Kamau. You have 4 lessons today. David Otieno has missed 5 days this term — flagged. Period 3 needs a resource confirmed. You are on track with the scheme of work." },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, open]);

  async function send() {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setThinking(true);
    await new Promise(r => setTimeout(r, 1600));
    setThinking(false);
    setMessages(m => [...m, { role: "twin", text: CANNED_RESPONSES[Math.floor(Math.random() * CANNED_RESPONSES.length)] }]);
  }

  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 780, background: "rgba(0,0,0,0.25)" }} />}

      <div style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: open ? 130 : -520,
        zIndex: 790,
        width: "calc(100% - 32px)", maxWidth: 600,
        background: "#fff", borderRadius: 20,
        boxShadow: "0 -4px 40px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column",
        height: 440,
        transition: "bottom 0.34s cubic-bezier(0.34,1.56,0.64,1)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: C.dark, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(16,185,129,0.2)", border: "1.5px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Your Twin</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Never resets · Always here</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
              {m.role === "twin" && (
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: C.accent }}>✦</div>
              )}
              <div style={{
                maxWidth: "78%", padding: "10px 14px",
                borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                background: m.role === "user" ? C.accent : C.surface,
                color: m.role === "user" ? "#fff" : C.textPrimary,
                fontSize: 13, lineHeight: 1.6,
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

        {/* Input */}
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask your Twin anything about your class..."
            style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 13, fontFamily: "inherit", color: C.textPrimary }}
          />
          <Btn onClick={send}>Send</Btn>
        </div>
      </div>
    </>
  );
}