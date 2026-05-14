"use client";
import { useState } from "react";
import { VIBECONNECT_THREADS } from "@/lib/data";
import { Card, Btn, Avatar } from "@/components/teacher/ui";

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  parent:  { bg: "#dbeafe", color: "#1d4ed8" },
  teacher: { bg: "#ede9fe", color: "#6d28d9" },
  admin:   { bg: "#fef3c7", color: "#92400e" },
};

export default function VibeConnectPage() {
  const [activeThread, setActiveThread] = useState<any>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Record<number, any[]>>({});
  const [filter, setFilter] = useState("all");

  function sendMsg() {
    if (!chatInput.trim() || !activeThread) return;
    setChatHistory(h => ({
      ...h,
      [activeThread.id]: [...(h[activeThread.id] || []), { role: "me", text: chatInput, time: "Just now" }],
    }));
    setChatInput("");
  }

  const filters = ["all", "teacher", "parent", "admin"];
  const filtered = filter === "all" ? VIBECONNECT_THREADS : VIBECONNECT_THREADS.filter(t => t.type === filter);

  if (activeThread) {
    const msgs = [
      { role: "them", text: activeThread.last, time: activeThread.time },
      ...(chatHistory[activeThread.id] || []),
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", marginBottom: 8, borderBottom: "1px solid #e5e7eb" }}>
          <button onClick={() => setActiveThread(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>←</button>
          <Avatar initials={activeThread.avatar} size={40} bg={ROLE_STYLE[activeThread.type].bg} color={ROLE_STYLE[activeThread.type].color} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{activeThread.name}</div>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "capitalize", padding: "2px 8px", borderRadius: 10, background: ROLE_STYLE[activeThread.type].bg, color: ROLE_STYLE[activeThread.type].color }}>{activeThread.type}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "me" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "76%", padding: "10px 14px",
                borderRadius: m.role === "me" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                background: m.role === "me" ? "#10b981" : "#f8f9fa",
                color: m.role === "me" ? "#fff" : "#111827",
                fontSize: 13, lineHeight: 1.6,
              }}>
                {m.text}
                <div style={{ fontSize: 10, color: m.role === "me" ? "rgba(255,255,255,0.6)" : "#6b7280", marginTop: 4, textAlign: "right" }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMsg()}
            placeholder="Type a message..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", outline: "none", fontSize: 13, fontFamily: "inherit" }}
          />
          <Btn onClick={sendMsg}>Send</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #10b981 100%)", borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>VibeConnect</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Messages & Threads</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Teachers · Parents · Admin. Scoped to your school.</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: filter === f ? "#10b981" : "#f8f9fa", color: filter === f ? "#fff" : "#6b7280" }}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0 }}>
        {filtered.map((t, i) => (
          <div key={t.id} onClick={() => setActiveThread(t)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #e5e7eb" : "none", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f8f9fa")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Avatar initials={t.avatar} size={42} bg={ROLE_STYLE[t.type].bg} color={ROLE_STYLE[t.type].color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{t.name}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{t.time}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.last}</div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", padding: "2px 7px", borderRadius: 10, background: ROLE_STYLE[t.type].bg, color: ROLE_STYLE[t.type].color, display: "inline-block", marginTop: 4 }}>{t.type}</span>
            </div>
            {t.unread > 0 && (
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800 }}>{t.unread}</div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}