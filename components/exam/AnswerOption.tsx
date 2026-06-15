"use client"

interface AnswerOptionProps {
  label:     string
  index:     number
  onSelect:  (index: number) => void
  disabled?: boolean
}

export default function AnswerOption({ label, index, onSelect, disabled = false }: AnswerOptionProps) {
  const prefix = ["A", "B", "C", "D"][index] ?? ""
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(index)}
      style={{
        width: "100%", minHeight: 56, textAlign: "left", padding: "12px 16px",
        background: "#18181b", border: "1px solid #27272a", borderRadius: 12,
        display: "flex", alignItems: "center", gap: 12, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "border-color 0.15s",
      }}
    >
      <div style={{ height: 32, width: 32, flexShrink: 0, background: "#09090b", border: "1px solid #3f3f46", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#C8A84B" }}>
        {prefix}
      </div>
      <span style={{ fontSize: 14, color: "#e4e4e7", fontWeight: 500, lineHeight: 1.4 }}>
        {label}
      </span>
    </button>
  )
}
