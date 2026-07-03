"use client";

function Tile({
  color,
  label,
  icon,
  onClick,
}: {
  color: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: "1 1 0",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `${color}1a`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#1e1b4b", textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </div>
    </div>
  );
}

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconCheck() { return <svg {...iconProps}><path d="M20 6L9 17l-5-5" /></svg>; }
function IconPlus() { return <svg {...iconProps}><path d="M12 5v14M5 12h14" /></svg>; }
function IconClipboard() { return <svg {...iconProps}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 3h6v4H9z" /></svg>; }
function IconFolder() { return <svg {...iconProps}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" /></svg>; }
function IconSpark() { return <svg {...iconProps}><path d="M12 2l1.8 5.8L20 10l-6.2 2.2L12 18l-1.8-5.8L4 10l6.2-2.2L12 2z" /></svg>; }

export default function QuickActions({
  onNavigate,
  onOpenTwin,
}: {
  onNavigate: (href: string) => void;
  onOpenTwin: () => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <Tile color="#10b981" label="Take Attendance" icon={<IconCheck />} onClick={() => onNavigate("/teacher/attendance")} />
      <Tile color="#3b82f6" label="New Lesson" icon={<IconPlus />} onClick={() => onNavigate("/teacher/lessonplan")} />
      <Tile color="#f59e0b" label="Add Homework" icon={<IconClipboard />} onClick={() => onNavigate("/teacher/homework")} />
      <Tile color="#8b5cf6" label="Class Resources" icon={<IconFolder />} onClick={() => onNavigate("/teacher/resources")} />
      <Tile color="#ef4444" label="AI Assistant" icon={<IconSpark />} onClick={onOpenTwin} />
    </div>
  );
}
