"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const EVIDENCE_BUCKET = "lesson-evidence";
const MAX_EVIDENCE_IMAGE_BYTES = 20 * 1024 * 1024;
const TYPES = [
  { key: "observation", label: "Observation" },
  { key: "classwork", label: "Classwork" },
  { key: "exercise", label: "Exercise" },
  { key: "project", label: "Project" },
  { key: "practical", label: "Practical" },
  { key: "quiz", label: "Quiz" },
] as const;

type EvidenceType = (typeof TYPES)[number]["key"];

interface Props {
  lessonId: string;
  occurrenceId: string;
  classId: string;
  teacherId: string;
  defaultTitle?: string;
  onClose: () => void;
  onSaved: () => void;
}

function evidenceObjectPath(mediaRef: string | null): string | null {
  if (!mediaRef) return null;
  const prefix = `${EVIDENCE_BUCKET}://`;
  return mediaRef.startsWith(prefix) ? mediaRef.slice(prefix.length) : null;
}

function safeExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic") return "heic";
  if (file.type === "image/heif") return "heif";
  return "jpg";
}

export default function EvidenceCaptureSheet({
  lessonId,
  occurrenceId,
  classId,
  teacherId,
  defaultTitle,
  onClose,
  onSaved,
}: Props) {
  const [type, setType] = useState<EvidenceType>("observation");
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [description, setDescription] = useState("");
  const [score, setScore] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for lesson evidence.");
      return;
    }
    if (file.size > MAX_EVIDENCE_IMAGE_BYTES) {
      setError("The evidence photo must be 20 MB or smaller.");
      return;
    }

    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return null;

    const objectPath = `${teacherId}/${occurrenceId}/${crypto.randomUUID()}.${safeExtension(photoFile)}`;
    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(objectPath, photoFile, {
        cacheControl: "3600",
        contentType: photoFile.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Evidence photo could not be uploaded: ${uploadError.message}`);
    }

    return `${EVIDENCE_BUCKET}://${objectPath}`;
  }

  async function removeUploadedPhoto(mediaRef: string | null): Promise<void> {
    const objectPath = evidenceObjectPath(mediaRef);
    if (!objectPath) return;
    const { error: removeError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .remove([objectPath]);
    if (removeError) {
      console.error("[EvidenceCapture] orphan cleanup failed", removeError);
    }
  }

  async function submit() {
    if (!title.trim()) {
      setError("Give it a short title.");
      return;
    }
    if (!occurrenceId) {
      setError("Start the lesson before adding classroom evidence.");
      return;
    }

    const parsedScore = score.trim() ? Number(score) : null;
    if (parsedScore !== null && !Number.isFinite(parsedScore)) {
      setError("Enter a valid numeric score.");
      return;
    }

    setSaving(true);
    setError(null);
    let mediaRef: string | null = null;
    let evidenceId: string | null = null;

    try {
      mediaRef = await uploadPhoto();

      const { data: evidenceRow, error: insertError } = await supabase
        .from("lesson_evidence")
        .insert({
          lesson_id: lessonId,
          teaching_occurrence_id: occurrenceId,
          class_id: classId,
          teacher_id: teacherId,
          student_id: null,
          evidence_type: type,
          title: title.trim(),
          description: description.trim() || null,
          media_url: mediaRef,
          score: parsedScore,
        })
        .select("id")
        .single();

      if (insertError || !evidenceRow?.id) {
        throw insertError ?? new Error("Evidence identity was not returned.");
      }
      evidenceId = evidenceRow.id;

      const { data: lineageResult, error: lineageError } = await supabase.rpc(
        "link_evidence_to_occurrence_resources",
        {
          p_evidence_id: evidenceId,
          p_occurrence_id: occurrenceId,
        },
      );

      const lineagePayload = lineageResult as {
        ok?: boolean;
        error?: string | null;
        linked_count?: number;
      } | null;

      if (lineageError || !lineagePayload?.ok) {
        throw new Error(
          lineageError?.message ??
            lineagePayload?.error ??
            "Evidence resource lineage could not be saved.",
        );
      }

      onSaved();
      onClose();
    } catch (caught: unknown) {
      if (evidenceId) {
        const { error: rollbackError } = await supabase
          .from("lesson_evidence")
          .delete()
          .eq("id", evidenceId)
          .eq("teacher_id", teacherId);
        if (rollbackError) {
          console.error("[EvidenceCapture] evidence rollback failed", rollbackError);
        }
      }
      await removeUploadedPhoto(mediaRef);
      setError(caught instanceof Error ? caught.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.45)",
        zIndex: 960,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#fff",
          color: "#111827",
          colorScheme: "light",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "18px 16px 28px",
          animation: "slideUp 0.2s ease",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            background: "#e5e7eb",
            borderRadius: 4,
            margin: "0 auto 16px",
          }}
        />
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1e1b4b", marginBottom: 14 }}>
          Log Learning Evidence
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
          TYPE
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {TYPES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setType(item.key)}
              aria-pressed={type === item.key}
              style={{
                border: 0,
                fontSize: 12,
                fontWeight: 700,
                padding: "7px 12px",
                borderRadius: 10,
                cursor: "pointer",
                background: type === item.key ? "#10b981" : "#f3f4f6",
                color: type === item.key ? "#fff" : "#374151",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
          TITLE
        </label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Group experiment on plant growth"
          style={{
            width: "100%",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
            color: "#111827",
            background: "#fff",
            caretColor: "#111827",
            marginBottom: 14,
            boxSizing: "border-box",
          }}
        />

        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
          NOTES (optional)
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="What did you observe?"
          style={{
            width: "100%",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
            color: "#111827",
            background: "#fff",
            caretColor: "#111827",
            marginBottom: 14,
            boxSizing: "border-box",
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
              SCORE (optional)
            </label>
            <input
              value={score}
              onChange={(event) => setScore(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="e.g. 8"
              inputMode="decimal"
              style={{
                width: "100%",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13,
                color: "#111827",
                background: "#fff",
                caretColor: "#111827",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
              PHOTO (optional)
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed #d1d5db",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 12,
                color: "#6b7280",
                cursor: "pointer",
              }}
            >
              {photoPreview ? "Change photo" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhoto}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>

        {photoPreview && (
          <img
            src={photoPreview}
            alt="Evidence preview"
            style={{
              width: "100%",
              borderRadius: 10,
              marginBottom: 14,
              maxHeight: 160,
              objectFit: "cover",
            }}
          />
        )}

        {error && (
          <div
            role="alert"
            style={{
              fontSize: 12,
              color: "#b91c1c",
              background: "#fef2f2",
              borderRadius: 8,
              padding: "8px 10px",
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1,
              border: 0,
              padding: 12,
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              color: "#6b7280",
              background: "#f3f4f6",
              cursor: saving ? "default" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            style={{
              flex: 2,
              border: 0,
              padding: 12,
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: saving ? "#a7f3d0" : "#10b981",
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save Evidence"}
          </button>
        </div>
      </div>
    </div>
  );
}
