import { saveCanonicalExamResults } from "@/lib/teacher/examResultAuthority";
import { supabase } from "@/lib/supabase";
import { listInterventionQueue } from "@/lib/assessment/interventions";
import {
  emptyDocument,
  validateDocument,
  type Data,
  type Document,
  type Learner,
  type Attendance,
  type Homework,
  type Submission,
  type Assessment,
  type Exam,
  type Result,
  type Evidence,
  type Group,
  type Member,
  type Cell,
} from "./model";

type Response<T> = { data: T[] | null; error: { message: string } | null };
async function pages<T>(
  query: (from: number, to: number) => PromiseLike<Response<T>>,
): Promise<T[]> {
  const output: T[] = [];
  for (let offset = 0; offset < 20000; offset += 500) {
    const r = await query(offset, offset + 499);
    if (r.error) throw new Error(r.error.message);
    output.push(...(r.data ?? []));
    if ((r.data?.length ?? 0) < 500) return output;
  }
  throw new Error(
    "This class has too many records to load in one workbook. Open the individual register or gradebook.",
  );
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Teacher context could not be read.");
  return value as Record<string, unknown>;
}
export async function loadWorkbook(
  classId: string,
): Promise<{ data: Data; document: Document; revision: number }> {
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user)
    throw new Error("Sign in to open your class workbook.");
  const teacherId = auth.data.user.id;
  const context = await supabase.rpc("teacher_get_operating_context");
  if (context.error) throw new Error(context.error.message);
  const ctx = record(context.data);
  const schoolId = ctx.school_id;
  if (typeof schoolId !== "string" || ctx.teacher_id !== teacherId)
    throw new Error(
      "Your active school could not be confirmed. Open Me → School.",
    );
  const assignments = (Array.isArray(ctx.classes) ? ctx.classes : [])
    .map(record)
    .filter((a) => a.class_id === classId);
  if (!assignments.length)
    throw new Error("This class is not assigned to you in your active school.");
  const subjects = Array.from(
    new Map(
      assignments
        .filter(
          (a) =>
            typeof a.subject_id === "string" &&
            typeof a.subject_name === "string",
        )
        .map((a) => [
          a.subject_id,
          { id: String(a.subject_id), name: String(a.subject_name) },
        ]),
    ).values(),
  );
  const classes = Array.from(
    new Set(
      (Array.isArray(ctx.classes) ? ctx.classes : [])
        .map(record)
        .map((a) => String(a.class_id)),
    ),
  ).map((id) => {
    const rows = (Array.isArray(ctx.classes) ? ctx.classes : [])
      .map(record)
      .filter((a) => a.class_id === id);
    return {
      id,
      name: `${rows[0].class_name ?? "Class"} ${rows[0].stream ?? ""}`.trim(),
      isClassTeacher: rows.some(a => a.is_class_teacher === true),
      subjectIds: Array.from(new Set(rows.map((a) => String(a.subject_id)))),
    };
  });
  const terms = await pages<{
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  }>((from, to) =>
    supabase
      .from("academic_terms")
      .select("id,name,start_date,end_date")
      .eq("school_id", schoolId)
      .order("start_date")
      .order("id")
      .range(from, to),
  );
  const subjectIds = subjects.map((s) => s.id);
  const enrollments = await pages<{ student_id: string; joined_at: string }>(
    (from, to) =>
      supabase
        .from("student_classes")
        .select("student_id,joined_at")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("is_current", true)
        .order("id")
        .range(from, to),
  );
  const ids = Array.from(new Set(enrollments.map((e) => e.student_id)));
  const learners: Learner[] = [];
  for (let i = 0; i < ids.length; i += 200)
    learners.push(
      ...(await pages<Learner>((from, to) =>
        supabase
          .from("students")
          .select("id,name,admission_number,profile_id")
          .in("id", ids.slice(i, i + 200))
          .is("deleted_at", null)
          .order("id")
          .range(from, to),
      )),
    );
  for (const learner of learners)
    learner.joined_at = enrollments.find(
      (e) => e.student_id === learner.id,
    )?.joined_at;
  if (learners.length !== ids.length)
    throw new Error(
      "Some enrolled learners could not be read. Retry the workbook; do not add them again.",
    );
  const [
    attendance,
    homework,
    assessments,
    exams,
    results,
    evidence,
    groups,
    interventions,
    saved,
  ] = await Promise.all([
    pages<Attendance>((from, to) =>
      supabase
        .from("attendance")
        .select("student_id,date,status,is_late,timetable_slot_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .order("id")
        .range(from, to),
    ),
    pages<Homework>((from, to) =>
      supabase
        .from("homework")
        .select("id,title,due_date,subject,type,target_group_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("teacher_id", teacherId)
        .order("id")
        .range(from, to),
    ),
    subjectIds.length
      ? pages<Assessment>((from, to) =>
          supabase
            .from("assessment_gradebook_entries")
            .select(
              "student_id,assessment_id,subject_id,percentage,assessment_type,assessment_title,released_at",
            )
            .eq("school_id", schoolId)
            .eq("class_id", classId)
            .eq("teacher_id", teacherId)
            .in("subject_id", subjectIds)
            .order("attempt_id")
            .range(from, to),
        )
      : Promise.resolve([]),
    pages<Exam>((from, to) =>
      supabase
        .from("exams")
        .select(
          "id,name,term,academic_year,exam_type,is_locked,pass_mark,created_at",
        )
        .eq("school_id", schoolId)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    subjectIds.length
      ? pages<Result>((from, to) =>
          supabase
            .from("exam_results")
            .select(
              "id,student_id,exam_id,subject_id,marks,is_absent,updated_at",
            )
            .eq("school_id", schoolId)
            .eq("class_id", classId)
            .eq("teacher_id", teacherId)
            .in("subject_id", subjectIds)
            .order("id")
            .range(from, to),
        )
      : Promise.resolve([]),
    subjectIds.length
      ? pages<Evidence>((from, to) =>
          supabase
            .from("competency_evidence_ledger")
            .select(
              "student_id,outcome_id,subject_id,observed_at,proficiency,score,max_score",
            )
            .eq("school_id", schoolId)
            .eq("class_id", classId)
            .eq("observed_by", teacherId)
            .in("subject_id", subjectIds)
            .order("id")
            .range(from, to),
        )
      : Promise.resolve([]),
    pages<Group>((from, to) =>
      supabase
        .from("class_groups")
        .select("id,name,type")
        .is("archived_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .eq("class_id", classId)
        .order("id")
        .range(from, to),
    ),
    listInterventionQueue(classId),
    supabase.rpc("teacher_get_class_workbook", {
      p_school_id: schoolId,
      p_class_id: classId,
    }),
  ]);
  if (saved.error)
    throw new Error(
      `Your saved sheets could not be loaded: ${saved.error.message}`,
    );
  const memberGroupIds = [...new Set([...groups.map(g => g.id), ...homework.flatMap(h => h.target_group_id ? [h.target_group_id] : [])])];
  const members: Member[] = [];
  for (let i = 0; i < memberGroupIds.length; i += 200)
    members.push(
      ...(await pages<Member>((from, to) =>
        supabase
          .from("class_group_members")
          .select("student_id,group_id")
          .in(
            "group_id",
            memberGroupIds.slice(i, i + 200),
          )
          .order("id")
          .range(from, to),
      )),
    );
  for (const group of groups) {
    const r = await supabase.rpc('teacher_resolve_class_group_members', { p_group_id: group.id });
    if (r.error) throw new Error(`Group membership could not be confirmed: ${r.error.message}`);
    for (let i = members.length - 1; i >= 0; i--) if (members[i].group_id === group.id) members.splice(i, 1);
    members.push(...(r.data ?? []).map((row: { student_id: string }) => ({ group_id: group.id, student_id: row.student_id })));
  }
  const submissions: Submission[] = [];
  for (let i = 0; i < homework.length; i += 200)
    submissions.push(
      ...(await pages<Submission>((from, to) =>
        supabase
          .from("homework_submissions")
          .select("student_id,homework_id,status,mark,submitted_at,received_at")
          .in(
            "homework_id",
            homework.slice(i, i + 200).map((h) => h.id),
          )
          .order("id")
          .range(from, to),
      )),
    );
  const outcomes: { id: string; outcome_text: string }[] = [];
  const outcomeIds = Array.from(new Set(evidence.map((e) => e.outcome_id)));
  for (let i = 0; i < outcomeIds.length; i += 200)
    outcomes.push(
      ...(await pages<{ id: string; outcome_text: string }>((from, to) =>
        supabase
          .from("curriculum_learning_outcomes")
          .select("id,outcome_text")
          .in("id", outcomeIds.slice(i, i + 200))
          .order("id")
          .range(from, to),
      )),
    );
  const parentLinks: {
    student_id: string;
    relationship: string;
    is_primary: boolean;
  }[] = [];
  const parentMessages: { student_id: string; created_at: string }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    parentLinks.push(
      ...(await pages<{
        student_id: string;
        relationship: string;
        is_primary: boolean;
      }>((from, to) =>
        supabase
          .from("parent_student_links")
          .select("student_id,relationship,is_primary")
          .eq("school_id", schoolId)
          .in("student_id", ids.slice(i, i + 200))
          .order("id")
          .range(from, to),
      )),
    );
    parentMessages.push(
      ...(await pages<{ student_id: string; created_at: string }>((from, to) =>
        supabase
          .from("parent_messages")
          .select("student_id,created_at")
          .eq("school_id", schoolId)
          .eq("teacher_id", teacherId)
          .in("student_id", ids.slice(i, i + 200))
          .order("id")
          .range(from, to),
      )),
    );
  }
  const stored = record(saved.data);
  return {
    data: {
      teacherId,
      isClassTeacher: assignments.some(a => a.is_class_teacher === true),
      schoolId,
      classId,
      classes,
      terms,
      className:
        `${assignments[0].class_name ?? "Class"} ${assignments[0].stream ?? ""}`.trim(),
      subjects,
      learners: learners.sort((a, b) => a.name.localeCompare(b.name)),
      attendance,
      homework,
      submissions,
      assessments,
      exams,
      results,
      evidence,
      groups,
      members,
      interventions,
      outcomes,
      parentLinks,
      parentMessages,
      warnings: [],
    },
    document: stored.document
      ? validateDocument(stored.document)
      : emptyDocument(),
    revision: typeof stored.revision === "number" ? stored.revision : 0,
  };
}
export async function saveDocument(
  data: Data,
  doc: Document,
  revision: number,
): Promise<number> {
  validateDocument(doc);
  const response = await supabase.rpc("teacher_save_class_workbook", {
    p_school_id: data.schoolId,
    p_class_id: data.classId,
    p_expected_revision: revision,
    p_document: doc,
  });
  if (response.error)
    throw new Error(
      response.error.message.includes("workbook_conflict")
        ? "Another window saved this workbook. Export your draft, then reload before saving again."
        : response.error.message,
    );
  if (typeof response.data !== "number" || response.data !== revision + 1)
    throw new Error("The save could not be confirmed. Reload before retrying.");
  return response.data;
}
export async function saveAttendance(
  data: Data,
  date: string,
  changes: { studentId: string; value: Cell }[],
): Promise<void> {
  if (!changes.length) return;
  const rows = changes.map((c) => {
    if (
      !data.learners.some((l) => l.id === c.studentId) ||
      !["present", "absent", "late"].includes(String(c.value))
    )
      throw new Error(
        "Choose Present, Absent or Late for an enrolled learner.",
      );
    return {
      school_id: data.schoolId,
      class_id: data.classId,
      teacher_id: data.teacherId,
      student_id: c.studentId,
      date,
      status: c.value === "late" ? "present" : c.value,
      is_late: c.value === "late",
    };
  });
  const r = await supabase.rpc("upsert_attendance_batch", { p_rows: rows });
  if (r.error) throw new Error(r.error.message);
  const read = await supabase
    .from("attendance")
    .select("student_id,status,is_late")
    .eq("school_id", data.schoolId)
    .eq("class_id", data.classId)
    .eq("date", date)
    .is("timetable_slot_id", null)
    .in(
      "student_id",
      changes.map((c) => c.studentId),
    );
  if (
    read.error ||
    rows.some(
      (row) =>
        !(read.data ?? []).some(
          (s: { student_id: string; status: string; is_late: boolean }) =>
            s.student_id === row.student_id &&
            s.status === row.status &&
            s.is_late === row.is_late,
        ),
    )
  )
    throw new Error(
      "Attendance was sent, but the saved register could not be confirmed. Reload before retrying.",
    );
}
export async function saveExamMarks(
  data: Data,
  examId: string,
  subjectId: string,
  changes: { studentId: string; value: Cell }[],
): Promise<void> {
  if (!changes.length) return;
  if (!data.subjects.some((s) => s.id === subjectId))
    throw new Error("Choose one of your assigned subjects.");
  const exam = await supabase
    .from("exams")
    .select("id,is_locked")
    .eq("id", examId)
    .eq("school_id", data.schoolId)
    .single();
  if (exam.error || !exam.data || exam.data.is_locked)
    throw new Error("This exam is locked or unavailable.");
  const rows = changes.map((c) => {
    const absent = c.value === "ABS";
    const mark = absent ? 0 : c.value;
    if (
      !data.learners.some((l) => l.id === c.studentId) ||
      typeof mark !== "number" ||
      !Number.isFinite(mark) ||
      mark < 0 ||
      mark > 100
    )
      throw new Error("Use a mark from 0 to 100, or ABS for absence.");
    return {
      exam_id: examId,
      subject_id: subjectId,
      school_id: data.schoolId,
      class_id: data.classId,
      teacher_id: data.teacherId,
      student_id: c.studentId,
      marks: mark,
      is_absent: absent,
    };
  });
  await saveCanonicalExamResults(rows.map(row => ({
    examId:row.exam_id,schoolId:row.school_id,classId:row.class_id,subjectId:row.subject_id,studentId:row.student_id,
    marks:row.marks,isAbsent:row.is_absent,
    expectedUpdatedAt:data.results.find(result => result.exam_id===examId && result.subject_id===subjectId && result.student_id===row.student_id)?.updated_at??null,
  })));

}

export async function createSelectedGroup(
  data: Data,
  name: string,
  studentIds: string[],
  requestId: string,
): Promise<string> {
  const r = await supabase.rpc("teacher_create_workbook_group", {
    p_school_id: data.schoolId,
    p_class_id: data.classId,
    p_name: name,
    p_student_ids: studentIds,
    p_request_id: requestId,
  });
  if (r.error) throw new Error(r.error.message);
  if (typeof r.data !== "string")
    throw new Error("The new group could not be confirmed.");
  return r.data;
}
