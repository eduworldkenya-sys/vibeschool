"use client";

// Fix 18E-D: dismissible bottom-sheet prompt shown after a lesson occurrence
// completes, offering to mark the linked scheme item covered. Deliberately
// presentational only — the RPC call, `marking`, and `error` state all live
// in LessonPlanModal (handleMarkCovered / markingCovered), matching how
// handleCompleteLesson owns the completion RPC rather than a subcomponent.
export default function CoverageSheet({
  marking, error, onMarkCovered, onDismiss,
}: {
  marking: boolean;
  error: string | null;
  onMarkCovered: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      onClick={marking ? undefined : onDismiss}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,15,26,0.5)",
        display: "flex", alignItems: "flex-end", zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "20px 20px 0 0", padding: 20,
          width: "100%", maxHeight: "85vh", overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1e1b4b", marginBottom: 10 }}>
          Was this scheme item fully covered?
        </div>

        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, marginBottom: 18 }}>
          Mark it covered to include it in your curriculum coverage.
          You can leave it in progress if more teaching is needed.
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onDismiss}
            disabled={marking}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid #e5e7eb",
              background: "#fff", color: "#6b7280", fontWeight: 700, fontSize: 13,
              cursor: marking ? "not-allowed" : "pointer",
            }}
          >
            Not yet
          </button>
          <button
            onClick={onMarkCovered}
            disabled={marking}
            style={{
              flex: 2, padding: "12px 0", borderRadius: 12, border: "none",
              background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 13,
              cursor: marking ? "default" : "pointer", opacity: marking ? 0.6 : 1,
            }}
          >
            {marking ? "Marking…" : "Mark covered"}
          </button>
        </div>
      </div>
    </div>
  );
}
