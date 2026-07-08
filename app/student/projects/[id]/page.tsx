"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import Skel from "@/components/student/Skel";

interface Project { id: string; title: string; description: string | null; due_date: string | null; }
interface Submission { id: string; status: string; mark: number | null; feedback: string | null; notes: string | null; photo_url: string | null; }

function IconBack() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function IconCamera() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}

export default function ProjectDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { identity, loading: idLoading } = useStudent();

  const [proj,       setProj]       = useState<Project | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [notes,      setNotes]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (idLoading || !identity || !id) return;

    async function load() {
      const { data: p } = await supabase.from("projects").select("id,title,description,due_date").eq("id", id).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProj(p as Project);

      const { data: sub } = await supabase.from("project_submissions").select("*").eq("project_id", id).eq("student_id", identity!.studentId).maybeSingle();
      if (sub) {
        setSubmission(sub as Submission);
        setNotes((sub as Submission).notes ?? "");
        if ((sub as Submission).photo_url) setPhotoPreview((sub as Submission).photo_url);
      }
      setLoading(false);
    }
    load();
  }, [identity, idLoading, id]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(file: File, studentId: string): Promise<string | null> {
    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${studentId}/projects/${id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("homework-photos").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("homework-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function submit() {
    if (!identity || !proj) return;
    if (!photoFile && !photoPreview && !notes.trim()) {
      setError("Add a photo or some notes about your progress.");
      return;
    }

    setSaving(true); setError(null);

    let photoUrl: string | null = submission?.photo_url ?? null;
    if (photoFile) {
      setUploading(true);
      photoUrl = await uploadPhoto(photoFile, identity.studentId);
      setUploading(false);
      if (!photoUrl) { setError("Photo upload failed. Please try again."); setSaving(false); return; }
    }

    if (submission) {
      const { error: err } = await supabase.from("project_submissions")
        .update({ notes: notes.trim() || null, photo_url: photoUrl, status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", submission.id);
      if (err) { setError("Could not save. Try again."); setSaving(false); return; }
      setSubmission({ ...submission, notes: notes.trim() || null, photo_url: photoUrl, status: "submitted" });
    } else {
      const { data: newSub, error: err } = await supabase.from("project_submissions").insert({
        project_id:   proj.id,
        student_id:   identity.studentId,
        notes:        notes.trim() || null,
        photo_url:    photoUrl,
        status:       "submitted",
        submitted_at: new Date().toISOString(),
      }).select().single();
      if (err) { setError("Could not save. Try again."); setSaving(false); return; }
      setSubmission(newSub as Submission);
    }
    setSaving(false);
  }

  if (loading || idLoading) return <div style={{ padding: 24 }}><Skel h={200} /></div>;
  if (!proj) return <div style={{ padding: 24, color: "var(--vs-muted)" }}>Project not found.</div>;

  const isMarked = submission?.status === "marked";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--vs-muted)", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}>
        <IconBack /> Back
      </button>

      <div style={{ background: "linear-gradient(135deg, #92400e 0%, #d97706 100%)", borderRadius: 16, padding: 16, marginBottom: 14, color: "#fff" }}>
        <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{proj.title}</h1>
        {proj.due_date && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>Due {new Date(proj.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</div>}
      </div>

      {proj.description && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>What To Do</div>
          <p style={{ fontSize: 13, color: "var(--vs-text)", lineHeight: 1.7, margin: 0 }}>{proj.description}</p>
        </div>
      )}

      {isMarked && (
        <div style={{ background: "var(--vs-accent-soft)", border: "1px solid var(--vs-accent)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-accent)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Teacher Feedback</div>
          {submission?.mark !== null && submission?.mark !== undefined && (
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-accent)" }}>{submission.mark} pts</div>
          )}
          {submission?.feedback && <p style={{ fontSize: 13, color: "var(--vs-text)", marginTop: 8, lineHeight: 1.6, margin: "8px 0 0" }}>{submission.feedback}</p>}
        </div>
      )}

      {submission?.status === "submitted" && !isMarked && (
        <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 14, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>Submitted — waiting for feedback</div>
        </div>
      )}

      {!isMarked && (
        <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Your Progress</div>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes about your progress (optional)…"
            rows={3}
            style={{ width: "100%", borderRadius: 10, border: "1px solid var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-text)", padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          />

          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display: "none" }} />

          {photoPreview ? (
            <div>
              <img src={photoPreview} alt="Work preview" style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 280, marginBottom: 10 }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px dashed var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Retake photo
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "24px 16px", borderRadius: 12, border: "2px dashed var(--vs-border)", background: "var(--vs-surface)", color: "var(--vs-accent)", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <IconCamera />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Add a photo of your progress</span>
            </button>
          )}

          {error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 10 }}>{error}</div>}

          <button onClick={submit} disabled={saving} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "#92400e", color: "#fff", fontSize: 14, fontWeight: 800, cursor: saving ? "wait" : "pointer", fontFamily: "inherit", marginTop: 14, opacity: saving ? 0.7 : 1 }}>
            {uploading ? "Uploading photo…" : saving ? "Saving…" : submission ? "Update Progress" : "Submit Progress"}
          </button>
        </div>
      )}
    </div>
  );
}
