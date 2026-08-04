"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const TYPES: { key: string; label: string }[] = [
  { key: "observation", label: "Observation" },
  { key: "classwork", label: "Classwork" },
  { key: "exercise", label: "Exercise" },
  { key: "project", label: "Project" },
  { key: "practical", label: "Practical" },
  { key: "quiz", label: "Quiz" },
];

export default function EvidenceCaptureSheet({
  lessonId,
  occurrenceId,
  classId,
  teacherId,
  defaultTitle,
  onClose,
  onSaved,
}: {
  lessonId: string;
  occurrenceId: string;
  classId: string;
  teacherId: string;
  defaultTitle?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState("observation");
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [description, setDescription] = useState("");
  const [score, setScore] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return null;
    const ext = photoFile.name.split(".").pop() ?? "jpg";
    const path = `${teacherId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("lesson-evidence")
      .upload(path, photoFile, { upsert: true });
    if (upErr) return null;
    const { data } = supabase.storage.from("lesson-evidence").getPublicUrl(path);
    return data.publicUrl;
  }

  async function submit() {
    if (!title.trim()) {
      setError("Give it a short title.");
      return;
    }
    if (!occurrenceId) {
      setError(
        "Start the lesson before adding classroom evidence."
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const mediaUrl = await uploadPhoto();
      const {
        data: evidenceRow,
        error: insErr,
      } = await supabase
        .from("lesson_evidence")
        .insert({
          lesson_id: lessonId,
          teaching_occurrence_id:
            occurrenceId,
          class_id: classId,
          teacher_id: teacherId,
          evidence_type: type,
          title: title.trim(),
          description:
            description.trim() || null,
          media_url: mediaUrl,
          score:
            score.trim()
              ? Number(score)
              : null,
        })
        .select("id")
        .single();

      if (insErr || !evidenceRow?.id) {
        throw (
          insErr ??
          new Error(
            "Evidence identity was not returned."
          )
        );
      }

      const {
        data: lineageResult,
        error: lineageError,
      } = await supabase.rpc(
        "link_evidence_to_occurrence_resources",
        {
          p_evidence_id: evidenceRow.id,
          p_occurrence_id: occurrenceId,
        }
      );

      const lineagePayload =
        lineageResult as {
          ok?: boolean;
          error?: string | null;
          linked_count?: number;
        } | null;

      if (
        lineageError ||
        !lineagePayload?.ok
      ) {
        // Do not leave evidence claiming complete lineage
        // when its occurrence-resource relationship failed.
        await supabase
          .from("lesson_evidence")
          .delete()
          .eq("id", evidenceRow.id)
          .eq("teacher_id", teacherId);

        throw new Error(
          lineageError?.message ??
          lineagePayload?.error ??
          "Evidence resource lineage could not be saved."
        );
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)",
        zIndex: 960, display: "flex", alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "20px 20px 0 0", width: "100%",
          maxHeight: "88vh", overflowY: "auto", padding: "18px 16px 28px",
          animation: "slideUp 0.2s ease",
        }}
      >
        <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1e1b4b", marginBottom: 14 }}>
          Log Learning Evidence
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>TYPE</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {TYPES.map(t => (
            <div
              key={t.key}
              onClick={() => setType(t.key)}
              style={{
                fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 10,
                cursor: "pointer",
                background: type === t.key ? "#10b981" : "#f3f4f6",
                color: type === t.key ? "#fff" : "#374151",
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>TITLE</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Group experiment on plant growth"
          style={{
            width: "100%", border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "10px 12px", fontSize: 13, marginBottom: 14, boxSizing: "border-box",
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>NOTES (optional)</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What did you observe?"
          style={{
            width: "100%", border: "1px solid #e5e7eb", borderRadius: 10,
            padding: "10px 12px", fontSize: 13, marginBottom: 14, boxSizing: "border-box",
            fontFamily: "inherit", resize: "vertical",
          }}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>SCORE (optional)</div>
            <input
              value={score}
              onChange={(e) => setScore(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="e.g. 8"
              inputMode="decimal"
              style={{
                width: "100%", border: "1px solid #e5e7eb", borderRadius: 10,
                padding: "10px 12px", fontSize: 13, boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>PHOTO (optional)</div>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px dashed #d1d5db", borderRadius: 10, padding: "9px 12px",
              fontSize: 12, color: "#6b7280", cursor: "pointer",
            }}>
              {photoPreview ? "Change photo" : "Add photo"}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        {photoPreview && (
          <img src={photoPreview} alt="preview" style={{ width: "100%", borderRadius: 10, marginBottom: 14, maxHeight: 160, objectFit: "cover" }} />
        )}

        {error && (
          <div style={{ fontSize: 12, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <div
            onClick={onClose}
            style={{
              flex: 1, textAlign: "center", padding: "12px", borderRadius: 12,
              fontSize: 13, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", cursor: "pointer",
            }}
          >
            Cancel
          </div>
          <div
            onClick={() => !saving && submit()}
            style={{
              flex: 2, textAlign: "center", padding: "12px", borderRadius: 12,
              fontSize: 13, fontWeight: 700, color: "#fff",
              background: saving ? "#a7f3d0" : "#10b981", cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save Evidence"}
          </div>
        </div>
      </div>
    </div>
  );
}
