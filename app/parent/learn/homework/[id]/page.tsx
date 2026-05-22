"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface HomeworkDetail {
  id: string;
  subject: string;
  title: string;
  instructions: string | null;
  type: "smart" | "book";
  due_date: string;
  class_id: string;
  teacher_id: string;
  teacher_name: string;
}

interface SubmissionDetail {
  id: string;
  status: "pending" | "submitted" | "marked" | "draft";
  mark: number | null;
  feedback: string | null;
  submitted_at: string | null;
  photo_url: string | null;
}

export default function HomeworkDetailCanvas() {
  const router = useRouter();
  const params = useParams();
  const homeworkId = params?.id as string;

  const [homework, setHomework] = useState<HomeworkDetail | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Local optimistic state for file handling
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!homeworkId) return;

    async function fetchHomeworkDeepContext() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch current assignment details
        const { data: hwData, error: hwError } = await supabase
          .from("homework")
          .select("id, subject, title, instructions, type, due_date, class_id, teacher_id")
          .eq("id", homeworkId)
          .single();

        if (hwError) throw new Error(hwError.message);
        if (!hwData) throw new Error("Assignment details could not be found.");

        // 2. Fetch teacher's human-readable name from profiles map
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", hwData.teacher_id)
          .single();

        // 3. Fetch specific submission context matching this homework node
        const { data: subData, error: subError } = await supabase
          .from("homework_submissions")
          .select("id, status, mark, feedback, submitted_at, photo_url")
          .eq("homework_id", homeworkId)
          .maybeSingle();

        if (subError) throw new Error(subError.message);

        setHomework({
          ...hwData,
          teacher_name: profileData?.full_name || "Class Teacher",
        });

        if (subData) {
          setSubmission({
            id: subData.id,
            status: subData.status as SubmissionDetail["status"],
            mark: subData.mark,
            feedback: subData.feedback,
            submitted_at: subData.submitted_at,
            photo_url: subData.photo_url,
          });
          if (subData.photo_url) {
            setPreviewUrl(subData.photo_url);
          }
        }
      } catch (err: unknown) {
        setError("Unable to initialize secure homework session view. Please check your data network.");
      } finally {
        setLoading(false);
      }
    }

    fetchHomeworkDeepContext();
  }, [homeworkId]);

  // Handler for snapping or selecting physical workbook photos
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size barrier safeguard check (Max 12MB portfolio images)
    if (file.size > 12 * 1024 * 1024) {
      alert("File is too large. Please upload an image under 12MB.");
      return;
    }

    // Set optimistic immediate visual preview container matching high-end specs
    const localObjectUrl = URL.createObjectURL(file);
    setPreviewUrl(localObjectUrl);
    setUploading(true);

    try {
      // 1. Authenticate session trace pointer matching current context
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Session expired.");

      // 2. Push direct to secure cloud bucket workspace pathing structure
      const fileExt = file.name.split(".").pop();
      const filePath = `submissions/${auth.user.id}/${homeworkId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("homework_vault")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      // Obtain deterministic public edge-cached access distribution URL
      const { data: urlData } = supabase.storage
        .from("homework_vault")
        .getPublicUrl(filePath);

      const computedPhotoUrl = urlData.publicUrl;

      if (submission?.id) {
        // Update existing record slot
        const { error: updateError } = await supabase
          .from("homework_submissions")
          .update({
            photo_url: computedPhotoUrl,
            status: "submitted",
            submitted_at: new Date().toISOString(),
          })
          .eq("id", submission.id);

        if (updateError) throw updateError;
        setSubmission(prev => prev ? { ...prev, status: "submitted", photo_url: computedPhotoUrl } : null);
      } else {
        // Insert clean first-time record reference row trace pool allocation
        const { data: newSub, error: insertError } = await supabase
          .from("homework_submissions")
          .insert({
            homework_id: homeworkId,
            student_id: auth.user.id, // Fallback mapped to active context
            photo_url: computedPhotoUrl,
            status: "submitted",
            submitted_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newSub) {
          setSubmission({
            id: newSub.id,
            status: "submitted",
            mark: null,
            feedback: null,
            submitted_at: newSub.submitted_at,
            photo_url: computedPhotoUrl,
          });
        }
      }
    } catch (err: unknown) {
      alert("Network transmission dropped. Retrying sync layout...");
      setPreviewUrl(submission?.photo_url || null);
    } finally {
      setUploading(false);
    }
  };

  const triggerCameraInput = () => {
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "24px 16px", backgroundColor: "var(--color-bg)", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ height: "40px", width: "80px", background: "var(--color-border)", borderRadius: "8px", marginBottom: "24px" }} />
        <div style={{ height: "24px", width: "40%", background: "var(--color-border)", borderRadius: "6px", marginBottom: "12px" }} />
        <div style={{ height: "32px", width: "85%", background: "var(--color-border)", borderRadius: "8px", marginBottom: "32px" }} />
        <div style={{ height: "200px", width: "100%", background: "var(--color-border)", borderRadius: "16px" }} />
      </div>
    );
  }

  if (error || !homework) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 16px", textTransform: "none", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>📡</div>
        <p style={{ fontSize: "14px", color: "var(--color-muted)", lineHeight: "1.5" }}>{error || "Assignment matrix record missing."}</p>
        <button onClick={() => router.push("/parent/learn")} style={{ marginTop: "16px", padding: "10px 20px", background: "var(--color-dark)", color: "#fff", border: "none", borderRadius: "12px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
          Return to Learning Hub
        </button>
      </div>
    );
  }

  const isMarked = submission?.status === "marked";
  const isSubmitted = submission?.status === "submitted";

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", backgroundColor: "var(--color-bg)", minHeight: "100vh", fontFamily: "system-ui, sans-serif", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      
      {/* HEADER NAVIGATION STRIP */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <button 
          onClick={() => router.push("/parent/learn")}
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "8px 14px", borderRadius: "12px", fontSize: "13px", fontWeight: "600", color: "var(--color-dark)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", outline: "none" }}
        >
          ← Back
        </button>
        <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Assignment Canvas
        </div>
      </div>

      {/* CORE INFO SUMMARY PANEL CARD */}
      <div style={{ backgroundColor: "var(--color-surface)", borderRadius: "20px", border: "1px solid var(--color-border)", padding: "20px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.01)" }}>
        <div style={{ display: "inline-block", background: "var(--color-dark)", color: "#ffffff", fontSize: "10px", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase", marginBottom: "10px" }}>
          {homework.subject}
        </div>
        <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "800", color: "var(--color-dark)", lineHeight: "1.3" }}>
          {homework.title}
        </h2>
        <div style={{ fontSize: "12px", color: "var(--color-muted)", fontWeight: "500", marginBottom: "14px" }}>
          Assigned by {homework.teacher_name}
        </div>
        
        <div style={{ background: "var(--color-bg)", borderRadius: "12px", padding: "12px 14px", border: "1px solid var(--color-border)" }}>
          <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--color-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
            Teacher Guidelines
          </span>
          <p style={{ margin: "0", fontSize: "13.5px", color: "var(--color-dark)", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
            {homework.instructions || "Review instructions listed in your child's primary physical notebook tracker line items."}
          </p>
        </div>
      </div>

      {/* DYNAMIC PROGRESS / ACTION RADAR COMPONENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* CASE A: ASSIGNMENT IS ALREADY EVALUATED & MARKED BY TEACHER */}
        {isMarked && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Visual Grading Gauge */}
            <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "1px solid #bbf7d0", borderRadius: "20px", padding: "20px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", width: "80px", height: "80px", borderRadius: "50%", background: "#ffffff", border: "4px solid #166534", boxShadow: "0 4px 10px rgba(0,0,0,0.04)", marginBottom: "12px" }}>
                <span style={{ fontSize: "22px", fontWeight: "900", color: "#166534" }}>
                  {submission?.mark ?? "--"}
                </span>
              </div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "700", color: "#14532d" }}>Evaluation Verified</h3>
              <p style={{ margin: "0", fontSize: "12px", color: "#166534", fontWeight: "500" }}>
                Points earned on final assessment verification checklist return grid
              </p>
            </div>

            {/* Teacher Feedback Container block layout */}
            {submission?.feedback && (
              <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "16px" }}>
                <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--color-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                  Teacher Comments & Remarks
                </span>
                <p style={{ margin: "0", fontSize: "13.5px", color: "var(--color-dark)", lineHeight: "1.5", fontStyle: "italic" }}>
                  &ldquo;{submission.feedback}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {/* CASE B: SENT AND WAITING FOR REVIEW CHRONO MODULES */}
        {isSubmitted && !isMarked && (
          <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>⏳</span>
            <div>
              <h4 style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "700", color: "#92400e" }}>Awaiting Review</h4>
              <p style={{ margin: "0", fontSize: "12px", color: "#b45309", lineHeight: "1.4" }}>
                The work has been transmitted cleanly to the class queue desk dashboard feed tracking streams.
              </p>
            </div>
          </div>
        )}

        {/* MEDIA PREVIEW PORTFOLIO BOX & ACTION OVERLAYS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Workbook Media Submission
          </span>

          {previewUrl ? (
            <div style={{ position: "relative", width: "100%", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", display: "flex", flexDirection: "column" }}>
              <img 
                src={previewUrl} 
                alt="Workbook trace stream attachment grid" 
                style={{ width: "100%", height: "auto", maxHeight: "320px", objectFit: "contain", background: "#111" }} 
              />
              {uploading && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "24px", height: "24px", border: "3px solid var(--color-border)", borderTopColor: "var(--color-dark)", borderRadius: "50%", animation: "spin 1s infinite linear", marginBottom: "8px" }} />
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--color-dark)" }}>Uploading page capture to server secure logs...</span>
                  <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}} />
                </div>
              )}
              
              {/* Allow re-take functionality if not finalized by a mark return record lookup */}
              {!isMarked && !uploading && (
                <button 
                  onClick={triggerCameraInput}
                  style={{ padding: "12px", background: "rgba(0,0,0,0.04)", border: "none", borderTop: "1px solid var(--color-border)", fontSize: "13px", fontWeight: "600", color: "var(--color-dark)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", outline: "none" }}
                >
                  📸 Replace Page Capture Image
                </button>
              )}
            </div>
          ) : (
            /* Premium Empty State Character Wrapper for Actionable Captures */
            <div 
              onClick={triggerCameraInput}
              style={{ border: "2px dashed var(--color-border)", borderRadius: "16px", padding: "40px 20px", textAlign: "center", backgroundColor: "var(--color-surface)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
            >
              <div style={{ fontSize: "36px" }}>📷</div>
              <div>
                <h4 style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "700", color: "var(--color-dark)" }}>Take Homework Photo</h4>
                <p style={{ margin: "0", fontSize: "12px", color: "var(--color-muted)", lineHeight: "1.4" }}>
                  Snap a clear picture of your child&apos;s completed notebook execution page.
                </p>
              </div>
            </div>
          )}

          {/* Hidden HTML system native stream pipeline bindings */}
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
          />
        </div>

        {/* BOTTOM EMOTIONAL ACCELERATOR ROW FOR CHAT CONNECT ROUTING CONTROLS */}
        {isMarked && (
          <button
            onClick={() => router.push("/parent/connect")}
            style={{ marginTop: "auto", width: "100%", padding: "14px", border: "none", borderRadius: "14px", backgroundColor: "var(--color-dark)", color: "var(--color-surface)", fontSize: "14px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", outline: "none" }}
          >
            💬 Discuss Assignment Performance with Teacher
          </button>
        )}

      </div>
    </div>
  );
}
