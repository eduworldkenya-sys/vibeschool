"use client";

function Tile({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ minWidth: 0, minHeight: 72, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", color: "#374151", fontFamily: "inherit", padding: "9px 6px" }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{label}</span>
    </button>
  );
}

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconCheck() { return <svg {...iconProps}><path d="M20 6L9 17l-5-5" /></svg>; }
function IconPlus() { return <svg {...iconProps}><path d="M12 5v14M5 12h14" /></svg>; }
function IconClipboard() { return <svg {...iconProps}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 3h6v4H9z" /></svg>; }
function IconFolder() { return <svg {...iconProps}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" /></svg>; }

export default function QuickActions({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <section style={{ background: "#fff", borderRadius: 18, padding: 12, marginBottom: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", margin: "2px 2px 10px" }}>Quick tools</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
        <Tile label="Attendance" icon={<IconCheck />} onClick={() => onNavigate("/teacher/attendance")} />
        <Tile label="New lesson" icon={<IconPlus />} onClick={() => onNavigate("/teacher/lessonplan")} />
        <Tile label="Homework" icon={<IconClipboard />} onClick={() => onNavigate("/teacher/homework")} />
        <Tile label="Resources" icon={<IconFolder />} onClick={() => onNavigate("/teacher/resources")} />
      </div>
    </section>
  );
}
