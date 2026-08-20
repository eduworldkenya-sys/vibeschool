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
  strand_id: string | null;
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
};

type ExactChapterRow = {
  id: string;
  title: string | null;
  publication_id: string;
};

const sectionOrder: Array<{ key: keyof LessonPlanSections; label: string }> = [
  { key: "objectives", label: "What learners should achieve" },
  { key: "resources", label: "What you need" },
  { key: "introduction", label: "Start the lesson" },
  { key: "development", label: "Teaching notes" },
  { key: "consolidation", label: "Check understanding" },
  { key: "assessmentHook", label: "Quick assessment" },
  { key: "homework", label: "Follow-up work" },
  { key: "differentiation", label: "Support different learners" },
];

function cleanText(value: string | undefined): string {
  return (value ?? "").trim();
}

function LessonNotesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const lessonPlanId = params.get("lessonPlanId");

  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [exactChapters, setExactChapters] = useState<ExactChapterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => {
    if (!plan?.body) return null;
    return parseLessonPlanBody(plan.body);
  }, [plan?.body]);

  const load = useCallback(async () => {
    if (!lessonPlanId) {
      setError("Open lesson notes from a lesson so VibeSchool knows what to prepare.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login/teacher");
        return;
      }

      const { data: planData, error: planError } = await supabase
        .from("lesson_plans")
        .select("id,title,topic,body,scheme_id,curriculum_id,strand_id,status")
        .eq("id", lessonPlanId)
        .single();

      if (planError || !planData) {
        throw new Error("This lesson plan is not available to your account.");
      }

      const typedPlan = planData as PlanRow;
      setPlan(typedPlan);

      const { data: resourceResult, error: resourceError } = await supabase.rpc(
        "list_teaching_resources",
        { p_target_type: "lesson_plan", p_target_id: lessonPlanId },
      );

      if (!resourceError) {
        const payload = resourceResult as {
          ok?: boolean;
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

        if (payload?.ok) {
          setResources(
            (payload.resources ?? []).flatMap((item) => {
              if (!item.link_id || !item.resource_id) return [];
              return [{
                linkId: item.link_id,
                resourceId: item.resource_id,
                title: item.title ?? "Teaching resource",
                description: item.description ?? null,
                publicationId: item.publication_id ?? null,
                chapterId: item.chapter_id ?? null,
                pageStart: item.page_start ?? null,
              }];
            }),
          );
        }
      }

      if (typedPlan.scheme_id) {
        const { data: schemeData } = await supabase
          .from("scheme_of_work")
          .select("curriculum_id,sub_strand_id")
          .eq("id", typedPlan.scheme_id)
          .maybeSingle();

        const subStrandId = schemeData?.sub_strand_id ?? null;
        const curriculumId = schemeData?.curriculum_id ?? typedPlan.curriculum_id ?? null;

        if (subStrandId || curriculumId) {
          let chapterQuery = supabase
            .from("vibe_chapters")
            .select("id,title,publication_id")
            .eq("status", "published")
            .limit(4);

          chapterQuery = subStrandId
            ? chapterQuery.eq("sub_strand_id", subStrandId)
            : chapterQuery.eq("curriculum_id", curriculumId as string);

          const { data: chapterData } = await chapterQuery;
          setExactChapters((chapterData ?? []) as ExactChapterRow[]);
        }
      }
    } catch (loadError) {
      console.error("[lesson-notes] load", loadError);
      setError(loadError instanceof Error ? loadError.message : "Lesson notes could not be opened.");
    } finally {
      setLoading(false);
    }
  }, [lessonPlanId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function openResource(resource: ResourceRow) {
    if (!resource.publicationId) return;
    const next = new URLSearchParams();
    if (resource.chapterId) next.set("chapterId", resource.chapterId);
    if (resource.pageStart != null) next.set("page", String(resource.pageStart));
    const query = next.toString();
    router.push(`/read/textbook/${resource.publicationId}${query ? `?${query}` : ""}`);
  }

  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <div style={{ height: 28, width: 180, borderRadius: 8, background: "#f3f4f6", marginBottom: 12 }} />
        <div style={{ height: 120, borderRadius: 18, background: "#f3f4f6" }} />
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main style={{ padding: 20 }}>
        <button type="button" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontWeight: 800, padding: 0, marginBottom: 18 }}>← Back</button>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18 }}>
          <div style={{ fontWeight: 900, color: "#111827" }}>Lesson notes are not ready</div>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{error}</div>
        </div>
      </main>
    );
  }

  const visibleSections = sections
    ? sectionOrder.filter(({ key }) => cleanText(sections[key]).length > 0)
    : [];

  return (
    <main style={{ padding: "12px 14px 32px", maxWidth: 760, margin: "0 auto" }}>
      <button type="button" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontWeight: 800, padding: "8px 0", color: "#374151" }}>← Back to lesson</button>

      <section style={{ background: "linear-gradient(135deg,#111827,#1f2937)", color: "#fff", borderRadius: 22, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#86efac", textTransform: "uppercase", letterSpacing: 1 }}>Lesson notes</div>
        <h1 style={{ fontSize: 22, lineHeight: 1.2, margin: "7px 0 5px" }}>{plan.topic || plan.title || "Today’s lesson"}</h1>
        <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.45 }}>Everything here belongs to this lesson. Teach from it, then return to the lesson flow.</div>
      </section>

      {resources.length > 0 && (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 10 }}>Linked books and resources</div>
          <div style={{ display: "grid", gap: 8 }}>
            {resources.map((resource) => (
              <button
                key={resource.linkId}
                type="button"
                onClick={() => openResource(resource)}
                disabled={!resource.publicationId}
                style={{ textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb", opacity: resource.publicationId ? 1 : 0.65 }}
              >
                <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{resource.title}</div>
                {resource.description && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{resource.description}</div>}
                {resource.publicationId && <div style={{ fontSize: 11, fontWeight: 800, color: "#047857", marginTop: 7 }}>Open resource →</div>}
              </button>
            ))}
          </div>
        </section>
      )}

      {exactChapters.length > 0 && resources.length === 0 && (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 4 }}>From VibeSchool books</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>These chapters carry the same curriculum identity as this lesson.</div>
          <div style={{ display: "grid", gap: 8 }}>
            {exactChapters.map((chapter) => (
              <button key={chapter.id} type="button" onClick={() => router.push(`/read/textbook/${chapter.publication_id}?chapterId=${encodeURIComponent(chapter.id)}`)} style={{ textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{chapter.title || "Open chapter"}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#047857", marginTop: 6 }}>Open chapter →</div>
              </button>
            ))}
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
          <div style={{ fontWeight: 900, color: "#111827" }}>No written notes yet</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5 }}>Return to the lesson plan and prepare the lesson. VibeSchool will use that plan as your teaching notes here.</div>
        </section>
      )}
    </main>
  );
}

export default function LessonNotesPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }}>Opening lesson notes…</main>}>
      <LessonNotesInner />
    </Suspense>
  );
}
