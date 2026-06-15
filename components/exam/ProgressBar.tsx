"use client"

interface ProgressBarProps {
  current: number
  total:   number
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#71717a", marginBottom: 4 }}>
        <span>Progress</span>
        <span>{current} / {total}</span>
      </div>
      <div style={{ width: "100%", height: 8, background: "#18181b", border: "1px solid #27272a", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#C8A84B", borderRadius: 999, transition: "width 0.3s ease-out" }} />
      </div>
    </div>
  )
}
