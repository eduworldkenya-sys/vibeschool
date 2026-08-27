"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Chapter = { id: string; publication_id: string; title: string | null; learning_outcomes: string[] | null };
type Plan = { id: string; title: string | null; topic: string | null; taught_date: string | null; status: string | null };
type Homework = { id: string; title: string; subject: string | null; due_date: string | null };
type RegisteredResource = { id: string; title?: string | null };

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 15 };
const button: React.CSSProperties = { minHeight: 42, border: "1px solid #d1d5db", background: "#fff", borderRadius: 11, padding: "9px 12px", fontWeight: 800, cursor: "pointer", textAlign: "left" };

function FromTextbookInner() {
  const router = useRouter();
  const params = useSearchParams();
  const publicationId = params.get("publicationId");
  const chapterId = params.get("chapterId");
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const returnUrl = useMemo(() => publicationId && chapterId ? `/read/textbook/${publicationId}/${chapterId}` : "/teacher", [publicationId, chapterId]);

  const load = useCallback(async () => {
    if (!publicationId || !chapterId) {
      setError("This teaching handoff is missing its textbook chapter identity.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace(`/login/teacher?next=${encodeURIComponent(`/teacher/from-textbook?publicationId=${publicationId}&chapterId=${chapterId}`)}`);
        return;
      }

      const { data: chapterData, error: chapterError } = await supabase
        .from("vibe_chapters")
        .select("id,publication_id,title,learning_outcomes")
        .eq("id", chapterId)
        .eq("publication_id", publicationId)
        .eq("status", "published")
        .single();
      if (chapterError || !chapterData) throw new Error("This published chapter could not be loaded.");
      setChapter(chapterData as Chapter);

      const { data: registered, error: registerError } = await supabase.rpc("register_learning_resource", {
        p_source_type: "chapter",
        p_source_id: chapterId,
      });
      if (registerError) throw registerError;
      const payload = registered as { ok?: boolean; error?: string; resource?: RegisteredResource } | null;
      if (!payload?.ok || !payload.resource?.id) throw new Error(payload?.error || "Could not prepare this chapter as a teaching resource.");
      setResourceId(payload.resource.id);

      const [planResult, homeworkResult] = await Promise.all([
        supabase.from("lesson_plans").select("id,title,topic,taught_date,status").eq("teacher_id", auth.user.id).order("updated_at", { ascending: false }).limit(12),
        supabase.from("homework").select("id,title,subject,due_date").eq("teacher_id", auth.user.id).order("created_at", { ascending: false }).limit(12),
      ]);
      if (planResult.error) throw planResult.error;
      if (homeworkResult.error) throw homeworkResult.error;
      setPlans((planResult.data ?? []) as Plan[]);
      setHomework((homeworkResult.data ?? []) as Homework[]);
    } catch (e) {
      console.error("[from-textbook] load", e);
      setError(e instanceof Error ? e.message : "The teaching handoff could not be prepared.");
    } finally {
      setLoading(false);
    }
  }, [chapterId, publicationId, router]);

  useEffect(() => { void load(); }, [load]);

  async function attach(targetType: "lesson_plan" | "homework", targetId: string) {
    if (!resourceId) return;
    setBusy(`${targetType}:${targetId}`);
    setMessage(null);
    setError(null);
    try {
      const { data, error: linkError } = await supabase.rpc("link_learning_resource", {
        p_resource_id: resourceId,
        p_target_type: targetType,
        p_target_id: targetId,
        p_usage_role: targetType === "lesson_plan" ? "source" : "practice_source",
        p_sequence: 1,
        p_section_refs: [],
        p_exercise_refs: [],
      });
      if (linkError) throw linkError;
      const payload = data as { ok?: boolean; error?: string } | null;
      if (!payload?.ok) throw new Error(payload?.error || "The chapter could not be linked.");

      setMessage(targetType === "lesson_plan" ? "Chapter linked to the lesson plan." : "Chapter linked to the homework.");
    } catch (e) {
      console.error("[from-textbook] attach", e);
      setError(e instanceof Error ? e.message : "The chapter could not be linked.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <main style={{ padding: 20, maxWidth: 760, margin: "0 auto" }}>Preparing teaching tools…</main>;

  return (
    <main style={{ padding: "14px 14px 36px", maxWidth: 760, margin: "0 auto", background: "#f8fafc", minHeight: "100dvh" }}>
      <button type="button" onClick={() => router.push(returnUrl)} style={{ border: 0, background: "transparent", fontWeight: 850, padding: "8px 0 14px", cursor: "pointer" }}>← Back to chapter</button>

      <section style={{ ...card, background: "linear-gradient(135deg,#111827,#1f2937)", color: "#fff", border: 0, marginBottom: 12 }}>
        <div style={{ color: "#cfff00", textTransform: "uppercase", letterSpacing: 1.1, fontSize: 11, fontWeight: 900 }}>Teacher OS bridge</div>
        <h1 style={{ margin: "7px 0 5px", fontSize: 23, lineHeight: 1.2 }}>{chapter?.title || "Textbook chapter"}</h1>
        <p style={{ margin: 0, color: "#d1d5db", fontSize: 13, lineHeight: 1.55 }}>Use the exact published chapter as a canonical source for teaching work. VibeSchool keeps the publication and chapter identity attached instead of copying the text into a disconnected document.</p>
      </section>

      {chapter?.learning_outcomes?.length ? <section style={{ ...card, marginBottom: 12 }}><strong style={{ fontSize: 13 }}>Chapter outcomes</strong><ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "#4b5563", fontSize: 13, lineHeight: 1.55 }}>{chapter.learning_outcomes.slice(0, 6).map((outcome, i) => <li key={i}>{outcome}</li>)}</ul></section> : null}

      {message ? <div role="status" style={{ ...card, marginBottom: 12, borderColor: "#86efac", background: "#f0fdf4", color: "#166534", fontSize: 13, fontWeight: 750 }}>{message}</div> : null}
      {error ? <div role="alert" style={{ ...card, marginBottom: 12, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 13 }}>{error}</div> : null}

      <section style={{ ...card, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}><div><strong style={{ fontSize: 14 }}>Teach this chapter</strong><div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Attach it to one of your lesson plans.</div></div><button type="button" onClick={() => router.push(`/teacher/lessonplan?sourcePublicationId=${publicationId}&sourceChapterId=${chapterId}`)} style={{ ...button, fontSize: 12 }}>Create lesson →</button></div>
        {plans.length ? <div style={{ display: "grid", gap: 7 }}>{plans.map(plan => <button key={plan.id} type="button" disabled={busy !== null} onClick={() => void attach("lesson_plan", plan.id)} style={{ ...button, opacity: busy && busy !== `lesson_plan:${plan.id}` ? .55 : 1 }}><div style={{ fontSize: 13 }}>{plan.topic || plan.title || "Lesson plan"}</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{plan.taught_date || "Date not set"} · {plan.status || "draft"}{busy === `lesson_plan:${plan.id}` ? " · Linking…" : ""}</div></button>)}</div> : <div style={{ fontSize: 12, color: "#6b7280" }}>No lesson plans yet. Create one, then return here to attach this chapter.</div>}
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}><div><strong style={{ fontSize: 14 }}>Assign from this chapter</strong><div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Attach the chapter to existing homework or create homework first.</div></div><button type="button" onClick={() => router.push(`/teacher/homework?sourcePublicationId=${publicationId}&sourceChapterId=${chapterId}`)} style={{ ...button, fontSize: 12 }}>Create homework →</button></div>
        {homework.length ? <div style={{ display: "grid", gap: 7 }}>{homework.map(item => <button key={item.id} type="button" disabled={busy !== null} onClick={() => void attach("homework", item.id)} style={{ ...button, opacity: busy && busy !== `homework:${item.id}` ? .55 : 1 }}><div style={{ fontSize: 13 }}>{item.title}</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{item.subject || "Subject"}{item.due_date ? ` · due ${item.due_date}` : ""}{busy === `homework:${item.id}` ? " · Linking…" : ""}</div></button>)}</div> : <div style={{ fontSize: 12, color: "#6b7280" }}>No homework found yet. Create homework, then return here to attach this chapter.</div>}
      </section>
    </main>
  );
}

export default function FromTextbookPage() {
  return <Suspense fallback={<main style={{ padding: 20 }}>Preparing teaching tools…</main>}><FromTextbookInner /></Suspense>;
}
