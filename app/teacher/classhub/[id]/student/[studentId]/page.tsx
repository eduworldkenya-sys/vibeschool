"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Activity,
  Award,
  BookOpenCheck,
  CalendarCheck,
  Library,
  NotebookPen,
  Pencil,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react";
import LearnerIdentityFields from "@/components/teacher/LearnerIdentityFields";
import LearnerDetailSheet from "@/components/teacher/LearnerDetailSheet";
import LearnerRelatedRecords from "@/components/teacher/LearnerRelatedRecords";
import LearnerSnapshot from "@/components/teacher/LearnerSnapshot";
import LearnerGroupSummary from "@/components/teacher/LearnerGroupSummary";
import experience from "@/components/teacher/LearnerExperience.module.css";
import { buildLearnerTruthSummary } from "@/lib/learner-intelligence/truth";
import {
  listInterventionQueue,
  type InterventionQueueItem,
} from "@/lib/assessment/interventions";

type ClassContext = {
  class_id: string;
  class_name: string;
  stream: string | null;
  subject_id: string;
  subject_name: string;
  is_class_teacher?: boolean;
};
type Context = {
  teacher_id: string;
  school_id: string | null;
  classes: ClassContext[];
};
type Student = {
  id: string;
  name: string;
  admission_number: string | null;
  profile_id: string | null;
  gender: string | null;
  date_of_birth: string | null;
  deleted_at?: string | null;
};
type AttendanceRow = { date: string; status: string; is_late: boolean | null };
type HomeworkRow = {
  id: string;
  title: string;
  subject: string | null;
  due_date: string | null;
  type: string | null;
};
type SubmissionRow = {
  homework_id: string | null;
  status: string;
  mark: number | null;
  feedback: string | null;
  submitted_at: string | null;
};
type GradebookRow = {
  assessment_id: string;
  subject_id: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  assessment_type: string;
  assessment_title: string;
  released_at: string | null;
};
type CbcRow = {
  id: string;
  subject_id: string;
  strand_id: string | null;
  sub_strand: string | null;
  assessment_type: string;
  performance: string;
  notes: string | null;
  created_at: string;
};
type ExamRow = {
  id: string;
  exam_id: string;
  subject_id: string;
  marks: number | null;
  max_marks: number;
  result_state: string;
  is_absent: boolean;
  created_at: string;
};
type LibraryLoan = {
  id: string;
  book_id: string;
  issued_at: string;
  due_date: string;
  returned_at: string | null;
};
type LibraryBook = { id: string; title: string };
type SubjectRow = { id: string; name: string };
type TeacherEvent = {
  id: string;
  subject_id: string | null;
  event_kind: string;
  event_code: string | null;
  note: string | null;
  visibility: string;
  metadata: unknown;
  due_at: string | null;
  resolved_at: string | null;
  created_at: string;
  created_by: string;
};
type LearnerContextKey =
  | "strengths"
  | "interests"
  | "learning_preferences"
  | "helpful_strategies"
  | "support_needs"
  | "accommodations"
  | "communication_preferences"
  | "responsibilities";
type Tab = "now" | "about" | "work" | "assessment" | "attendance" | "timeline";

const tabs: Tab[] = [
  "now",
  "about",
  "work",
  "assessment",
  "attendance",
  "timeline",
];
const aboutSections: Array<{
  heading: string;
  fields: LearnerContextKey[];
}> = [
  {
    heading: "Learning and interests",
    fields: ["strengths", "interests", "learning_preferences", "helpful_strategies"],
  },
  {
    heading: "Support and communication",
    fields: ["support_needs", "accommodations", "communication_preferences"],
  },
  {
    heading: "Other school context",
    fields: ["responsibilities"],
  },
];

const learnerContextFields: Array<{
  key: LearnerContextKey;
  label: string;
  help: string;
  placeholder: string;
}> = [
  {
    key: "strengths",
    label: "Strengths noticed",
    help: "Specific strengths you have observed in learning or participation.",
    placeholder: "e.g. Explains ideas clearly during group work",
  },
  {
    key: "interests",
    label: "Interests",
    help: "Topics or activities that help this learner engage.",
    placeholder: "e.g. Football, nature, drawing",
  },
  {
    key: "learning_preferences",
    label: "How this learner learns well",
    help: "Teacher-tested preferences, not fixed labels.",
    placeholder: "e.g. Understands faster after seeing one worked example",
  },
  {
    key: "helpful_strategies",
    label: "Strategies that help",
    help: "Classroom approaches that have worked in practice.",
    placeholder: "e.g. Short instructions followed by a check-in",
  },
  {
    key: "support_needs",
    label: "Current learning support",
    help: "Describe the learning need and evidence without labelling the learner.",
    placeholder: "e.g. Needs extra practice interpreting scale on graphs",
  },
  {
    key: "accommodations",
    label: "Classroom adjustments",
    help: "Practical adjustments currently used by the school or teacher.",
    placeholder: "e.g. Seat near the board; allow extra reading time",
  },
  {
    key: "communication_preferences",
    label: "Communication notes",
    help: "Useful language or communication preferences for teaching.",
    placeholder: "e.g. Responds well to questions given one at a time",
  },
  {
    key: "responsibilities",
    label: "Additional responsibility notes",
    help: "Optional teaching context. Manage actual duties and team positions in School life → Roles.",
    placeholder: "e.g. Group leader; football team; library monitor",
  },
];

function isLearnerContextEvent(event: TeacherEvent) {
  return (
    event.event_kind === "management" &&
    Boolean(event.event_code?.startsWith("learner_context_"))
  );
}

function learnerContextKey(event: TeacherEvent): LearnerContextKey | null {
  if (!isLearnerContextEvent(event)) return null;
  const key = event.event_code?.replace(
    "learner_context_",
    "",
  ) as LearnerContextKey;
  return learnerContextFields.some((field) => field.key === key) ? key : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function parseContext(value: unknown): Context {
  if (!isRecord(value))
    throw new Error("Teacher operating context is invalid.");
  const classes: ClassContext[] = [];
  if (Array.isArray(value.classes)) {
    for (const entry of value.classes) {
      if (!isRecord(entry)) continue;
      if (
        typeof entry.class_id !== "string" ||
        typeof entry.class_name !== "string" ||
        typeof entry.subject_id !== "string" ||
        typeof entry.subject_name !== "string"
      )
        continue;
      classes.push({
        class_id: entry.class_id,
        class_name: entry.class_name,
        stream: stringOrNull(entry.stream),
        subject_id: entry.subject_id,
        subject_name: entry.subject_name,
        is_class_teacher: entry.is_class_teacher === true,
      });
    }
  }
  return {
    teacher_id: typeof value.teacher_id === "string" ? value.teacher_id : "",
    school_id: stringOrNull(value.school_id),
    classes,
  };
}

function formatDate(value: string) {
  const parsed = new Date(
    value.length === 10 ? `${value}T12:00:00+03:00` : value,
  );
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : value;
}

function Badge({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const palette = {
    good: { background: "#ecfdf5", color: "#065f46" },
    warn: { background: "#fffbeb", color: "#92400e" },
    bad: { background: "#fef2f2", color: "#991b1b" },
    neutral: { background: "#f3f4f6", color: "#4b5563" },
  }[tone];
  return (
    <span
      style={{
        ...palette,
        display: "inline-block",
        borderRadius: 99,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 750,
      }}
    >
      {text}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: 15,
        boxShadow: "0 2px 14px rgba(0,0,0,.05)",
      }}
    >
      {children}
    </section>
  );
}

export default function TeacherStudentProgressPage() {
  const params = useParams<{ id: string; studentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSubjectId = searchParams.get("subjectId");
  const classId = params.id;
  const studentId = params.studentId;
  const [context, setContext] = useState<Context | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [homework, setHomework] = useState<HomeworkRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [gradebook, setGradebook] = useState<GradebookRow[]>([]);
  const [cbc, setCbc] = useState<CbcRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [libraryLoans, setLibraryLoans] = useState<LibraryLoan[]>([]);
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [interventions, setInterventions] = useState<InterventionQueueItem[]>(
    [],
  );
  const [teacherEvents, setTeacherEvents] = useState<TeacherEvent[]>([]);
  const eventRequest = useRef<Record<string, string>>({});
  const eventLock = useRef(false);
  const [eventNote, setEventNote] = useState("");
  const [recognitionNote, setRecognitionNote] = useState("");
  const [eventSaving, setEventSaving] = useState(false);
  const [eventMessage, setEventMessage] = useState("");
  const [tab, setTab] = useState<Tab>(
    !requestedSubjectId && searchParams.get("tab") === "about"
      ? "about"
      : "now",
  );
  const [panel, setPanel] = useState<"all" | "groups" | "roles" | "resources" | "activities" | "notes" | "recognition" | "support" | null>(null);
  const activeEventNote = panel === "recognition" ? recognitionNote : eventNote;
  const [panelBusy, setPanelBusy] = useState(false);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const [selectedWork, setSelectedWork] = useState<HomeworkRow | null>(null);
  const [contextDrafts, setContextDrafts] = useState<
    Record<LearnerContextKey, string>
  >(
    () =>
      Object.fromEntries(
        learnerContextFields.map((field) => [field.key, ""]),
      ) as Record<LearnerContextKey, string>,
  );
  // Keep confirmed server values separate from editable drafts, so unsaved typing
  // never masquerades as learner profile information.
  const [savedContext, setSavedContext] = useState<Record<LearnerContextKey, string>>(
    () => Object.fromEntries(learnerContextFields.map(field => [field.key, ""])) as Record<LearnerContextKey, string>,
  );
  const [editingContext, setEditingContext] = useState<LearnerContextKey | null>(null);
  const [choosingContext, setChoosingContext] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [contextSaving, setContextSaving] = useState<LearnerContextKey | null>(
    null,
  );
  const [contextMessage, setContextMessage] = useState("");
  const contextRequestIds = useRef<Record<LearnerContextKey, string>>(
    Object.fromEntries(
      learnerContextFields.map((field) => [field.key, crypto.randomUUID()]),
    ) as Record<LearnerContextKey, string>,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const { data: contextData, error: contextError } = await supabase.rpc(
        "teacher_get_operating_context",
      );
      if (contextError) throw contextError;
      const ctx = parseContext(contextData);
      if (!ctx.school_id) throw new Error("School context is missing.");
      const classAssignments = ctx.classes.filter(
        (item) => item.class_id === classId,
      );
      const authorizedAssignment = requestedSubjectId
        ? classAssignments.find(
            (item) => item.subject_id === requestedSubjectId,
          )
        : classAssignments.find((item) => item.is_class_teacher);
      if (!authorizedAssignment)
        throw new Error(
          requestedSubjectId
            ? "This subject is not assigned to you in the active school."
            : "Class-wide learner history is available to the class teacher. Use the subject view for subject-scoped learner evidence.",
        );
      setContext(ctx);

      const enrollmentRes = await supabase
        .from("student_classes")
        .select("student_id")
        .eq("school_id", ctx.school_id)
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .eq("is_current", true)
        .maybeSingle();
      if (enrollmentRes.error) throw enrollmentRes.error;
      if (!enrollmentRes.data)
        throw new Error(
          "This learner is not currently enrolled in this class.",
        );

      const learnerRes = await supabase
        .from("students")
        .select("id,name,admission_number,profile_id,gender,date_of_birth,deleted_at")
        .eq("id", studentId)
        .is("deleted_at", null)
        .maybeSingle();
      if (learnerRes.error) throw learnerRes.error;
      const learner = learnerRes.data as Student | null;
      if (!learner)
        throw new Error(
          "This learner identity could not be loaded. Retry instead of treating the enrolment as missing.",
        );
      setStudent(learner);

      const subjectIds = requestedSubjectId
        ? [requestedSubjectId]
        : Array.from(
            new Set(
              ctx.classes
                .filter((item) => item.class_id === classId)
                .map((item) => item.subject_id),
            ),
          );
      const [
        attendanceRes,
        homeworkRes,
        gradebookRes,
        cbcRes,
        examRes,
        subjectRes,
        eventsRes,
        libraryLoansRes,
        libraryBooksRes,
        interventionRows,
      ] = await Promise.all([
        supabase
          .from("attendance")
          .select("date,status,is_late")
          .eq("school_id", ctx.school_id)
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .order("date", { ascending: false })
          .limit(120),
        supabase
          .from("homework")
          .select("id,title,subject,due_date,type")
          .eq("school_id", ctx.school_id)
          .eq("class_id", classId)
          .eq("teacher_id", auth.user.id)
          .order("due_date", { ascending: false })
          .limit(80),
        subjectIds.length
          ? supabase
              .from("assessment_gradebook_entries")
              .select(
                "assessment_id,subject_id,score,max_score,percentage,assessment_type,assessment_title,released_at",
              )
              .eq("school_id", ctx.school_id)
              .eq("class_id", classId)
              .eq("student_id", studentId)
              .eq("teacher_id", auth.user.id)
              .in("subject_id", subjectIds)
              .order("released_at", { ascending: false })
              .limit(80)
          : Promise.resolve({ data: [], error: null }),
        subjectIds.length
          ? supabase
              .from("cbc_assessments")
              .select(
                "id,subject_id,strand_id,sub_strand,assessment_type,performance,notes,created_at",
              )
              .eq("school_id", ctx.school_id)
              .eq("class_id", classId)
              .eq("student_id", studentId)
              .eq("teacher_id", auth.user.id)
              .in("subject_id", subjectIds)
              .order("created_at", { ascending: false })
              .limit(80)
          : Promise.resolve({ data: [], error: null }),
        subjectIds.length
          ? supabase
              .from("exam_results")
              .select("id,exam_id,subject_id,marks,max_marks,result_state,is_absent,created_at")
              .eq("school_id", ctx.school_id)
              .eq("class_id", classId)
              .eq("student_id", studentId)
              .eq("teacher_id", auth.user.id)
              .in("subject_id", subjectIds)
              .order("created_at", { ascending: false })
              .limit(80)
          : Promise.resolve({ data: [], error: null }),
        subjectIds.length
          ? supabase.from("subjects").select("id,name").in("id", subjectIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("teacher_learner_events")
          .select(
            "id,subject_id,event_kind,event_code,note,visibility,metadata,due_at,resolved_at,created_at,created_by",
          )
          .eq("school_id", ctx.school_id)
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("library_borrowings")
          .select("id,book_id,issued_at,due_date,returned_at")
          .eq("school_id", ctx.school_id)
          .eq("student_id", studentId)
          .eq("borrower_type", "student")
          .is("deleted_at", null)
          .or(`issued_for_class_id.eq.${classId},issued_for_class_id.is.null`)
          .order("issued_at", { ascending: false })
          .limit(80),
        supabase
          .from("library_books")
          .select("id,title")
          .eq("school_id", ctx.school_id)
          .is("deleted_at", null),
        listInterventionQueue(classId),
      ]);
      for (const result of [
        attendanceRes,
        homeworkRes,
        gradebookRes,
        cbcRes,
        examRes,
        subjectRes,
        eventsRes,
        libraryLoansRes,
        libraryBooksRes,
      ])
        if (result.error) throw result.error;

      const homeworkRows: HomeworkRow[] = homeworkRes.data ?? [];
      const submissionRes = homeworkRows.length
        ? await supabase
            .from("homework_submissions")
            .select("homework_id,status,mark,feedback,submitted_at")
            .eq("student_id", studentId)
            .in(
              "homework_id",
              homeworkRows.map((item) => item.id),
            )
        : { data: [], error: null };
      if (submissionRes.error) throw submissionRes.error;

      setAttendance(attendanceRes.data ?? []);
      setHomework(homeworkRows);
      setSubmissions(submissionRes.data ?? []);
      setGradebook(gradebookRes.data ?? []);
      setCbc(cbcRes.data ?? []);
      setExams(examRes.data ?? []);
      setLibraryLoans((libraryLoansRes.data ?? []) as LibraryLoan[]);
      setLibraryBooks((libraryBooksRes.data ?? []) as LibraryBook[]);
      setSubjects(subjectRes.data ?? []);
      const loadedEvents = (eventsRes.data ?? []) as TeacherEvent[];
      setTeacherEvents(loadedEvents);
      const nextDrafts = Object.fromEntries(
        learnerContextFields.map((field) => [field.key, ""]),
      ) as Record<LearnerContextKey, string>;
      const seen = new Set<LearnerContextKey>();
      for (const event of loadedEvents) {
        const key = learnerContextKey(event);
        if (!key || seen.has(key)) continue;
        nextDrafts[key] = event.note ?? "";
        seen.add(key);
      }
      setSavedContext(nextDrafts);
      setContextDrafts(nextDrafts);
      setInterventions(
        interventionRows.filter((item) => item.studentId === studentId),
      );
    } catch (loadError) {
      console.error("[LearnerWorkspace] load", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Learner workspace could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [classId, requestedSubjectId, router, studentId]);

  const saveTeacherEvent = useCallback(
    async (
      eventKind: "observation" | "participation" | "recognition" | "followup",
    ) => {
      if (!context?.school_id || !context.teacher_id || !student || eventLock.current) return;
      if (
        (eventKind === "observation" || eventKind === "followup") &&
        !activeEventNote.trim()
      ) {
        setEventMessage("Add a short factual note first.");
        return;
      }
      eventLock.current = true;
      const key = JSON.stringify({ eventKind, note: activeEventNote.trim(), studentId, requestedSubjectId });
      if (!eventRequest.current[key]) eventRequest.current[key] = crypto.randomUUID();
      const requestId = eventRequest.current[key];
      setEventSaving(true);
      setEventMessage("");
      try {
      const defaults = {
        observation: "teacher_note",
        participation: "participated",
        recognition: "strong_effort",
        followup: "follow_up",
      } as const;
      const { error: insertError } = await supabase
        .from("teacher_learner_events")
        .insert({
          school_id: context.school_id,
          class_id: classId,
          student_id: student.id,
          subject_id: requestedSubjectId,
          event_kind: eventKind,
          event_code: defaults[eventKind],
          metadata: { request_id: requestId },
          note:
            activeEventNote.trim() ||
            (eventKind === "participation"
              ? "Participated in class."
              : "Strong effort shown."),
          visibility: eventKind === "observation" ? "author" : "subject_team",
          due_at:
            eventKind === "followup"
              ? new Date(Date.now() + 7 * 86400000).toISOString()
              : null,
          created_by: context.teacher_id,
        });
      let confirmed = !insertError;
      if (insertError?.code === "23505") {
        const existing = await supabase.from("teacher_learner_events").select("event_kind,note,subject_id").eq("created_by", context.teacher_id).eq("student_id", studentId).contains("metadata", { request_id: requestId }).maybeSingle();
        confirmed = !existing.error && existing.data?.event_kind === eventKind && existing.data?.note === activeEventNote.trim() && existing.data?.subject_id === requestedSubjectId;
      }
      if (!confirmed) {
        setEventMessage(insertError?.message ?? "Save could not be confirmed. Retry.");
      } else {
        delete eventRequest.current[key];
        if (eventKind === "recognition") setRecognitionNote(""); else setEventNote("");
        setEventMessage("Saved to this learner's story.");
        await load(false);
      }
      } catch (cause) {
        setEventMessage(cause instanceof Error ? cause.message : "Could not confirm the save. Retry.");
      } finally {
        eventLock.current = false;
        setEventSaving(false);
      }
    },
    [classId, context, activeEventNote, load, requestedSubjectId, student, studentId],
  );

  const saveLearnerContext = useCallback(
    async (key: LearnerContextKey) => {
      if (
        !context?.school_id ||
        !context.teacher_id ||
        !student ||
        requestedSubjectId
      )
        return;
      const value = contextDrafts[key].trim();
      if (value.length > 1200) {
        setContextMessage("Keep each section below 1,200 characters.");
        return;
      }
      setContextSaving(key);
      setContextMessage("");
      const previous = teacherEvents.find(
        (event) => learnerContextKey(event) === key,
      );
      const requestId = contextRequestIds.current[key];
      const { error: insertError } = await supabase
        .from("teacher_learner_events")
        .insert({
          school_id: context.school_id,
          class_id: classId,
          student_id: student.id,
          subject_id: null,
          event_kind: "management",
          event_code: `learner_context_${key}`,
          note: value || null,
          visibility: "class_teacher",
          metadata: {
            context_key: key,
            provenance: "teacher-entered",
            supersedes_event_id: previous?.id ?? null,
            request_id: requestId,
          },
          created_by: context.teacher_id,
        });
      if (insertError) {
        const { data: existing } =
          insertError.code === "23505"
            ? await supabase
                .from("teacher_learner_events")
                .select("id,event_code,note")
                .eq("created_by", context.teacher_id)
                .eq("student_id", student.id)
                .contains("metadata", { request_id: requestId })
                .maybeSingle()
            : { data: null };
        if (
          existing?.event_code === `learner_context_${key}` &&
          (existing.note ?? "") === value
        ) {
          contextRequestIds.current[key] = crypto.randomUUID();
          setContextMessage("Learner details saved.");
          await load(false);
          setEditingContext(null);
        } else {
          setContextMessage(insertError.message);
        }
      } else {
        contextRequestIds.current[key] = crypto.randomUUID();
        setContextMessage("Learner details saved.");
        await load(false);
        setEditingContext(null);
      }
      setContextSaving(null);
    },
    [
      classId,
      context,
      contextDrafts,
      load,
      requestedSubjectId,
      student,
      teacherEvents,
    ],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const subjectNames = useMemo(
    () => new Map(subjects.map((item) => [item.id, item.name])),
    [subjects],
  );
  const submissionMap = useMemo(
    () => new Map(submissions.map((item) => [item.homework_id, item])),
    [submissions],
  );
  const truth = useMemo(
    () =>
      buildLearnerTruthSummary({
        attendance,
        homework,
        submissions,
        assessments: gradebook,
        cbc,
        examCount: exams.length,
      }),
    [attendance, homework, submissions, gradebook, cbc, exams.length],
  );

  if (loading)
    return (
      <div
        className={experience.profileLoading}
        aria-label="Loading learner profile"
      >
        <div />
        <div />
        <div />
      </div>
    );
  if (!student || error)
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 16,
            padding: 18,
          }}
        >
          {error ?? "Learner not found."}
        </div>
        <button
          type="button"
          onClick={() => router.push(`/teacher/classhub/${classId}`)}
          style={{
            marginTop: 12,
            minHeight: 44,
            border: 0,
            borderRadius: 12,
            background: "var(--teacher-ink, #1c2923)",
            color: "#fff",
            padding: "0 16px",
            fontWeight: 750,
          }}
        >
          Back to class
        </button>
      </div>
    );

  const classAssignment = context?.classes.find(
    (item) => item.class_id === classId,
  );
  const assessmentEvidence =
    truth.assessment.released + truth.assessment.cbc + truth.assessment.exams;
  const activeIntervention =
    interventions.find(
      (item) => item.status !== "completed" && item.status !== "dismissed",
    ) ??
    interventions[0] ??
    null;
  const strengths = [
    truth.attendance.rate != null && truth.attendance.rate >= 90
      ? `Attendance is strong at ${truth.attendance.rate}%.`
      : null,
    truth.work.assigned >= 2 &&
    truth.work.submitted / Math.max(truth.work.assigned, 1) >= 0.8
      ? `${truth.work.submitted} of ${truth.work.assigned} assigned items have a submission record.`
      : null,
    truth.assessment.averageReleasedScore != null &&
    truth.assessment.averageReleasedScore >= 70
      ? `Released assessment average is ${truth.assessment.averageReleasedScore}%.`
      : null,
    activeIntervention?.priority === "extension"
      ? `${activeIntervention.subjectName} evidence supports extension work.`
      : null,
  ].filter((item): item is string => Boolean(item));

  const todayInsights = [
    truth.work.missing > 0
      ? `${truth.work.missing} overdue ${truth.work.missing === 1 ? "task needs" : "tasks need"} follow-up.`
      : null,
    activeIntervention
      ? `${activeIntervention.subjectName}: ${activeIntervention.masteryScore < 40 ? "needs focused support" : activeIntervention.priority === "extension" ? "ready for a challenge" : "needs more practice"} (${Math.round(activeIntervention.masteryScore)}% mastery).`
      : null,
    truth.trend
      ? `${subjectNames.get(truth.trend.subjectId) ?? "A subject"} changed ${truth.trend.delta > 0 ? "+" : ""}${truth.trend.delta} points across comparable assessments.`
      : null,
    truth.attendance.rate != null
      ? `Attendance is ${truth.attendance.rate}% across ${truth.attendance.records} recorded sessions.`
      : null,
  ].filter((item): item is string => Boolean(item));

  const nextAction = activeIntervention
    ? activeIntervention.remedialAssessmentId
      ? {
          title: "Check whether support worked",
          detail: `A follow-up assessment exists for ${activeIntervention.subjectName}. Review the released evidence when it is available.`,
          kind: "assessment" as const,
        }
      : {
          title:
            activeIntervention.priority === "extension"
              ? "Give the learner a stretch task"
              : "Close the support loop",
          detail: activeIntervention.recommendation,
          kind: "intervention" as const,
        }
    : truth.work.missing > 0
      ? {
          title: "Follow up missing work",
          detail: `${truth.work.missing} overdue item${truth.work.missing === 1 ? "" : "s"} currently have no submission record.`,
          kind: "work" as const,
        }
      : {
          title: "Keep building the learning picture",
          detail:
            "Record assessment, work and attendance evidence so VibeSchool can surface reliable changes and next steps.",
          kind: "assessment" as const,
        };

  const timeline = [
    ...attendance.map((item, index) => ({
      id: `attendance-${item.date}-${index}`,
      at: item.date,
      type: "Attendance",
      title: item.is_late ? "Arrived late" : item.status,
      detail: "Attendance record",
    })),
    ...homework.flatMap((item) => {
      const submission = submissionMap.get(item.id);
      return submission?.submitted_at
        ? [
            {
              id: `work-${item.id}`,
              at: submission.submitted_at,
              type: "Work",
              title: item.title,
              detail:
                submission.status === "marked" && submission.mark != null
                  ? `Marked · ${submission.mark}`
                  : submission.status.replaceAll("_", " "),
            },
          ]
        : [];
    }),
    ...gradebook
      .filter((item) => item.released_at)
      .map((item, index) => ({
        id: `assessment-${item.assessment_id}-${index}`,
        at: item.released_at as string,
        type: "Assessment",
        title: item.assessment_title,
        detail:
          item.percentage == null
            ? item.assessment_type
            : `${Math.round(item.percentage)}% · ${item.assessment_type}`,
      })),
    ...cbc.map((item) => ({
      id: `cbc-${item.id}`,
      at: item.created_at,
      type: "Learning evidence",
      title: `${subjectNames.get(item.subject_id) ?? "Subject"}${item.sub_strand ? ` · ${item.sub_strand}` : ""}`,
      detail: `${item.assessment_type} · ${item.performance}`,
    })),
    ...interventions
      .filter((item) => item.updatedAt)
      .map((item) => ({
        id: `support-${item.interventionId}`,
        at: item.updatedAt,
        type: "Support",
        title: `${item.subjectName} · ${item.priority === "extension" ? "Challenge" : "Learning support"}`,
        detail: item.status.replaceAll("_", " "),
      })),
    ...libraryLoans.flatMap((item) => [
      {
        id: `book-issued-${item.id}`,
        at: item.issued_at,
        type: "Class operations",
        title: `Borrowed · ${libraryBooks.find((book) => book.id === item.book_id)?.title ?? "School library book"}`,
        detail: `Return by ${formatDate(item.due_date)}`,
      },
      ...(item.returned_at
        ? [
            {
              id: `book-returned-${item.id}`,
              at: item.returned_at,
              type: "Class operations",
              title: `Returned · ${libraryBooks.find((book) => book.id === item.book_id)?.title ?? "School library book"}`,
              detail: "School library record updated",
            },
          ]
        : []),
    ]),
    ...teacherEvents.filter((item) => !isLearnerContextEvent(item)).map((item) => ({
        id: `teacher-event-${item.id}`,
        at: item.created_at,
        type:
          item.event_kind === "parent_contact"
            ? "Parent follow-up"
            : item.event_kind.charAt(0).toUpperCase() +
              item.event_kind.slice(1),
        title: item.event_code?.replaceAll("_", " ") ?? item.event_kind,
        detail:
          item.note ??
          (item.due_at
            ? `Follow-up due ${formatDate(item.due_at)}`
            : "Teacher-recorded event"),
      })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);
  const recordedDetails = learnerContextFields.filter(
    field => savedContext[field.key].trim().length > 0,
  );
  const unrecordedDetails = learnerContextFields.filter(
    field => !savedContext[field.key].trim(),
  );
  const editingField = learnerContextFields.find(field => field.key === editingContext);
  const openContextEditor = (key: LearnerContextKey) => {
    setChoosingContext(false);
    setContextMessage("");
    setContextDrafts(current => ({ ...current, [key]: savedContext[key] }));
    setEditingContext(key);
  };
  const closeContextEditor = () => {
    if (contextSaving !== null) return;
    if (editingContext) {
      setContextDrafts(current => ({ ...current, [editingContext]: savedContext[editingContext] }));
    }
    setContextMessage("");
    setEditingContext(null);
  };
  const availableTabs = requestedSubjectId ? tabs.filter((item) => item !== "about")
    : tabs;

  return (
    <div className={`studio-learner-profile ${experience.profilePage}`}>
      <header className={experience.profileHeader}>
        <button
          className={experience.iconButton}
          onClick={() => router.push(`/teacher/classhub/${classId}`)}
          aria-label="Back to class"
        >
          <ArrowLeft size={19} />
        </button>
        <div className={experience.profileAvatar} aria-hidden="true">
          {student.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("")}
        </div>
        <div className={experience.profileIdentity}>
          <h1>{student.name}</h1>
          <span>
            {classAssignment?.class_name ?? "Class"}
            {classAssignment?.stream ? ` ${classAssignment.stream}` : ""}
            {student.admission_number ? ` · Adm. no. ${student.admission_number}` : " · Admission no. not recorded"}
          </span>
        </div>
      </header>
      <LearnerSnapshot
        scores={gradebook}
        subjects={subjects}
        attendance={truth.attendance}
        work={truth.work}
        followUps={interventions.filter(item => item.status !== "completed" && item.status !== "dismissed").length + teacherEvents.filter(item => item.event_kind === "followup" && !item.resolved_at).length}
        overdue={truth.work.missing}
        assessmentRecords={gradebook.length + cbc.length + exams.length}
        releasedScores={gradebook.filter(item => Boolean(item.released_at) && item.percentage !== null && Number.isFinite(item.percentage)).length}
        onProgress={() => setTab("assessment")}
        onAttendance={() => setTab("attendance")}
        onWork={() => setTab("work")}
        onSupport={() => setPanel("support")}
      />

      <nav
        className={experience.profileTabs}
        aria-label="Learner profile sections"
      >
        {availableTabs.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? "page" : undefined}
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {item === "now" ? "Overview" : item}
          </button>
        ))}
      </nav>

      {tab === "now" && (
        <div style={{ display: "grid", gap: 10 }}>
          {!requestedSubjectId && ["strengths", "interests", "support_needs", "helpful_strategies"]
            .some(key => savedContext[key as LearnerContextKey].trim()) && (
            <section className={experience.overviewContext} aria-label="Saved learner details">
              <div className={experience.overviewContextHeading}>
                <div>
                  <h2>About {student.name.split(/\s+/)[0]}</h2>
                  <p>Teacher-recorded details</p>
                </div>
                <button type="button" onClick={() => setTab("about")}>View details</button>
              </div>
              <dl>
                {(["strengths", "interests", "support_needs", "helpful_strategies"] as LearnerContextKey[])
                  .filter(key => savedContext[key].trim())
                  .slice(0, 3)
                  .map(key => (
                    <div key={key}>
                      <dt>{learnerContextFields.find(field => field.key === key)?.label}</dt>
                      <dd>{savedContext[key]}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 750,
                color: "var(--teacher-muted, #627168)",
                marginBottom: 8,
              }}
            >
              WHAT YOU SHOULD KNOW TODAY
            </div>
            <div
              style={{
                fontSize: 18,
                lineHeight: 1.25,
                fontWeight: 750,
                marginBottom: 10,
              }}
            >
              {todayInsights.length
                ? `${student.name.split(" ")[0]}'s learning picture`
                : "Start building this learner's story"}
            </div>
            {todayInsights.length ? (
              <div style={{ display: "grid", gap: 7 }}>
                {todayInsights.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{ color: "#4f46e5", fontWeight: 750 }}
                    >
                      •
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{ color: "var(--teacher-muted, #627168)", fontSize: 12 }}
              >
                Attendance, work and assessment evidence will appear here as a
                simple teacher-readable story.
              </div>
            )}
          </Card>

          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 750,
                color: "var(--teacher-muted, #627168)",
                marginBottom: 8,
              }}
            >
              RECOMMENDED NEXT STEP
            </div>
            <div style={{ fontSize: 16, fontWeight: 750 }}>
              {nextAction.title}
            </div>
            <div
              style={{
                marginTop: 5,
                color: "#4b5563",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {nextAction.detail}
            </div>
            <button
              type="button"
              onClick={() =>
                nextAction.kind === "intervention"
                  ? setPanel("support")
                  : nextAction.kind === "work"
                    ? setTab("work")
                    : setTab("assessment")
              }
              style={{
                marginTop: 11,
                minHeight: 42,
                border: 0,
                borderRadius: 12,
                background: "#312e81",
                color: "#fff",
                padding: "0 14px",
                fontWeight: 750,
              }}
            >
              {nextAction.kind === "intervention"
                ? "Open support"
                : nextAction.kind === "work"
                  ? "Review work"
                  : "Inspect evidence"}
            </button>
          </Card>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 10,
            }}
          >
            <Card>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 750,
                  color: "var(--teacher-muted, #627168)",
                  marginBottom: 8,
                }}
              >
                DOING WELL
              </div>
              {strengths.length ? (
                <div style={{ display: "grid", gap: 7 }}>
                  {strengths.slice(0, 3).map((item) => (
                    <div
                      key={item}
                      style={{
                        fontSize: 11,
                        lineHeight: 1.4,
                        color: "#065f46",
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    color: "var(--teacher-muted, #627168)",
                    fontSize: 11,
                  }}
                >
                  No strong pattern is proven yet. Keep collecting evidence.
                </div>
              )}
            </Card>
            <Card>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 750,
                  color: "var(--teacher-muted, #627168)",
                  marginBottom: 8,
                }}
              >
                NEEDS ATTENTION
              </div>
              <div style={{ fontSize: 24, fontWeight: 750 }}>
                {truth.signals.length + (activeIntervention ? 1 : 0)}
              </div>
              <div
                style={{
                  marginTop: 3,
                  color: "var(--teacher-muted, #627168)",
                  fontSize: 11,
                }}
              >
                evidence-backed signal
                {truth.signals.length + (activeIntervention ? 1 : 0) === 1
                  ? ""
                  : "s"}
              </div>
            </Card>
          </div>

          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 750,
                color: "var(--teacher-muted, #627168)",
                marginBottom: 10,
              }}
            >
              WHAT NEEDS ATTENTION
            </div>
            {truth.signals.length === 0 ? (
              <div
                style={{ color: "var(--teacher-muted, #627168)", fontSize: 12 }}
              >
                {truth.evidenceState === "sufficient"
                  ? "No current concern is supported by the recorded evidence."
                  : "VibeSchool will wait for more evidence before labelling a learner concern."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {truth.signals.map((signal) => (
                  <div
                    key={signal.id}
                    style={{
                      background:
                        signal.id === "missing_work" ? "#fffbeb" : "#fef2f2",
                      color:
                        signal.id === "missing_work" ? "#92400e" : "#991b1b",
                      borderRadius: 12,
                      padding: 11,
                      fontSize: 12,
                    }}
                  >
                    <strong>
                      {signal.id === "missing_work"
                        ? "Missing required work"
                        : signal.id === "repeated_low_assessment"
                          ? "Repeated low assessment results"
                          : "Repeated support-level CBC evidence"}
                    </strong>
                    <div style={{ marginTop: 3 }}>{signal.reason}</div>
                    <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>
                      {signal.evidenceCount} evidence record
                      {signal.evidenceCount === 1 ? "" : "s"} ·{" "}
                      {signal.confidence} confidence
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 750,
                color: "var(--teacher-muted, #627168)",
                marginBottom: 10,
              }}
            >
              WHAT CHANGED
            </div>
            {!truth.trend ? (
              <div
                style={{ color: "var(--teacher-muted, #627168)", fontSize: 12 }}
              >
                <strong style={{ color: "#374151" }}>
                  No reliable trend yet.
                </strong>
                <div style={{ marginTop: 4 }}>
                  VibeSchool waits for at least 4 comparable released
                  assessments before saying performance is improving or
                  declining.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>
                    {subjectNames.get(truth.trend.subjectId) ?? "Subject"}
                  </strong>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 11,
                      color: "var(--teacher-muted, #627168)",
                    }}
                  >
                    {truth.trend.assessmentType} · {truth.trend.evidenceCount}{" "}
                    comparable assessments
                  </div>
                </div>
                <Badge
                  text={`${truth.trend.delta > 0 ? "+" : ""}${truth.trend.delta} pts`}
                  tone={
                    truth.trend.delta >= 5
                      ? "good"
                      : truth.trend.delta <= -5
                        ? "bad"
                        : "neutral"
                  }
                />
              </div>
            )}
          </Card>

          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 750,
                color: "var(--teacher-muted, #627168)",
                marginBottom: 10,
              }}
            >
              LEARNING SUPPORT
            </div>
            {interventions.length === 0 ? (
              <div
                style={{ color: "var(--teacher-muted, #627168)", fontSize: 12 }}
              >
                {truth.evidenceState === "sufficient"
                  ? "No active outcome support is currently required."
                  : "Outcome-level support will appear only when the evidence supports it."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {interventions.map((item) => (
                  <div
                    key={item.interventionId}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--teacher-muted, #627168)",
                            fontWeight: 800,
                          }}
                        >
                          {item.subjectName}
                        </div>
                        <strong style={{ display: "block", marginTop: 2 }}>
                          {item.priority === "extension"
                            ? "Ready for a challenge"
                            : item.masteryScore < 40
                              ? "Needs focused support"
                              : "Needs more practice"}
                        </strong>
                      </div>
                      <Badge
                        text={item.status.replaceAll("_", " ")}
                        tone={
                          item.status === "completed"
                            ? "good"
                            : item.status === "escalated"
                              ? "bad"
                              : "warn"
                        }
                      />
                    </div>
                    <div
                      style={{ marginTop: 7, fontSize: 12, lineHeight: 1.45 }}
                    >
                      {item.recommendation}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <Badge
                        text={`${Math.round(item.masteryScore)}% mastery`}
                        tone={
                          item.masteryScore >= 70
                            ? "good"
                            : item.masteryScore < 40
                              ? "bad"
                              : "warn"
                        }
                      />
                      <Badge text={`${item.evidenceCount} evidence`} />
                      <Badge
                        text={`${Math.round(item.confidenceScore)}% confidence`}
                      />
                    </div>
                    {item.evaluatedAt ? (
                      <div style={{ marginTop: 8, fontSize: 11 }}>
                        <strong>After support:</strong>{" "}
                        {item.masteryChange != null && item.masteryChange > 0
                          ? "+"
                          : ""}
                        {item.masteryChange ?? 0} mastery points
                      </div>
                    ) : item.remedialAssessmentId ? (
                      <div
                        style={{ marginTop: 8, fontSize: 11, color: "#4b5563" }}
                      >
                        Follow-up assessment created. Review the result when
                        released.
                      </div>
                    ) : (
                      <div
                        style={{ marginTop: 8, fontSize: 11, color: "#92400e" }}
                      >
                        Next step: give a short reassessment so you can see
                        whether the support worked.
                      </div>
                    )}
                    <details style={{ marginTop: 8 }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          fontSize: 11,
                          color: "var(--teacher-muted, #627168)",
                        }}
                      >
                        Technical evidence details
                      </summary>
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 11,
                          color: "var(--teacher-muted, #627168)",
                        }}
                      >
                        {item.outcomeCode ?? "Outcome"} ·{" "}
                        {item.outcomeText || "Outcome evidence"} ·{" "}
                        {item.priority} priority
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/teacher/assessment/interventions?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(studentId)}${requestedSubjectId ? `&subjectId=${encodeURIComponent(requestedSubjectId)}` : ""}`,
                )
              }
              style={{
                marginTop: 12,
                minHeight: 44,
                border: "1px solid #d1d5db",
                borderRadius: 12,
                background: "#fff",
                fontWeight: 750,
                padding: "0 14px",
              }}
            >
              Open support workspace
            </button>
          </Card>

          <section className={experience.schoolLife} aria-label="School life">
                  <div className={experience.sectionTitle}>
                    <h2>School life</h2>
                    <button type="button" className={experience.viewAll} onClick={() => setPanel("all")}>View all</button>
                  </div>
                  <div className={experience.schoolLifeActions}>
                    <button
                      onClick={() => setPanel("groups")}
                    >
                      <UsersRound />
                      <span>Groups</span>
                    </button>
                    {!requestedSubjectId && (
                      <button
                        onClick={() => {
                          setPanel("roles");
                        }}
                      >
                        <UserRound />
                        <span>Roles</span>
                      </button>
                    )}
                    {!requestedSubjectId && (
                      <button type="button" onClick={() => setPanel("activities")}>
                        <Activity />
                        <span>Activities</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setPanel("recognition");
                      }}
                    >
                      <Award />
                      <span>Recognition</span>
                    </button>
                    <button
                      onClick={() => {
                        setPanel("notes");
                      }}
                    >
                      <NotebookPen />
                      <span>Notes</span>
                    </button>
                    {!requestedSubjectId && (
                      <button
                        onClick={() => setPanel("resources")}
                      >
                        <Library />
                        <span>Resources</span>
                      </button>
                    )}
                  </div>
                </section>
                  <LearnerGroupSummary classId={classId} studentId={studentId} subjectId={requestedSubjectId} refreshKey={groupRefreshKey} onManage={() => setPanel("groups")}/>
        </div>
      )}

      {!requestedSubjectId && tab === "about" && (
        <div className={experience.aboutPage}>
          <header className={experience.aboutHeading}>
            <div>
              <p className={experience.aboutEyebrow}>Learner details</p>
              <h2>About {student.name.split(/\s+/)[0]}</h2>
              <p>
                {recordedDetails.length} of {learnerContextFields.length} notes recorded
                <span aria-hidden="true"> · </span>
                Class teacher only
              </p>
            </div>
            {unrecordedDetails.length > 0 && (
              <button type="button" className={experience.aboutAddButton}
                onClick={() => { setContextMessage(""); setChoosingContext(true); }}>
                <Plus size={17} aria-hidden="true"/>
                Add detail
              </button>
            )}
          </header>

          <section className={experience.aboutSection} aria-labelledby="learner-school-details">
            <div className={experience.aboutSectionHeading}>
              <div>
                <h3 id="learner-school-details">School details</h3>
                <p>Information recorded at enrolment</p>
              </div>
              <button type="button" className={experience.aboutEditButton}
                aria-label="Edit school details"
                onClick={() => { setContextMessage(""); setEditingIdentity(true); }}>
                <Pencil size={15} aria-hidden="true"/> Edit
              </button>
            </div>
            <dl className={experience.aboutIdentityGrid}>
              <div>
                <dt>Admission no.</dt>
                <dd>{student.admission_number || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Class</dt>
                <dd>{classAssignment?.class_name ?? "Class"}{classAssignment?.stream ? ` ${classAssignment.stream}` : ""}</dd>
              </div>
              <div>
                <dt>Date of birth</dt>
                <dd>{student.date_of_birth ? formatDate(student.date_of_birth) : "Not recorded"}</dd>
              </div>
              <div>
                <dt>Gender</dt>
                <dd>{student.gender || "Not recorded"}</dd>
              </div>
            </dl>
          </section>

          {recordedDetails.length === 0 ? (
            <section className={experience.aboutEmpty} aria-label="Learner notes">
              <div className={experience.aboutEmptyIcon} aria-hidden="true"><NotebookPen size={22}/></div>
              <h3>No learner notes recorded yet</h3>
              <p>Add strengths, interests or classroom strategies when you have observed them. Saved information will appear here as part of the learner profile.</p>
              <button type="button" className={experience.aboutAddButton}
                onClick={() => { setContextMessage(""); setChoosingContext(true); }}>
                <Plus size={17} aria-hidden="true"/> Add first detail
              </button>
            </section>
          ) : (
            aboutSections.map(section => {
              const visible = section.fields
                .map(key => learnerContextFields.find(field => field.key === key))
                .filter((field): field is typeof learnerContextFields[number] =>
                  Boolean(field && savedContext[field.key].trim()));
              if (!visible.length) return null;
              return (
                <section key={section.heading} className={experience.aboutSection}
                  aria-label={section.heading}>
                  <div className={experience.aboutSectionHeading}>
                    <h3>{section.heading}</h3>
                  </div>
                  <dl className={experience.aboutDetailList}>
                    {visible.map(field => (
                      <div key={field.key} className={experience.aboutDetailRow}>
                        <div>
                          <dt>{field.label}</dt>
                          <dd>{savedContext[field.key]}</dd>
                        </div>
                        <button type="button" className={experience.aboutEditButton}
                          onClick={() => openContextEditor(field.key)}
                          aria-label={`Edit ${field.label}`}>
                          <Pencil size={15} aria-hidden="true"/> Edit
                        </button>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })
          )}

          <p className={experience.aboutFootnote}>
            Notes here are teacher-recorded context, not assessment results or fixed labels.
            Manage official groups, duties and activities in School life.
          </p>
          {(contextMessage === "Learner details saved." || contextMessage === "School details saved.") && (
            <p className={experience.aboutSuccess} role="status">{contextMessage}</p>
          )}
        </div>
      )}

      {!requestedSubjectId && editingIdentity && (
        <LearnerDetailSheet title="Edit school details" learnerName={student.name}
          busy={identitySaving} onClose={() => setEditingIdentity(false)}>
          <LearnerIdentityFields key={student.id} classId={classId} studentId={studentId}
            identity={{ name: student.name, admission_number: student.admission_number, gender: student.gender, date_of_birth: student.date_of_birth }}
            onSaved={async () => { await load(false); setEditingIdentity(false); setContextMessage("School details saved."); }}
            onCancel={() => setEditingIdentity(false)}
            onBusyChange={setIdentitySaving}/>
        </LearnerDetailSheet>
      )}

      {!requestedSubjectId && choosingContext && (
        <LearnerDetailSheet title="Add learner detail" learnerName={student.name}
          onClose={() => setChoosingContext(false)}>
          <p className={experience.aboutPickerIntro}>
            Choose the detail to record. It will be shown directly on this profile after saving.
          </p>
          <div className={experience.aboutPickerList}>
            {unrecordedDetails.map(field => (
              <button key={field.key} type="button" onClick={() => openContextEditor(field.key)}>
                <span><strong>{field.label}</strong><small>{field.help}</small></span>
                <Plus size={17} aria-hidden="true"/>
              </button>
            ))}
          </div>
        </LearnerDetailSheet>
      )}

      {!requestedSubjectId && editingField && (
        <LearnerDetailSheet
          title={`${savedContext[editingField.key].trim() ? "Edit" : "Add"} ${editingField.label}`}
          learnerName={student.name}
          busy={contextSaving !== null}
          onClose={closeContextEditor}>
          <div className={experience.aboutEditor}>
            <p>{editingField.help}</p>
            <label htmlFor="edit-learner-context">{editingField.label}</label>
            <textarea id="edit-learner-context" value={contextDrafts[editingField.key]}
              rows={5} maxLength={1200} disabled={contextSaving !== null}
              placeholder={editingField.placeholder}
              onChange={event => setContextDrafts(current => ({
                ...current, [editingField.key]: event.target.value,
              }))}/>
            <div className={experience.aboutEditorFooter}>
              <span>{contextDrafts[editingField.key].length}/1200</span>
              <div>
                <button type="button" className={experience.aboutCancelButton}
                  disabled={contextSaving !== null} onClick={closeContextEditor}>Cancel</button>
                <button type="button" className={experience.aboutSaveButton}
                  disabled={contextSaving !== null}
                  onClick={() => void saveLearnerContext(editingField.key)}>
                  {contextSaving === editingField.key ? "Saving…" : "Save details"}
                </button>
              </div>
            </div>
            {contextMessage && !contextMessage.startsWith("Learner details saved.") && (
              <p role="alert" className={experience.aboutEditorError}>{contextMessage}</p>
            )}
          </div>
        </LearnerDetailSheet>
      )}

      {tab === "work" && (
        <Card>
          {homework.length === 0 ? (
            <div
              style={{
                padding: 22,
                textAlign: "center",
                color: "var(--teacher-muted, #627168)",
              }}
            >
              No homework assigned by you for this class yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {homework.map((item) => {
                const submission = submissionMap.get(item.id);
                const overdue =
                  Boolean(item.due_date) &&
                  !submission &&
                  new Date(item.due_date ?? "").getTime() < Date.now();
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() =>
                      setSelectedWork(item)
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "1px solid #e5e7eb",
                      borderRadius: 13,
                      padding: 11,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 750 }}>
                          {item.title}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: "var(--teacher-muted, #627168)",
                          }}
                        >
                          {item.subject || "Subject"} ·{" "}
                          {item.due_date
                            ? `Due ${formatDate(item.due_date)}`
                            : "No due date"}
                        </div>
                      </div>
                      {submission ? (
                        <Badge
                          text={submission.status}
                          tone={
                            submission.status === "marked" ? "good" : "neutral"
                          }
                        />
                      ) : (
                        <Badge
                          text={overdue ? "Missing" : "Not submitted"}
                          tone={overdue ? "bad" : "warn"}
                        />
                      )}
                    </div>
                    {submission?.mark != null && (
                      <div
                        style={{
                          marginTop: 7,
                          fontSize: 12,
                          fontWeight: 750,
                          color: "#065f46",
                        }}
                      >
                        Mark: {submission.mark}
                      </div>
                    )}
                    {submission?.feedback && (
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 11,
                          color: "var(--teacher-muted, #627168)",
                        }}
                      >
                        {submission.feedback}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === "assessment" && (
        <div style={{ display: "grid", gap: 10 }}>
          <a href={`/teacher/classhub/${classId}/student/${studentId}/progress${requestedSubjectId ? `?subjectId=${encodeURIComponent(requestedSubjectId)}` : ""}`}>Open full learning progress</a>
          <a href={`/teacher/assessment?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(studentId)}${requestedSubjectId ? `&subjectId=${encodeURIComponent(requestedSubjectId)}` : ""}`}>Open full assessment workspace</a>
          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 750,
                color: "var(--teacher-muted, #627168)",
                marginBottom: 10,
              }}
            >
              RELEASED ASSESSMENTS
            </div>
            {gradebook.length === 0 ? (
              <div style={{ color: "var(--teacher-muted, #627168)" }}>
                No released assessment scores yet.
              </div>
            ) : (
              gradebook.map((item, index) => {
                const percentage = item.percentage;
                return (
                  <div
                    key={`${item.assessment_id}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #f3f4f6",
                      padding: "8px 0",
                    }}
                  >
                    <div>
                      <strong>{item.assessment_title}</strong>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--teacher-muted, #627168)",
                        }}
                      >
                        {item.subject_id
                          ? (subjectNames.get(item.subject_id) ?? "Subject")
                          : "Unscoped subject"}{" "}
                        · {item.assessment_type}
                      </div>
                    </div>
                    {percentage === null ? (
                      <Badge text="No score" />
                    ) : (
                      <Badge
                        text={`${Math.round(percentage)}%`}
                        tone={
                          percentage >= 70
                            ? "good"
                            : percentage < 50
                              ? "bad"
                              : "warn"
                        }
                      />
                    )}
                  </div>
                );
              })
            )}
          </Card>
          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 750,
                color: "var(--teacher-muted, #627168)",
                marginBottom: 10,
              }}
            >
              CBC COMPETENCY EVIDENCE
            </div>
            {cbc.length === 0 ? (
              <div style={{ color: "var(--teacher-muted, #627168)" }}>
                No CBC competency observations recorded yet.
              </div>
            ) : (
              cbc.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #f3f4f6",
                    padding: "8px 0",
                  }}
                >
                  <div>
                    <strong>
                      {subjectNames.get(item.subject_id) ?? "Subject"}
                      {item.sub_strand ? ` · ${item.sub_strand}` : ""}
                    </strong>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--teacher-muted, #627168)",
                      }}
                    >
                      {item.assessment_type} · {formatDate(item.created_at)}
                    </div>
                  </div>
                  <Badge
                    text={item.performance}
                    tone={
                      item.performance === "EE" || item.performance === "ME"
                        ? "good"
                        : item.performance === "BE"
                          ? "bad"
                          : "warn"
                    }
                  />
                </div>
              ))
            )}
          </Card>
          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 750,
                color: "var(--teacher-muted, #627168)",
                marginBottom: 10,
              }}
            >
              EXAM RESULTS
            </div>
            {exams.length === 0 ? (
              <div style={{ color: "var(--teacher-muted, #627168)" }}>
                No exam results recorded by you for this learner.
              </div>
            ) : (
              exams.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #f3f4f6",
                    padding: "8px 0",
                  }}
                >
                  <span>
                    {subjectNames.get(item.subject_id) ?? "Subject"} ·{" "}
                    {formatDate(item.created_at)}
                  </span>
                  <Badge
                    text={item.result_state === "entered" && item.marks !== null
                      ? `${item.marks}/${item.max_marks}`
                      : item.result_state === "absent" ? "Absent" : item.result_state}
                    tone={item.is_absent ? "warn" : "neutral"}
                  />
                </div>
              ))
            )}
          </Card>
        </div>
      )}

      {tab === "attendance" && (
        <Card>
          <p style={{ fontSize: 12, color: "#617168", marginTop: 0 }}>Recent attendance · up to 120 recorded sessions</p>
          <a style={{ display: "inline-block", minHeight: 44, fontSize: 13 }} href={`/teacher/attendance?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(studentId)}`}>Open class attendance register</a>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 6,
              marginBottom: 12,
            }}
          >
            {[
              { label: "Sessions", value: truth.attendance.records },
              { label: "Present", value: truth.attendance.present },
              { label: "Absent", value: truth.attendance.absent },
              { label: "Late", value: truth.attendance.late },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "var(--teacher-canvas, #f5f6f2)",
                  borderRadius: 11,
                  padding: 8,
                  textAlign: "center",
                }}
              >
                <strong>{item.value}</strong>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--teacher-muted, #627168)",
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
          {attendance.length === 0 ? (
            <div
              style={{
                padding: 22,
                textAlign: "center",
                color: "var(--teacher-muted, #627168)",
              }}
            >
              No attendance records yet.
            </div>
          ) : (
            attendance.map((item, index) => (
              <div
                key={`${item.date}-${index}`}
                style={{
                  minHeight: 44,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <span>{formatDate(item.date)}</span>
                <Badge
                  text={item.is_late ? "Late" : item.status}
                  tone={
                    item.status === "present" && !item.is_late
                      ? "good"
                      : item.status === "absent"
                        ? "bad"
                        : "warn"
                  }
                />
              </div>
            ))
          )}
        </Card>
      )}

      {tab === "timeline" && (
        <Card>
          <div
            style={{
              fontSize: 11,
              fontWeight: 750,
              color: "var(--teacher-muted, #627168)",
              marginBottom: 4,
            }}
          >
            STUDENT STORY
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#4b5563",
              lineHeight: 1.45,
              marginBottom: 14,
            }}
          >
            One timeline of attendance, work, assessments, teacher observations,
            recognition, participation and support. Use it to see what happened
            before and after you acted.
          </div>
          {timeline.length === 0 ? (
            <div
              style={{
                padding: 22,
                textAlign: "center",
                color: "var(--teacher-muted, #627168)",
              }}
            >
              No dated learner events are recorded yet.
            </div>
          ) : (
            <div style={{ display: "grid" }}>
              {timeline.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "76px 12px 1fr",
                    gap: 8,
                    minHeight: 64,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--teacher-muted, #627168)",
                      paddingTop: 2,
                    }}
                  >
                    {formatDate(item.at)}
                  </div>
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 99,
                        background: "#4f46e5",
                        marginTop: 2,
                      }}
                    />
                    {index < timeline.length - 1 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 4,
                          top: 12,
                          bottom: -2,
                          width: 1,
                          background: "var(--teacher-border, #dfe5de)",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 750,
                        color: "#6366f1",
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                      }}
                    >
                      {item.type}
                    </div>
                    <div
                      style={{ marginTop: 2, fontSize: 12, fontWeight: 750 }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: "var(--teacher-muted, #627168)",
                      }}
                    >
                      {item.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      {panel && <LearnerDetailSheet title={panel === "all" ? "School life" : panel.charAt(0).toUpperCase() + panel.slice(1)} learnerName={student.name} busy={panelBusy || eventSaving}
        onClose={() => { if (panel === "groups") setGroupRefreshKey(current => current + 1); setPanel(null); setEventMessage(""); }}>
        {panel === "all" && <>{(["groups", ...(!requestedSubjectId ? ["roles", "activities", "resources"] as const : []), "recognition", "notes"] as const).map(kind =>
          <button key={kind} type="button" onClick={() => setPanel(kind)}>{kind.charAt(0).toUpperCase() + kind.slice(1)}</button>)}</>}
        {(panel === "groups" || panel === "roles" || panel === "resources" || panel === "activities") &&
          <LearnerRelatedRecords kind={panel} classId={classId} studentId={studentId} subjectId={requestedSubjectId} onBusyChange={setPanelBusy}/>}
        {(panel === "notes" || panel === "recognition") && <>
          <p>{panel === "recognition" ? "Record a specific achievement or effort." : "Private observations and learner follow-ups."}</p>
          <label>{panel === "recognition" ? "Recognition details" : "Factual note"}<textarea rows={3} maxLength={2000} disabled={eventSaving} value={activeEventNote} onChange={event => panel === "recognition" ? setRecognitionNote(event.target.value) : setEventNote(event.target.value)}/></label>
          <button disabled={eventSaving || !activeEventNote.trim()} onClick={() => void saveTeacherEvent(panel === "recognition" ? "recognition" : "observation")}>{eventSaving ? "Saving…" : panel === "recognition" ? "Save recognition" : "Save private note"}</button>
          {panel === "notes" && <><button disabled={eventSaving || !activeEventNote.trim()} onClick={() => void saveTeacherEvent("followup")}>Add follow-up · due in 7 days</button><button disabled={eventSaving || !activeEventNote.trim()} onClick={() => void saveTeacherEvent("participation")}>Record class participation</button></>}
          {eventMessage && <p role={eventMessage.startsWith("Saved") ? "status" : "alert"}>{eventMessage}</p>}
          {teacherEvents.filter(item => !isLearnerContextEvent(item) && (panel === "recognition" ? item.event_kind === "recognition" : ["observation", "followup", "participation"].includes(item.event_kind))).map(item => <article key={item.id}><strong>{formatDate(item.created_at)} · {item.event_kind}</strong><p>{item.note}</p></article>)}
        </>}
        {panel === "support" && <>
          {!interventions.length && !teacherEvents.some(item => item.event_kind === "followup" && !item.resolved_at) && <p>No active learning follow-ups recorded.</p>}
          {interventions.map(item => <article key={item.interventionId}><strong>{item.subjectName} · {item.status.replaceAll("_", " ")}</strong><p>{item.recommendation}</p></article>)}
          {teacherEvents.filter(item => item.event_kind === "followup" && !item.resolved_at).map(item => <article key={item.id}><strong>Teacher follow-up · {formatDate(item.created_at)}</strong><p>{item.note || "Follow-up recorded"}</p>{item.due_at && <p>Due {formatDate(item.due_at)}</p>}</article>)}
          <a href={`/teacher/assessment/interventions?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(studentId)}${requestedSubjectId ? `&subjectId=${encodeURIComponent(requestedSubjectId)}` : ""}`}>Open full support workspace</a>
        </>}
      </LearnerDetailSheet>}
      {selectedWork && <LearnerDetailSheet title={selectedWork.title} learnerName={student.name} onClose={() => setSelectedWork(null)}>
        <p>{selectedWork.subject} · {selectedWork.due_date ? `Due ${formatDate(selectedWork.due_date)}` : "No due date"}</p>
        <article><strong>{submissionMap.get(selectedWork.id)?.status ?? "Not submitted"}</strong>
          {submissionMap.get(selectedWork.id)?.mark != null && <p>Mark: {submissionMap.get(selectedWork.id)?.mark}</p>}
          <p>{submissionMap.get(selectedWork.id)?.feedback}</p></article>
        <a href={`/teacher/classhub/${classId}/homework/${selectedWork.id}?studentId=${encodeURIComponent(studentId)}${requestedSubjectId ? `&subjectId=${encodeURIComponent(requestedSubjectId)}` : ""}`}>Open full work details</a>
      </LearnerDetailSheet>}
    </div>
  );
}
