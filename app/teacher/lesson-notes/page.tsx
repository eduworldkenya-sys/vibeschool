"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { parseLessonPlanBody } from "@/lib/teaching/lessonPlanCodec";
import type { LessonPlanSections } from "@/lib/teaching/lessonPlanCodec";
import LessonTeachMode from "@/components/teacher/LessonTeachMode";
import ReflectionSheet from "@/components/teacher/ReflectionSheet";
import EvidenceCaptureSheet from "@/components/teacher/EvidenceCaptureSheet";
import { completeTeachingOccurrence } from "@/lib/teaching/occurrence";

type PlanRow = {
  id: string;
  title: string | null;
  topic: string | null;
  body: string | null;
  scheme_id: string | null;
  curriculum_id: string | null;
  status: string | null;
  duration_minutes: number | null;
  timetable_slot_id: string | null;
  taught_date: string | null;
  teacher_id: string | null;
  class_id: string | null;
  subject_id: string | null;
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

type TeacherNoteRow = {
  id: string;
  title: string;
  body: unknown;
  status: string;
};

type OccurrenceRow = {
  id: string;
  school_id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  timetable_slot_id: string;
  occurrence_date: string;
  lifecycle: string;
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
  const occurrenceId = params.get("occurrenceId");

  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [exactChapters, setExactChapters] = useState<ExactChapterRow[]>([]);
  const [teacherNotes, setTeacherNotes] = useState<TeacherNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teachMode, setTeachMode] = useState(false);
  const [liveNote, setLiveNote] = useState("");
  const [occurrence, setOccurrence] = useState<OccurrenceRow | null>(null);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [reflectionSeed, setReflectionSeed] = useState("");

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
        .select("id,title,topic,body,scheme_id,curriculum_id,status,duration_minutes,timetable_slot_id,taught_date,teacher_id,class_id,subject_id")
        .eq("id", lessonPlanId)
        .single();

      if (planError || !planData) {
        throw new Error("This lesson plan is not available to your account.");
      }

      const typedPlan = planData as PlanRow;
      setPlan(typedPlan);

      if (occurrenceId) {
        const { data: occurrenceData, error: occurrenceError } = await supabase
          .from("teaching_occurrences")
          .select("id,school_id,teacher_id,class_id,subject_id,timetable_slot_id,occurrence_date,lifecycle")
          .eq("id", occurrenceId)
          .maybeSingle();
        if (occurrenceError) throw occurrenceError;
        const row = occurrenceData as OccurrenceRow | null;
        const mismatch = !row
          || row.teacher_id !== authData.user.id
          || row.timetable_slot_id !== typedPlan.timetable_slot_id
          || row.occurrence_date !== typedPlan.taught_date
          || (typedPlan.teacher_id && row.teacher_id !== typedPlan.teacher_id)
          || (typedPlan.class_id && row.class_id !== typedPlan.class_id)
          || (typedPlan.subject_id && row.subject_id !== typedPlan.subject_id);
        if (mismatch) {
          setOccurrence(null);
          throw new Error("Lesson changed or this occurrence no longer belongs to the current lesson authority.");
        }
        setOccurrence(row);
      } else {
        setOccurrence(null);
      }

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

      let subStrandId: string | null = null;
      let curriculumId: string | null = typedPlan.curriculum_id ?? null;

      if (typedPlan.scheme_id) {
        const { data: schemeData } = await supabase
          .from("scheme_of_work")
          .select("curriculum_id,sub_strand_id")
          .eq("id", typedPlan.scheme_id)
          .maybeSingle();

        subStrandId = schemeData?.sub_strand_id ?? null;
        curriculumId = schemeData?.curriculum_id ?? curriculumId;
      }

      const chapterIds = new Set<string>();

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
        const chapters = (chapterData ?? []) as ExactChapterRow[];
        setExactChapters(chapters);
        chapters.forEach((chapter) => chapterIds.add(chapter.id));
      }

      // Approved teacher notes are optional enrichment. The lesson plan remains
      // canonical and useful even when no reviewed derivative exists.
      if (chapterIds.size > 0) {
        const { data: noteData, error: noteError } = await supabase
          .from("content_derivatives")
          .select("id,title,body,status")
          .eq("derivative_type", "teacher_notes")
          .eq("audience", "teacher")
          .eq("status", "approved")
          .in("source_chapter_id", Array.from(chapterIds))
          .order("created_at", { ascending: false })
          .limit(4);
        if (noteError) throw noteError;
        setTeacherNotes((noteData ?? []) as TeacherNoteRow[]);
      } else {
        setTeacherNotes([]);
      }
    } catch (loadError) {
      console.error("[lesson-notes] load", loadError);
      setError(loadError instanceof Error ? loadError.message : "Lesson notes could not be opened.");
    } finally {
      setLoading(false);
    }
  }, [lessonPlanId, occurrenceId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!lessonPlanId || typeof window === "undefined") return;
    const identity = occurrence
      ? `${occurrence.school_id}.${occurrence.teacher_id}.${occurrence.id}.${lessonPlanId}`
      : lessonPlanId;
    const key = `vibeschool.teacher.lesson-notes.${identity}`;
    try {
      setLiveNote(window.localStorage.getItem(key) ?? "");
    } catch {
      // A blocked local cache must never block teaching.
    }
  }, [lessonPlanId, occurrence]);

  function saveLiveNote(value: string) {
    setLiveNote(value);
    if (!lessonPlanId || typeof window === "undefined") return;
    try {
      const identity = occurrence
        ? `${occurrence.school_id}.${occurrence.teacher_id}.${occurrence.id}.${lessonPlanId}`
        : lessonPlanId;
      window.localStorage.setItem(`vibeschool.teacher.lesson-notes.${identity}`, value);
    } catch {
      // Keep the in-memory note available even if storage is unavailable.
    }
  }

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

      <section style={{ background: "#fff", borderRadius: 18, padding: 14, marginBottom: 14, border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>Teach mode</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>A phone-first view of this exact lesson. It does not change curriculum or Scheme authority.</div>
          </div>
          <button type="button" onClick={() => setTeachMode((value) => !value)} style={{ border: 0, borderRadius: 12, padding: "9px 12px", background: teachMode ? "#dcfce7" : "#111827", color: teachMode ? "#166534" : "#fff", fontWeight: 900 }}>
            {teachMode ? "Exit teach mode" : "Start teach mode"}
          </button>
        </div>
        {plan.duration_minutes && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>Planned duration: {plan.duration_minutes} minutes</div>}
      </section>

      {teachMode && sections && (
        <LessonTeachMode
          subject="Lesson"
          className={occurrence ? "Current class" : "Lesson workspace"}
          topic={plan.topic || plan.title || "Today’s lesson"}
          sections={sections}
          context={occurrence ? {
            lessonPlanId: plan.id,
            occurrenceId: occurrence.id,
            teacherId: occurrence.teacher_id,
            schoolId: occurrence.school_id,
            classId: occurrence.class_id,
            subjectId: occurrence.subject_id,
            lifecycle: occurrence.lifecycle,
            timetableSlotId: occurrence.timetable_slot_id,
            occurrenceDate: occurrence.occurrence_date,
          } : null}
          initialScratchpad={liveNote}
          onScratchpadChange={saveLiveNote}
          onCaptureEvidence={() => setEvidenceOpen(true)}
          onUseInReflection={(value) => {
            setReflectionSeed(value);
            setReflectionOpen(true);
          }}
          onFinishLesson={occurrence && plan.timetable_slot_id && plan.taught_date && occurrence.lifecycle === "in_progress" ? async () => {
            await completeTeachingOccurrence({
              timetableSlotId: plan.timetable_slot_id as string,
              occurrenceDate: plan.taught_date as string,
            });
            setOccurrence(current => current ? { ...current, lifecycle: "completed" } : current);
          } : undefined}
          onClose={() => setTeachMode(false)}
        />
      )}


      <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>Live teacher note</div>
        <div style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 9px" }}>Capture a reminder while teaching. This private device note does not alter the canonical lesson plan, Scheme or learner record.</div>
        <textarea value={liveNote} onChange={(event) => saveLiveNote(event.target.value)} rows={3} placeholder="e.g. Revisit balancing equations with another example next lesson." style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: 11, font: "inherit", fontSize: 13, resize: "vertical" }} />
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>Saved on this device for this lesson so a weak connection does not erase the note.</div>
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

      {teacherNotes.length > 0 && (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#111827", marginBottom: 4 }}>Approved teaching notes</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>Optional source-grounded enrichment for this curriculum context. Your lesson plan remains the teaching authority.</div>
          <div style={{ display: "grid", gap: 8 }}>
            {teacherNotes.map((note) => (
              <article key={note.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb" }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{note.title}</div>
                <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: 12, color: "#374151", lineHeight: 1.55, margin: "8px 0 0" }}>{typeof note.body === "string" ? note.body : JSON.stringify(note.body, null, 2)}</pre>
              </article>
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
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5 }}>Return to the lesson plan and prepare the lesson. VibeSchool uses the canonical lesson plan as the baseline teaching notes; approved source-grounded teacher notes can enrich it when available.</div>
        </section>
      )}
      {evidenceOpen && occurrence && (
        <EvidenceCaptureSheet
          lessonId={plan.id}
          occurrenceId={occurrence.id}
          classId={occurrence.class_id}
          teacherId={occurrence.teacher_id}
          defaultTitle={plan.topic || plan.title || "Lesson evidence"}
          onClose={() => setEvidenceOpen(false)}
          onSaved={() => setEvidenceOpen(false)}
        />
      )}

      {reflectionOpen && occurrence && (
        <ReflectionSheet
          lessonId={plan.id}
          occurrenceId={occurrence.id}
          classId={occurrence.class_id}
          subjectId={occurrence.subject_id}
          teacherId={occurrence.teacher_id}
          initialText={reflectionSeed}
          onClose={() => setReflectionOpen(false)}
          onSaved={() => {
            setReflectionOpen(false);
            setReflectionSeed("");
          }}
        />
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
