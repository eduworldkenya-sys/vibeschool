"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const router = useRouter();
  const [reflectionText, setReflectionText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!lessonId) {
      setError("This lesson isn't linked to a lesson plan yet.");
      return;
    }
    if (!occurrenceId) {
      setError("This reflection is not linked to a teaching occurrence.");
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

    // A completed lesson should continue into its exact Record of Progress,
    // never a generic progress page or a plan-only shortcut. The progress page
    // re-validates occurrence ownership/completion and prefills the lesson and
    // homework from this same authoritative occurrence.
    onSaved();
    onClose();
    router.push(
      `/teacher/progress?occurrenceId=${encodeURIComponent(occurrenceId)}&planId=${encodeURIComponent(lessonId)}&classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}`
    );
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
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1e1b4b", marginBottom: 6 }}>
          Quick lesson reflection
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14, lineHeight: 1.5 }}>
          Capture the teaching insight here. After saving, VibeSchool opens the exact completed lesson progress record for you to confirm participation, challenges and next steps.
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
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div role="alert" style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid #e5e7eb",
              background: "#fff", color: "#6b7280", fontWeight: 700, fontSize: 13,
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            }}
          >
            Later
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
            {saving ? "Saving…" : "Save & record progress →"}
          </button>
        </div>
      </div>
    </div>
  );
}
