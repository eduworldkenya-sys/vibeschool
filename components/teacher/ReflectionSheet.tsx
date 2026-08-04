"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const ENGAGEMENT: { key: "low" | "medium" | "high"; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

export default function ReflectionSheet({
  lessonId, occurrenceId, classId, subjectId, teacherId, onClose, onSaved,
}: {
  lessonId: string | null;
  occurrenceId: string | null;
  classId: string;
  subjectId: string;
  teacherId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [engagement, setEngagement] = useState<"low" | "medium" | "high">("medium");
  const [reflectionText, setReflectionText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!lessonId) {
      setError("This lesson isn't linked to a lesson plan yet.");
      return;
    }
    if (!occurrenceId) {
      setError(
        "This reflection is not linked to a teaching occurrence."
      );
      return;
    }

    if (!reflectionText.trim()) {
      setError("Add a short reflection before saving.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: insErr } = await supabase.from("lesson_reflections").upsert(
      {
        lesson_id: lessonId,
        lesson_plan_id: lessonId,
        teaching_occurrence_id: occurrenceId,
        teacher_id: teacherId,
        class_id: classId,
        what_worked: reflectionText.trim(),
        challenges: null,
        next_steps: null,
      },
      { onConflict: "lesson_plan_id" }
    );

    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
    onClose();
  }

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
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1e1b4b", marginBottom: 14 }}>
          Write Reflection
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
          How engaged were learners?
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {ENGAGEMENT.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setEngagement(opt.key)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
                border: engagement === opt.key ? "1.5px solid #10b981" : "1px solid #e5e7eb",
                background: engagement === opt.key ? "#ecfdf5" : "#fff",
                color: engagement === opt.key ? "#059669" : "#6b7280",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
          What worked, what didn't, what's next?
        </div>
        <textarea
          value={reflectionText}
          onChange={(e) => setReflectionText(e.target.value)}
          rows={5}
          placeholder="e.g. Group work on fractions went well, but three learners still confuse numerator/denominator — revisit with visuals next lesson."
          style={{
            width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb",
            fontSize: 13, fontFamily: "inherit", resize: "vertical", marginBottom: 12,
          }}
        />

        {error && (
          <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid #e5e7eb",
              background: "#fff", color: "#6b7280", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: "12px 0", borderRadius: 12, border: "none",
              background: "#10b981", color: "#fff", fontWeight: 800, fontSize: 13,
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save Reflection"}
          </button>
        </div>
      </div>
    </div>
  );
}
