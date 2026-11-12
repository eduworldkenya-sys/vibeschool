"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { startTeachingOccurrence } from "@/lib/teaching/occurrence";
import { parseLessonPlanBody } from "@/lib/teaching/lessonPlanCodec";
import type { LessonPlanSections } from "@/lib/teaching/lessonPlanCodec";
import LessonTeachMode, { type LessonCompletionReview } from "@/components/teacher/LessonTeachMode";
import ReflectionSheet from "@/components/teacher/ReflectionSheet";
import EvidenceCaptureSheet from "@/components/teacher/EvidenceCaptureSheet";
import LessonPreparationStudio from "@/components/teacher/LessonPreparationStudio";
import TeachingWorkspaceNav from "@/components/teacher/TeachingWorkspaceNav";
import SubjectLessonHandoff from "@/components/teacher/SubjectLessonHandoff";
import JumpingSchemeContent from "@/components/teacher/JumpingSchemeContent";
import CanonicalLessonNotesPanel from "@/components/teacher/CanonicalLessonNotesPanel";
import LessonNotesLibrary from "@/components/teacher/LessonNotesLibrary";


type PlanRow = {
  id: string;
  title: string | null;
  topic: string | null;
  body: string | null;
  scheme_id: string | null;
  curriculum_id: string | null;
  curriculum_outcome_id: string | null;
  status: string | null;
  duration_minutes: number | null;
  timetable_slot_id: string | null;
  taught_date: string | null;
  teacher_id: string | null;
  school_id: string | null;
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
  recovered_from_id: string | null;
  rescheduled_to_slot_id: string | null;
  rescheduled_to_date: string | null;
};

type CompletedLessonRecord = {
  attendanceCount: number;
  evidenceCount: number;
  progressSaved: boolean;
  reflectionSaved: boolean;
  teacherRemarks: string | null;
  nextSteps: string | null;
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
  const lessonPlanId = params.get("lessonPlanId") || params.get("planId");
  const occurrenceId = params.get("occurrenceId");
  const contextClassId = params.get("classId") || "";
  const contextSubjectId = params.get("subjectId") || "";

  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [scheduledMinutes, setScheduledMinutes] = useState<number | null>(null);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [exactChapters, setExactChapters] = useState<ExactChapterRow[]>([]);
  const [teacherNotes, setTeacherNotes] = useState<TeacherNoteRow[]>([]);
  const [canonicalNotesScope, setCanonicalNotesScope] = useState<{ outcomeId: string | null; subStrandId: string | null } | null>(null);
  const [jumpingSchemeId, setJumpingSchemeId] = useState<string | null>(null);
  const [timeOutcomeId, setTimeOutcomeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teachMode, setTeachMode] = useState(params.get("teach") === "1");
  const [liveNote, setLiveNote] = useState("");
  const [occurrence, setOccurrence] = useState<OccurrenceRow | null>(null);
  const [startingLesson, setStartingLesson] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [completedRecord, setCompletedRecord] = useState<CompletedLessonRecord | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [reflectionSeed, setReflectionSeed] = useState("");

  const sections = useMemo(() => {
    if (!plan?.body) return null;
    return parseLessonPlanBody(plan.body);
  }, [plan?.body]);

  const load = useCallback(async () => {
    if (!lessonPlanId) {
      setError(null);
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
        .select("id,title,topic,body,scheme_id,curriculum_id,curriculum_outcome_id,status,duration_minutes,timetable_slot_id,taught_date,teacher_id,school_id,class_id,subject_id")
        .eq("id", lessonPlanId)
        .single();

      if (planError || !planData) {
        throw new Error("This lesson plan is not available to your account.");
      }

      const typedPlan = planData as PlanRow;
      if (typedPlan.teacher_id !== authData.user.id) throw new Error("This lesson belongs to another teacher.");
      setPlan(typedPlan);
      setJumpingSchemeId(null);
      setTimeOutcomeId(null);
      setCanonicalNotesScope(null);
      setScheduledMinutes(null);
      if (typedPlan.timetable_slot_id) {
        const { data: slot, error: slotError } = await supabase.from('timetable_slots')
          .select('teacher_id,class_id,subject_id,start_time,end_time')
          .eq('id', typedPlan.timetable_slot_id).maybeSingle();
        if (!slotError && slot && slot.teacher_id === authData.user.id
          && slot.class_id === typedPlan.class_id && slot.subject_id === typedPlan.subject_id) {
          const [sh, sm] = slot.start_time.split(':').map(Number);
          const [eh, em] = slot.end_time.split(':').map(Number);
          const minutes = (eh * 60 + em) - (sh * 60 + sm);
          if (Number.isFinite(minutes) && minutes > 0) setScheduledMinutes(minutes);
        }
      }

      // Resolve the same persisted teaching occurrence on a fresh link or reload.
      // The saved plan's exact slot + date are authoritative when no ID was
      // supplied. Never create an occurrence from a viewer or trust URL IDs.
      setCompletedRecord(null);
      setRecordError(null);
      if (occurrenceId || (typedPlan.timetable_slot_id && typedPlan.taught_date)) {
        let occurrenceQuery = supabase.from("teaching_occurrences")
          .select("id,school_id,teacher_id,class_id,subject_id,timetable_slot_id,occurrence_date,lifecycle,recovered_from_id,rescheduled_to_slot_id,rescheduled_to_date");
        occurrenceQuery = occurrenceId
          ? occurrenceQuery.eq("id", occurrenceId)
          : occurrenceQuery.eq("timetable_slot_id", typedPlan.timetable_slot_id!)
              .eq("occurrence_date", typedPlan.taught_date!);
        const { data: occurrenceData, error: occurrenceError } = await occurrenceQuery.maybeSingle();
        if (occurrenceError) throw occurrenceError;
        const row = occurrenceData as OccurrenceRow | null;
        if (occurrenceId && !row) throw new Error("The requested teaching occurrence was not found.");
        if (row && (row.teacher_id !== authData.user.id
          || row.school_id !== typedPlan.school_id
          || row.timetable_slot_id !== typedPlan.timetable_slot_id
          || row.occurrence_date !== typedPlan.taught_date
          || row.teacher_id !== typedPlan.teacher_id
          || row.class_id !== typedPlan.class_id
          || row.subject_id !== typedPlan.subject_id)) {
          throw new Error("Lesson changed or this occurrence no longer belongs to the current lesson authority.");
        }
        setOccurrence(row);

        if (row?.lifecycle === "completed") {
          // Read-only history: a completed session must show its actual saved
          // evidence, not an assumed 'complete' state from the viewer cache.
          const [attendance, evidence, progress, reflection] = await Promise.all([
            supabase.from("attendance").select("student_id", { count: "exact", head: true })
              .eq("teaching_occurrence_id", row.id),
            supabase.from("lesson_evidence").select("id", { count: "exact", head: true })
              .eq("teaching_occurrence_id", row.id),
            supabase.from("progress_records").select("id,teacher_remarks,next_steps")
              .eq("teaching_occurrence_id", row.id).maybeSingle(),
            supabase.from("lesson_reflections").select("id")
              .eq("teaching_occurrence_id", row.id).maybeSingle(),
          ]);
          const historyError = attendance.error ?? evidence.error ?? progress.error ?? reflection.error;
          if (historyError) {
            setRecordError("Saved lesson history could not be verified. Refresh or check your access before relying on this record.");
          } else {
            setCompletedRecord({
              attendanceCount: attendance.count ?? 0,
              evidenceCount: evidence.count ?? 0,
              progressSaved: Boolean(progress.data?.id),
              reflectionSaved: Boolean(reflection.data?.id),
              teacherRemarks: progress.data?.teacher_remarks ?? null,
              nextSteps: progress.data?.next_steps ?? null,
            });
          }
        }
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
      let exactOutcomeId: string | null = typedPlan.curriculum_outcome_id ?? null;

      if (typedPlan.scheme_id) {
        const { data: schemeData } = await supabase
          .from("scheme_of_work")
          .select("curriculum_id,sub_strand_id,curriculum_outcome_id,sub_strand,grade,teacher_id,class_id,subject_id")
          .eq("id", typedPlan.scheme_id)
          .maybeSingle();

        if (schemeData && (schemeData.teacher_id !== authData.user.id ||
          schemeData.class_id !== typedPlan.class_id ||
          schemeData.subject_id !== typedPlan.subject_id)) {
          throw new Error("The linked Scheme does not match this lesson.");
        }
        subStrandId = schemeData?.sub_strand_id ?? null;
        const schemeOutcomeId = schemeData?.curriculum_outcome_id ?? null;
        if (exactOutcomeId && schemeOutcomeId && exactOutcomeId !== schemeOutcomeId) {
          throw new Error("Lesson Plan and Scheme reference different learning outcomes; reconcile before opening linked notes.");
        }
        exactOutcomeId = schemeOutcomeId ?? exactOutcomeId;
        if (subStrandId === 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c') {
          setTimeOutcomeId(exactOutcomeId);
        }
        curriculumId = schemeData?.curriculum_id ?? curriculumId;
        if (schemeData?.grade === "Grade 1" && schemeData?.sub_strand === "Jumping") {
          setJumpingSchemeId(typedPlan.scheme_id);
        }
      }

      setCanonicalNotesScope({ outcomeId: exactOutcomeId, subStrandId });

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

  // Enter the one canonical scheduled lifecycle. Lesson Notes never creates
  // a local-only teaching session or completes an unstarted occurrence.
  async function openCanonicalTeach() {
    if (!plan || startingLesson) return;
    setStartError(null);
    if (!plan.timetable_slot_id || !plan.taught_date) {
      setStartError("This plan has no scheduled lesson identity. Open an unscheduled prepared draft through Lesson Plans → Teach unscheduled.");
      return;
    }
    if (occurrence?.lifecycle === "completed" || occurrence?.lifecycle === "in_progress") {
      setTeachMode(true);
      return;
    }
    if (occurrence && ["missed", "rescheduled", "cancelled"].includes(occurrence.lifecycle)) {
      setStartError("This occurrence cannot start. Recover a missed lesson from its timetable entry, or review the archived session.");
      return;
    }
    setStartingLesson(true);
    try {
      const row = await startTeachingOccurrence({
        timetableSlotId: plan.timetable_slot_id,
        occurrenceDate: plan.taught_date,
      });
      if (row.lifecycle !== "in_progress" || row.teacher_id !== plan.teacher_id
        || row.school_id !== plan.school_id || row.class_id !== plan.class_id
        || row.subject_id !== plan.subject_id || row.timetable_slot_id !== plan.timetable_slot_id
        || row.occurrence_date !== plan.taught_date) {
        throw new Error("The started occurrence does not match this saved lesson.");
      }
      setOccurrence(row);
      setTeachMode(true);
    } catch (cause) {
      setStartError(cause instanceof Error ? cause.message : "The lesson could not be started.");
    } finally {
      setStartingLesson(false);
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
      <section style={{ padding: 16 }}>
        <div style={{ height: 28, width: 180, borderRadius: 8, background: "#f3f4f6", marginBottom: 12 }} />
        <div style={{ height: 120, borderRadius: 18, background: "#f3f4f6" }} />
      </section>
    );
  }

  if (!lessonPlanId) {
    return <LessonNotesLibrary subjectId={contextSubjectId} preparedLessons={contextClassId && contextSubjectId ? <SubjectLessonHandoff classId={contextClassId} subjectId={contextSubjectId} purpose="notes" /> : null} />;
  }

  if (error || !plan) {
    return (
      <section style={{ padding: 20 }}>
        <button type="button" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontWeight: 800, padding: 0, marginBottom: 18 }}>← Back</button>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18 }}>
          <div style={{ fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>Lesson notes are not ready</div>
          <div style={{ color: "var(--teacher-muted, #627168)", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{error}</div>
        </div>
      </section>
    );
  }

  const visibleSections = sections
    ? sectionOrder.filter(({ key }) => cleanText(sections[key]).length > 0)
    : [];

  return (
    <section style={{ padding: "12px 14px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <button type="button" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontWeight: 800, padding: "8px 0", color: "#374151" }}>← Back to lesson</button>

      {plan.duration_minutes && scheduledMinutes && plan.duration_minutes !== scheduledMinutes && (
        <section role="status" style={{margin:'10px 0',padding:12,borderRadius:12,border:'1px solid #fbbf24',background:'#fffbeb',fontSize:13}}>
          <strong>Lesson timing needs review:</strong> this saved plan is {plan.duration_minutes} minutes but its timetable slot is {scheduledMinutes} minutes.
          Review the lesson plan before teaching; VibeSchool will not silently change teacher-authored content.
        </section>
      )}
      {startError && <p role="alert" style={{ color: "#b91c1c", padding: 10 }}>{startError}</p>}
      {startingLesson && <p role="status">Starting the scheduled lesson…</p>}
      {occurrence?.lifecycle === "rescheduled" && <p role="status">This lesson was rescheduled to {occurrence.rescheduled_to_date ?? "another date"}. Its original records remain attached to occurrence {occurrence.id}. Open the replacement from the timetable to teach it.</p>}
      {occurrence?.lifecycle === "completed" && (
        <section aria-label="Saved completed lesson history" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <strong>Completed lesson · saved occurrence</strong>
          <div style={{ fontSize: 12, marginTop: 6 }}>Lesson date: {occurrence.occurrence_date} · Occurrence ID: {occurrence.id}</div>
          {occurrence.recovered_from_id && <div style={{ fontSize: 12, marginTop: 4 }}>Recovery of original missed occurrence: {occurrence.recovered_from_id}</div>}
          {recordError && <p role="alert">{recordError}</p>}
          {completedRecord ? (
            <div style={{ fontSize: 13, marginTop: 8 }}>
              <div>Attendance records: {completedRecord.attendanceCount} · Evidence records: {completedRecord.evidenceCount}</div>
              <div>Teaching progress: {completedRecord.progressSaved ? "saved" : "not found"} · Reflection: {completedRecord.reflectionSaved ? "saved" : "not found"}</div>
              {completedRecord.teacherRemarks && <p>Teacher remarks: {completedRecord.teacherRemarks}</p>}
              {completedRecord.nextSteps && <p>Next steps: {completedRecord.nextSteps}</p>}
            </div>
          ) : !recordError && <p>Checking the saved teaching record…</p>}
        </section>
      )}
      {plan.class_id && plan.subject_id && <TeachingWorkspaceNav classId={plan.class_id} subjectId={plan.subject_id} lessonPlanId={plan.id} occurrenceId={occurrence?.id} timetableSlotId={plan.timetable_slot_id} occurrenceDate={plan.taught_date} current="Lesson" />}
      {sections && <LessonPreparationStudio sections={sections} topic={plan.topic || plan.title || "Lesson notes"} resourceCount={resources.length} onTeach={() => void openCanonicalTeach()} onEdit={() => router.push(`/teacher/lessonplan?classId=${encodeURIComponent(plan.class_id || contextClassId)}&subjectId=${encodeURIComponent(plan.subject_id || contextSubjectId)}&timetableSlotId=${encodeURIComponent(plan.timetable_slot_id || "")}&date=${encodeURIComponent(plan.taught_date || "")}`)} />}
      {plan.scheme_id && (
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",margin:"12px 0"}}>
          <button type="button" onClick={() => {
            const q = new URLSearchParams({lessonPlanId:plan.id,schemeId:plan.scheme_id!});
            if (plan.class_id) q.set("classId",plan.class_id);
            if (plan.subject_id) q.set("subjectId",plan.subject_id);
            if (plan.timetable_slot_id) q.set("timetableSlotId",plan.timetable_slot_id);
            if (plan.taught_date) q.set("date",plan.taught_date);
            if (occurrence?.id) q.set("occurrenceId",occurrence.id);
            router.push(`/teacher/teacher-guide?${q.toString()}`);
          }} style={{background:"#1e1b4b",color:"#fff",border:0,borderRadius:10,padding:"11px 14px",fontWeight:800}}>
            Open this lesson’s Teacher Guide
          </button>
          <span style={{fontSize:12,color:"#64748b"}}>{resources.length} approved resources attached to this plan</span>
        </div>
      )}
      {timeOutcomeId && <div style={{margin:'12px 0',padding:12,border:'1px solid #a7d6b7',borderRadius:12,background:'#f2faf4'}}>
        <strong style={{fontSize:13,color:'#175b43'}}>Published learning package for this outcome</strong>
        <p style={{fontSize:12,color:'#526b59',margin:'6px 0'}}>Use the same certified lesson explanations, checked formative exercises and teacher guidance without needing a timetable slot.</p>
        <button type="button" onClick={() => router.push(`/teacher/outcome-package?outcomeId=${encodeURIComponent(timeOutcomeId)}`)}
          style={{background:'#175b43',color:'#fff',border:0,borderRadius:9,padding:'10px 13px',fontWeight:800}}>
          Open linked Time outcome package
        </button>
      </div>}
      {jumpingSchemeId && (
        <section aria-label="Linked VibeSchool Jumping manuscripts" style={{margin:"12px 0"}}>
          <JumpingSchemeContent schemeId={jumpingSchemeId} />
        </section>
      )}
      <CanonicalLessonNotesPanel outcomeId={canonicalNotesScope?.outcomeId ?? null} subStrandId={canonicalNotesScope?.subStrandId ?? null} />
      <details className="studio-lesson-details"><summary>Lesson Plan outline & private reminders</summary>
      <section style={{ background: "#2c2944", color: "#fff", borderRadius: 22, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 750, color: "#d0c5e8", textTransform: "uppercase", letterSpacing: 1 }}>Prepared Lesson Plan outline</div>
        <h1 style={{ fontSize: 22, lineHeight: 1.2, margin: "7px 0 5px" }}>{plan.topic || plan.title || "Today’s lesson"}</h1>
        <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.45 }}>Everything here belongs to this lesson. Teach from it, then return to the lesson flow.</div>
      </section>

      <section style={{ background: "#fff", borderRadius: 18, padding: 14, marginBottom: 14, border: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>Teach mode</div>
            <div style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", marginTop: 2 }}>A phone-first view of this exact lesson. It does not change curriculum or Scheme authority.</div>
          </div>
          <button type="button" onClick={() => setTeachMode((value) => !value)} style={{ border: 0, borderRadius: 12, padding: "9px 12px", background: teachMode ? "#dcfce7" : "#111827", color: teachMode ? "#166534" : "#fff", fontWeight: 750 }}>
            {teachMode ? "Exit teach mode" : "Start teach mode"}
          </button>
        </div>
        {plan.duration_minutes && <div style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", marginTop: 8 }}>Planned duration: {plan.duration_minutes} minutes</div>}
      </section>

      <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 12, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>Live teacher note</div>
        <div style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", margin: "4px 0 9px" }}>Capture a reminder while teaching. This private device note does not alter the canonical lesson plan, Scheme or learner record.</div>
        <textarea value={liveNote} onChange={(event) => saveLiveNote(event.target.value)} rows={3} placeholder="e.g. Revisit balancing equations with another example next lesson." style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 12, padding: 11, font: "inherit", fontSize: 13, resize: "vertical" }} />
        <div style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", marginTop: 6 }}>Saved on this device for this lesson so a weak connection does not erase the note.</div>
      </section>

      {resources.length > 0 && (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 750, color: "var(--teacher-ink, #1c2923)", marginBottom: 10 }}>Linked books and resources</div>
          <div style={{ display: "grid", gap: 8 }}>
            {resources.map((resource) => (
              <button
                key={resource.linkId}
                type="button"
                onClick={() => openResource(resource)}
                disabled={!resource.publicationId}
                style={{ textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb", opacity: resource.publicationId ? 1 : 0.65 }}
              >
                <div style={{ fontSize: 13, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>{resource.title}</div>
                {resource.description && <div style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", marginTop: 3 }}>{resource.description}</div>}
                {resource.publicationId && <div style={{ fontSize: 11, fontWeight: 800, color: "#047857", marginTop: 7 }}>Open resource →</div>}
              </button>
            ))}
          </div>
        </section>
      )}

      {exactChapters.length > 0 && resources.length === 0 && (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 750, color: "var(--teacher-ink, #1c2923)", marginBottom: 4 }}>From VibeSchool books</div>
          <div style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", marginBottom: 10 }}>These chapters carry the same curriculum identity as this lesson.</div>
          <div style={{ display: "grid", gap: 8 }}>
            {exactChapters.map((chapter) => (
              <button key={chapter.id} type="button" onClick={() => router.push(`/read/textbook/${chapter.publication_id}?chapterId=${encodeURIComponent(chapter.id)}`)} style={{ textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb" }}>
                <div style={{ fontSize: 13, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>{chapter.title || "Open chapter"}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#047857", marginTop: 6 }}>Open chapter →</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {teacherNotes.length > 0 && (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 750, color: "var(--teacher-ink, #1c2923)", marginBottom: 4 }}>Approved teaching notes</div>
          <div style={{ fontSize: 11, color: "var(--teacher-muted, #627168)", marginBottom: 10 }}>Optional source-grounded enrichment for this curriculum context. Your lesson plan remains the teaching authority.</div>
          <div style={{ display: "grid", gap: 8 }}>
            {teacherNotes.map((note) => (
              <article key={note.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb" }}>
                <div style={{ fontSize: 13, fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>{note.title}</div>
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
              <div style={{ fontSize: 11, fontWeight: 750, color: key === "development" ? "#047857" : "#6b7280", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 7 }}>{label}</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "#1f2937", lineHeight: 1.65 }}>{sections ? sections[key] : ""}</div>
            </section>
          ))}
        </div>
      ) : (
        <section style={{ background: "#fff", borderRadius: 18, padding: 16, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 750, color: "var(--teacher-ink, #1c2923)" }}>No prepared Lesson Plan outline yet</div>
          <div style={{ fontSize: 12, color: "var(--teacher-muted, #627168)", marginTop: 5 }}>Prepare the Lesson Plan, or open released learner/teacher content above. The teaching outline is not a substitute for a certified content resource.</div>
        </section>
      )}
      </details>
      {teachMode && sections && occurrence && (occurrence.lifecycle === "in_progress" || occurrence.lifecycle === "completed") && (
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
          linkedResources={resources.map(resource => ({ id: resource.linkId, title: resource.title, available: Boolean(resource.publicationId) }))}
          onOpenResource={id => { const resource = resources.find(item => item.linkId === id); if (resource) openResource(resource) }}
          onScratchpadChange={saveLiveNote}
          onCaptureEvidence={() => setEvidenceOpen(true)}
          onUseInReflection={(value) => {
            setReflectionSeed(value);
            setReflectionOpen(true);
          }}
          loadCompletionFacts={occurrence ? async () => {
            const [roster, day] = await Promise.all([
              supabase.from("student_classes").select("student_id", { count: "exact", head: true })
                .eq("school_id", occurrence.school_id).eq("class_id", occurrence.class_id).eq("is_current", true),
              supabase.rpc("get_teacher_day", { p_date: occurrence.occurrence_date }),
            ]);
            if (day.error) throw day.error;
            const row = (day.data as Array<{ occurrence_id: string; attendance_state: string; evidence_count: number }> | null)
              ?.find(item => item.occurrence_id === occurrence.id);
            return {
              emptyRoster: !roster.error && roster.count === 0,
              attendanceSaved: row?.attendance_state === "complete",
              evidenceSaved: (row?.evidence_count ?? 0) > 0,
            };
          } : undefined}
          onFinishLesson={occurrence && plan.timetable_slot_id && occurrence.lifecycle === "in_progress" ? async (review: LessonCompletionReview) => {
            const outcome = review.coverage;
            const whatWasTaught = review.whatWasTaught;
            const nextSteps = review.nextSteps || (review.coverage === "partial"
              ? "Continue the uncovered part of this lesson before advancing Scheme coverage."
              : review.coverage === "not_covered"
                ? "Reschedule the outcome before advancing Scheme coverage."
              : review.coverage === "postponed"
                ? "Confirm a new occurrence for this lesson."
              : review.coverage === "reteach"
                ? "Reteach this lesson content using the teacher reflection and new evidence before advancing Scheme coverage."
                : "Teaching occurrence completed and the linked Scheme item was explicitly marked covered. Learner mastery remains evidence-based and separate.");

            // `outcome` is a teaching-coverage statement, not learner mastery.
            // One RPC = one database transaction. Completion, progress and (for
            // covered lessons) Scheme coverage either all persist or all roll back.
            const { data: finalized, error: finalizeError } = await supabase.rpc("finalize_teaching_occurrence_v2", {
              p_occurrence_id: occurrence.id,
              p_outcome: outcome,
              p_what_was_taught: whatWasTaught,
              p_reflection: review.reflection,
              p_attendance_unavailable_reason: review.attendanceUnavailableReason,
              p_no_evidence_reason: review.noEvidenceReason,
              p_follow_up_decision: review.followUpDecision,
              p_next_steps: nextSteps,
            });
            if (finalizeError) {
              throw new Error(`Lesson was not finalized; no partial completion was accepted: ${finalizeError.message}`);
            }
            const finalizedRow = Array.isArray(finalized) ? finalized[0] : finalized;
            if (finalizedRow?.occurrence_id !== occurrence.id || !finalizedRow?.progress_record_id) {
              throw new Error("Lesson finalization returned no authoritative completion record.");
            }
            setOccurrence(current => current ? { ...current, id: finalizedRow.occurrence_id, lifecycle: "completed" } : current);
            // Re-read the saved attendance/evidence/progress after finalization;
            // do not present locally inferred success as the history snapshot.
            void load();

            const reflectionContext = [
              liveNote.trim(),
              review.reflection,
              `Coverage outcome: ${review.coverage}.`,
              `What was taught: ${review.whatWasTaught}`,
              `Next step: ${nextSteps}`,
            ].filter(Boolean).join("\\n\\n");
            setReflectionSeed(reflectionContext);
            setReflectionOpen(true);
          } : undefined}
          onClose={() => setTeachMode(false)}
        />
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
    </section>
  );
}

export default function LessonNotesPage() {
  return (
    <Suspense fallback={<section style={{ padding: 16 }}>Opening lesson notes…</section>}>
      <LessonNotesInner />
    </Suspense>
  );
}
