"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Source = { publicationId: string; chapterId: string; chapterTitle: string };
type AssessmentType = "quiz" | "test" | "exam";
type GeneratedQuestion = { prompt?: string; options?: string[]; marks?: number };
type GenerationResult = { assessment_id?: string; title?: string; questions?: GeneratedQuestion[]; degraded?: boolean; error?: string };

export function TeacherContentDeriveLauncher() {
  const router = useRouter();
  const [teacher, setTeacher] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<AssessmentType | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    void sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (!cancelled) setTeacher(profile?.role === "teacher" || profile?.role === "admin");
    });

    function handleChapter(event: Event) {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (typeof detail?.publicationId !== "string" || typeof detail?.chapterId !== "string") return;
      const heading = document.querySelector("#reader-active-unit h2")?.textContent?.trim() || "This unit";
      setSource({ publicationId: detail.publicationId, chapterId: detail.chapterId, chapterTitle: heading });
      setResult(null);
      setError("");
    }

    window.addEventListener("vibe:reader-chapter", handleChapter);
    return () => { cancelled = true; window.removeEventListener("vibe:reader-chapter", handleChapter); };
  }, []);

  async function generate(type: AssessmentType) {
    if (!source || busy) return;
    setBusy(type);
    setError("");
    setResult(null);
    try {
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data, error: invokeError } = await sb.functions.invoke("content-assessment-generate", {
        body: {
          chapterId: source.chapterId,
          assessmentType: type,
          title: `${source.chapterTitle} ${type}`,
          questionCount: type === "exam" ? 15 : type === "test" ? 10 : 6,
        },
      });
      if (invokeError) throw invokeError;
      const generated = (data ?? {}) as GenerationResult;
      if (generated.error || !generated.assessment_id) throw new Error(generated.error || "Assessment draft was not saved.");
      setResult(generated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Assessment draft could not be generated.");
    } finally {
      setBusy(null);
    }
  }

  if (!teacher || !source) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Create teaching material from this unit"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", left: 16, bottom: 18, zIndex: 82,
          border: "1px solid rgba(204,255,0,.45)", borderRadius: 999,
          background: "#111827", color: "#CCFF00", padding: "11px 15px",
          fontSize: 12, fontWeight: 900, boxShadow: "0 10px 30px rgba(0,0,0,.28)", cursor: "pointer",
        }}
      >
        Create from unit
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Create from this unit" onMouseDown={e => { if (e.currentTarget === e.target) setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 720, maxHeight: "88dvh", overflowY: "auto", background: "#090D16", borderRadius: "22px 22px 0 0", padding: 18, boxSizing: "border-box", color: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div><div style={{ fontSize: 17, fontWeight: 900 }}>Create from this unit</div><div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, marginTop: 4 }}>{source.chapterTitle}</div></div>
              <button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: "transparent", color: "white", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>

            <p style={{ color: "rgba(255,255,255,.6)", fontSize: 12, lineHeight: 1.6 }}>Drafts are grounded only in this chapter and retain their exact source resource/block provenance. Review before using with learners.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
              {(["quiz","test","exam"] as AssessmentType[]).map(type => (
                <button key={type} type="button" disabled={Boolean(busy)} onClick={() => void generate(type)} style={{ border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, background: busy === type ? "rgba(204,255,0,.12)" : "#111827", color: busy === type ? "#CCFF00" : "white", padding: "12px 8px", fontWeight: 850, cursor: busy ? "wait" : "pointer", textTransform: "capitalize" }}>
                  {busy === type ? "Creating…" : type}
                </button>
              ))}
            </div>

            {error && <div role="alert" style={{ color: "#ff8a8a", marginTop: 14, fontSize: 12 }}>{error}</div>}

            {result?.assessment_id && (
              <div style={{ marginTop: 16, border: "1px solid rgba(204,255,0,.25)", background: "rgba(204,255,0,.05)", borderRadius: 14, padding: 14 }}>
                <div style={{ color: "#CCFF00", fontSize: 11, fontWeight: 900 }}>DRAFT SAVED</div>
                <strong style={{ display: "block", marginTop: 5 }}>{result.title}</strong>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.6)" }}>{result.questions?.length ?? 0} questions{result.degraded ? " · source-only fallback used" : " · AI drafted from source"}</div>
                <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
                  {(result.questions ?? []).slice(0, 3).map((question, index) => <div key={index} style={{ fontSize: 12, lineHeight: 1.5 }}>{index + 1}. {question.prompt}</div>)}
                </div>
                <button type="button" onClick={() => router.push(`/teacher/content-assessments/${result.assessment_id}`)} style={{ width: "100%", marginTop: 14, border: 0, borderRadius: 11, background: "#CCFF00", color: "#090D16", padding: 12, fontWeight: 900, cursor: "pointer" }}>
                  Review and edit draft
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
