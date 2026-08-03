"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Lesson plan history: added alongside the lesson_plan_history audit table +
// trg_lesson_plan_history trigger (migration: add_lesson_plan_history).
// Self-fetching, presentational-only sheet — mirrors ReflectionSheet's
// pattern of owning its own supabase calls rather than lifting them into
// LessonPlanModal, since this data isn't needed anywhere else in the modal.

type HistoryRow = {
  id: string;
  change_type: "edit" | "status_change";
  status: string;
  snapshot: Record<string, any>;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  shared_to_parents: "Shared to Parents",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function LessonPlanHistorySheet({
  lessonPlanId, onClose,
}: {
  lessonPlanId: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("lesson_plan_history")
        .select("id, change_type, status, snapshot, created_at")
        .eq("lesson_plan_id", lessonPlanId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (fetchErr) {
        setError("Couldn't load history. Please try again.");
      } else {
        setRows((data as HistoryRow[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [lessonPlanId]);

  return (
    <div
      onClick={onClose}
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
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1e1b4b", marginBottom: 4 }}>
          Lesson Plan History
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          Every saved edit and status change for this lesson plan.
        </div>

        {loading && (
          <div style={{ fontSize: 13, color: "#6b7280", padding: "20px 0", textAlign: "center" }}>
            Loading…
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ fontSize: 13, color: "#6b7280", padding: "20px 0", textAlign: "center" }}>
            No history yet — this plan hasn't been edited since it was created.
          </div>
        )}

        {!loading && rows.map((row) => {
          const isOpen = expanded === row.id;
          return (
            <div
              key={row.id}
              style={{
                border: "1px solid #e5e7eb", borderRadius: 12,
                padding: "12px 14px", marginBottom: 10, cursor: "pointer",
              }}
              onClick={() => setExpanded(isOpen ? null : row.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, borderRadius: 20, padding: "2px 10px",
                  background: row.change_type === "status_change" ? "#dbeafe" : "#f3f4f6",
                  color: row.change_type === "status_change" ? "#1e40af" : "#374151",
                }}>
                  {row.change_type === "status_change" ? "Status change" : "Edit"}
                </span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>
                  {formatWhen(row.created_at)}
                </span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                  {row.snapshot?.topic && (
                    <div><strong>Topic:</strong> {row.snapshot.topic}</div>
                  )}
                  {row.snapshot?.objectives && (
                    <div style={{ marginTop: 4 }}><strong>Objectives:</strong> {String(row.snapshot.objectives).slice(0, 200)}</div>
                  )}
                  {row.snapshot?.notes && (
                    <div style={{ marginTop: 4 }}><strong>Notes:</strong> {String(row.snapshot.notes).slice(0, 200)}</div>
                  )}
                  {!row.snapshot?.topic && !row.snapshot?.objectives && !row.snapshot?.notes && (
                    <div style={{ color: "#9ca3af" }}>No content preview available for this version.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 12, border: "1px solid #e5e7eb",
            background: "#fff", color: "#6b7280", fontWeight: 700, fontSize: 13,
            cursor: "pointer", marginTop: 4,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
