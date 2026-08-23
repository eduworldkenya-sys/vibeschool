"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { parseLessonPlanBody } from "@/lib/teaching/lessonPlanCodec";
import type { LessonPlanSections } from "@/lib/teaching/lessonPlanCodec";

type PlanRow = {
  id: string;
  title: string | null;
  topic: string | null;
  body: string | null;
  scheme_id: string | null;
  curriculum_id: string | null;
  status: string | null;
};

type ResourceRow = {
  linkId: string;
  resourceId: string;
  title: string;
  description: string | null;
  publicationId: string | null;
  chapterId: string | null;
  pageStart: number | null;
  canRead: boolean;
};

type ExactChapterRow = {
  id: string;
  title: string | null;
  publication_id: string;
  canRead: boolean;
};

type ReaderPayload = {
  ok?: boolean;
  chapters?: Array<{ id?: string; can_read?: boolean }>;
};

type ContentState = "linked" | "curriculum_fallback" | "locked" | "missing" | "broken";

const sectionOrder: Array<{ key: keyof LessonPlanSections; label: string }> = [
  { key: "objectives", label: "Curriculum objective" },
  { key: "introduction", label: "Start the lesson" },
  { key: "development", label: "What to explain" },
  { key: "resources", label: "Example or activity" },
  { key: "consolidation", label: "Quick check" },
  { key: "homework", label: "Homework or exercise" },
  { key: "assessmentHook", label: "Assessment" },
  { key: "differentiation", label: "Next step and learner support" },
];

function cleanText(value: string | undefined): string {
  return (value ?? "").trim();
}

async function recordEvent(eventName: string, contentState: ContentState, extra: Record<string, unknown> = {}) {
  try {
    await supabase.rpc("pilot_record_event", {
      p_event_name: eventName,
      p_surface: "teacher/lesson-notes",
      p_outcome: eventName.includes("broken") || eventName.includes("unavailable") ? "failed" : eventName.includes("blocked") ? "denied" : "succeeded",
      p_metadata: { content_state: contentState, ...extra },
    });
  } catch {
    // Telemetry must never block teaching.
  }
}

async function chapterCanRead(publicationId: string, chapterId: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_vibetextbook_reader", { publication_id_input: publicationId });
  if (error || !data) return false;
  const payload = data as ReaderPayload;
  if (!payload.ok) return false;
  if (!chapterId) return true;
  return Boolean(payload.chapters?.find((chapter) => chapter.id === chapterId)?.can_read);
}

function LessonNotesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const lessonPlanId = params.get("lessonPlanId");

  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [exactChapters, setExactChapters] = useState<ExactChapterRow[]>([]);
  const [contentState, setContentState] = useState<ContentState>("missing");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => (plan?.body ? parseLessonPlanBody(plan.body) : null), [plan?.body]);

  const load = useCallback(async () => {
    if (!lessonPlanId) {
      setError("Open lesson notes from a lesson so VibeSchool knows what to prepare.");
      setContentState("broken");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setResources([]);
    setExactChapters([]);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login/teacher");
        return;
      }

      const { data: planData, error: planError } = await supabase
        .from("lesson_plans")
        .select("id,title,topic,body,scheme_id,curriculum_id,status")
        .eq("id", lessonPlanId)
        .single();

      if (planError || !planData) throw new Error("This lesson plan is not available to your account.");

      const typedPlan = planData as PlanRow;
      setPlan(typedPlan);
      void recordEvent("teacher.lesson_notes_opened", "missing");

      let subStrandId: string | null = null;
      let curriculumId: string | null = typedPlan.curriculum_id ?? null;

      if (typedPlan.scheme_id) {
        const { data: schemeData, error: schemeError } = await supabase
          .from("scheme_of_work")
          .select("curriculum_id,sub_strand_id")
          .eq("id", typedPlan.scheme_id)
          .maybeSingle();
        if (schemeError) throw new Error("The lesson curriculum identity could not be verified.");
        if (typedPlan.curriculum_id && schemeData?.curriculum_id && typedPlan.curriculum_id !== schemeData.curriculum_id) {
          setContentState("broken");
          void recordEvent("teacher.lesson_content_broken", "broken", { error_code: "curriculum_identity_conflict" });
          throw new Error("This lesson has conflicting curriculum identity. VibeSchool has hidden external material to avoid showing the wrong content.");
        }
        subStrandId = schemeData?.sub_strand_id ?? null;
        curriculumId = schemeData?.curriculum_id ?? curriculumId;
      }

      const { data: resourceResult, error: resourceError } = await supabase.rpc("list_teaching_resources", {
        p_target_type: "lesson_plan",
        p_target_id: lessonPlanId,
      });

      if (resourceError) throw new Error("Verified lesson resources could not be checked safely.");

      const payload = resourceResult as {
        ok?: boolean;
        error?: string;
        resources?: Array<{
          link_id?: string;
          resource_id?: string;
          title?: string;
          description?: string | null;
          publication_id?: string | null;
          chapter_id?: string | null;
          page_start?: number | null;
        }>;
      } | null;

      if (payload?.ok === false) throw new Error("This lesson's resources are not available to your account.");

      const linked = await Promise.all((payload?.resources ?? []).flatMap((item) => {
        if (!item.link_id || !item.resource_id) return [];
        return [async (): Promise<ResourceRow> => ({
          linkId: item.link_id!,
          resourceId: item.resource_id!,
          title: item.title ?? "Teaching resource",
          description: item.description ?? null,
          publicationId: item.publication_id ?? null,
          chapterId: item.chapter_id ?? null,
          pageStart: item.page_start ?? null,
          canRead: item.publication_id ? await chapterCanRead(item.publication_id, item.chapter_id ?? null) : true,
        })];
      }).map((build) => build()));

      if (linked.length > 0) {
        setResources(linked);
        const readable = linked.filter((item) => item.canRead).length;
        const state: ContentState = readable > 0 ? "linked" : "locked";
        setContentState(state);
        void recordEvent(readable > 0 ? "teacher.lesson_content_found" : "teacher.lesson_content_entitlement_blocked", state, { resource_count: linked.length });
        return;
      }

      if (!subStrandId && !curriculumId) {
        setContentState("missing");
        void recordEvent("teacher.lesson_content_unavailable", "missing");
        return;
      }

      let chapterQuery = supabase
        .from("vibe_chapters")
        .select("id,title,publication_id")
        .eq("status", "published")
        .eq("alignment_status", "verified")
        .limit(8);

      chapterQuery = subStrandId
        ? chapterQuery.eq("sub_strand_id", subStrandId)
        : chapterQuery.eq("curriculum_id", curriculumId as string);

      const { data: chapterData, error: chapterError } = await chapterQuery;
      if (chapterError) throw new Error("Verified curriculum material could not be checked safely.");

      const candidates = (chapterData ?? []) as Array<{ id: string; title: string | null; publication_id: string }>;
      if (candidates.length === 0) {
        setContentState("missing");
        void recordEvent("teacher.lesson_content_unavailable", "missing");
        return;
      }

      const publicationIds = Array.from(new Set(candidates.map((chapter) => chapter.publication_id)));
      const { data: publications, error: publicationError } = await supabase
        .from("vibe_publications")
        .select("id,status")
        .in("id", publicationIds)
        .eq("status", "published");
      if (publicationError) throw new Error("Verified publication status could not be checked safely.");
      const publishedIds = new Set((publications ?? []).map((publication) => publication.id));

      const exact = await Promise.all(candidates
        .filter((chapter) => publishedIds.has(chapter.publication_id))
        .map(async (chapter): Promise<ExactChapterRow> => ({
          ...chapter,
          canRead: await chapterCanRead(chapter.publication_id, chapter.id),
        })));

      setExactChapters(exact);
      if (exact.length === 0) {
        setContentState("missing");
        void recordEvent("teacher.lesson_content_unavailable", "missing");
      } else if (exact.some((chapter) => chapter.canRead)) {
        setContentState("curriculum_fallback");
        void recordEvent("teacher.lesson_curriculum_fallback_used", "curriculum_fallback");
      } else {
        setContentState("locked");
        void recordEvent("teacher.lesson_content_entitlement_blocked", "locked");
      }
    } catch (loadError) {
      console.error("[lesson-notes] load", loadError);
      setError(loadError instanceof Error ? loadError.message : "Lesson notes could not be opened.");
      setContentState((current) => current === "broken" ? current : "broken");
    } finally {
      setLoading(false);
    }
  }, [lessonPlanId, router]);

  useEffect(() => { void load(); }, [load]);

  function openPublication(publicationId: string, chapterId: string | null, pageStart?: number | null) {
    const next = new URLSearchParams();
    if (chapterId) next.set("chapterId", chapterId);
    if (pageStart != null) next.set("page", String(pageStart));
    void recordEvent("teacher.lesson_resource_opened", contentState, { resource_type: chapterId ? "chapter" : "publication" });
    router.push(`/read/textbook/${publicationId}${next.toString() ? `?${next.toString()}` : ""}`);
  }

  if (loading) return <main style={{ padding: 16 }}><div style={{ height: 28, width: 180, borderRadius: 8, background: "#f3f4f6", marginBottom: 12 }} /><div style={{ height: 120, borderRadius: 18, background: "#f3f4f6" }} /></main>;

  if (error || !plan) return (
    <main style={{ padding: 20 }}>
      <button type="button" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontWeight: 800, padding: 0, marginBottom: 18 }}>← Back</button>
      <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 18, padding: 18 }}>
        <div style={{ fontWeight: 900, color: "#991b1b" }}>Lesson material stopped safely</div>
        <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{error}</div>
        <button type="button" onClick={() => void load()} style={{ marginTop: 12, border: 0, borderRadius: 10, padding: "9px 12px", fontWeight: 800 }}>Try again</button>
      </div>
    </main>
  );

  const visibleSections = sections ? sectionOrder.filter(({ key }) => cleanText(sections[key]).length > 0) : [];
  const hasExternalMaterial = resources.length > 0 || exactChapters.length > 0;

  return (
    <main style={{ padding: "12px 14px 32px", maxWidth: 760, margin: "0 auto" }}>
      <button type="button" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontWeight: 800, padding: "8px 0", color: "#374151" }}>← Back to lesson</button>

      <section style={{ background: "linear-gradient(135deg,#111827,#1f2937)", color: "#fff", borderRadius: 22, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#86efac", textTransform: "uppercase", letterSpacing: 1 }}>Teach now</div>
        <h1 style={{ fontSize: 22, lineHeight: 1.2, margin: "7px 0 5px" }}>{plan.topic || plan.title || "Today’s lesson"}</h1>
        <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.45 }}>Your lesson plan stays first. External material appears only when VibeSchool can prove the curriculum link.</div>
      </section>

      {resources.length > 0 && (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>Verified resources for this lesson</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>These resources are explicitly verified for this lesson.</div>
          <div style={{ display: "grid", gap: 8 }}>
            {resources.map((resource) => (
              <button key={resource.linkId} type="button" disabled={!resource.publicationId || !resource.canRead}
                onClick={() => resource.publicationId && openPublication(resource.publicationId, resource.chapterId, resource.pageStart)}
                style={{ textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb", opacity: resource.canRead ? 1 : 0.65 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{resource.title}</div>
                {resource.description && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{resource.description}</div>}
                <div style={{ fontSize: 11, fontWeight: 800, color: resource.canRead ? "#047857" : "#92400e", marginTop: 7 }}>{resource.canRead ? "Open resource →" : "Locked — access is required"}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {exactChapters.length > 0 && resources.length === 0 && (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>Verified material for this curriculum area</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>These chapters carry the same curriculum identity as this lesson. VibeSchool shows them only after verified alignment and publication checks.</div>
          <div style={{ display: "grid", gap: 8 }}>
            {exactChapters.map((chapter) => (
              <button key={chapter.id} type="button" disabled={!chapter.canRead}
                onClick={() => openPublication(chapter.publication_id, chapter.id)}
                style={{ textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb", opacity: chapter.canRead ? 1 : 0.65 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{chapter.title || "Open chapter"}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: chapter.canRead ? "#047857" : "#92400e", marginTop: 6 }}>{chapter.canRead ? "Open chapter →" : "Locked — access is required"}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {!hasExternalMaterial && (
        <section style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 18, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 900, color: "#78350f" }}>VibeSchool does not yet have verified material for this lesson.</div>
          <div style={{ fontSize: 12, color: "#92400e", marginTop: 6, lineHeight: 1.55 }}>You can still teach safely from your current lesson plan. VibeSchool will not substitute unrelated material.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => router.back()} style={{ border: "1px solid #f59e0b", borderRadius: 10, padding: "8px 10px", background: "#fff", fontWeight: 800 }}>Use lesson plan</button>
            <button type="button" onClick={() => router.push("/teacher/scheme")} style={{ border: "1px solid #f59e0b", borderRadius: 10, padding: "8px 10px", background: "#fff", fontWeight: 800 }}>Open scheme</button>
            <button type="button" onClick={() => router.push("/teacher/studio")} style={{ border: "1px solid #f59e0b", borderRadius: 10, padding: "8px 10px", background: "#fff", fontWeight: 800 }}>Prepare my own resource</button>
          </div>
        </section>
      )}

      {visibleSections.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {visibleSections.map(({ key, label }) => (
            <section key={key} style={{ background: "#fff", borderRadius: 18, padding: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: key === "development" ? "#047857" : "#6b7280", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 7 }}>{label}</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "#1f2937", lineHeight: 1.65 }}>{sections ? sections[key] : ""}</div>
            </section>
          ))}
        </div>
      ) : (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 900 }}>No written notes yet</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5 }}>Return to the lesson plan and prepare the lesson. VibeSchool uses that plan as the safe source for this workspace.</div>
        </section>
      )}
    </main>
  );
}

export default function LessonNotesPage() {
  return <Suspense fallback={<main style={{ padding: 16 }}>Opening lesson notes…</main>}><LessonNotesInner /></Suspense>;
}
