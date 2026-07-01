import { supabase } from "@/lib/supabase";

export type WorkflowState = "Done" | "Current" | "Next" | "Blocked" | "Not available yet";

export type AttendanceStatus = "none" | "pending" | "completed";
export type TaskStatus = "none" | "assigned" | "completed";
export type MarkingStatus = "none" | "pending" | "completed";
export type RecordStatus = "none" | "pending" | "completed";

export interface Slot {
  id: string;
  day_of_week: number;
  period: number;
  class_id: string;
  class_name: string;
  subject: string;
  subject_id: string;
  start_time: string;
  end_time: string;

  lesson_plan_id: string | null;
  curriculum_id: string | null;
  scheme_id: string | null;

  attendance_status: AttendanceStatus;
  evidence_count: number;
  task_status: TaskStatus;
  submission_count: number;
  marking_status: MarkingStatus;
  progress_record_status: RecordStatus;
  reflection_status: RecordStatus;
  next_lesson_status: RecordStatus;
}

export interface ActivityLog {
  id: string;
  type: "attendance" | "lesson_plan" | "homework";
  title: string;
  subtitle: string;
  timestamp: string;
}

export interface PulseSnapshot {
  userId: string;
  schoolId: string;
  todaySlots: Slot[];
  tomorrowSlots: Slot[];
  homeworkDueTomorrow: { title: string; subject: string; due_date: string; class_id: string }[];
  attPending: { class_id: string; class_name: string }[];
  atRisk: { id: string; name: string; reason: string }[];
  currStats: { subject: string; subjectId: string; classId: string; covered: number; total: number; lessonCount: number }[];
  tpadDays: number | null;
  credits: number | null;
  streak: number;
  termProgressPct: number;
  unreadMessages: number;
  homeworkDue: { title: string; subject: string; due_date: string; class_id: string }[];
  homeworkUngraded: { title: string; subject: string; class_id: string; homework_id: string; count: number }[];
  missedLessonPlans: { slotId: string; className: string; subject: string; class_id: string; subject_id: string }[];
  consecutiveAbsences: { studentId: string; name: string; days: number }[];
  termNumber: number | null;
  weekNumber: number | null;
  recentActivity: ActivityLog[];
}

interface TimetableSlotRow {
  id: string;
  day_of_week: number;
  period: number | null;
  start_time: string;
  end_time: string;
  subject_id: string;
  class_id: string;
}

interface SubjectRow {
  id: string;
  name: string;
}

interface ClassRow {
  id: string;
  name: string;
  stream: string | null;
}

interface AcademicTermRow {
  id: string;
  term: number | null;
  start_date: string | null;
  end_date: string | null;
}

interface TeacherClassRow {
  class_id: string | null;
  subject_id: string;
  subjects?: { name: string } | { name: string }[] | null;
}

interface AttendanceSlotRow {
  timetable_slot_id: string | null;
}

interface AbsenceRow {
  student_id: string;
  date?: string;
  status?: string;
  students?: { name: string } | { name: string }[] | null;
}

interface TimestampRow {
  timestamp: string;
}

interface HomeworkRow {
  id?: string;
  title: string | null;
  subject: string | null;
  due_date: string | null;
  class_id: string | null;
  homework_submissions?: { status: string | null; mark?: number | null }[] | null;
}

interface LessonPlanRow {
  id?: string;
  class_id: string;
  subject_id: string;
  timetable_slot_id?: string | null;
  created_at?: string;
  classes?: { name: string } | { name: string }[] | null;
  subjects?: { name: string } | { name: string }[] | null;
}

interface ParticipantRow {
  thread_id: string | null;
  last_read_at: string | null;
}

interface MessageRow {
  thread_id: string | null;
  created_at: string | null;
}

interface MarkedAttendanceRow {
  class_id: string;
  marked_at: string;
  classes?: { name: string } | { name: string }[] | null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekStart(date: Date): string {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return isoDate(monday);
}

function lastSchoolDays(count: number): string[] {
  const days: string[] = [];
  const current = new Date();

  while (days.length < count) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) days.push(isoDate(current));
    current.setDate(current.getDate() - 1);
  }

  return days;
}

function safeTermProgress(term: AcademicTermRow | null): { termProgressPct: number; weekNumber: number | null } {
  if (!term?.start_date || !term.end_date) return { termProgressPct: 0, weekNumber: null };

  const start = new Date(term.start_date).getTime();
  const end = new Date(term.end_date).getTime();
  const now = Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { termProgressPct: 0, weekNumber: null };
  }

  return {
    termProgressPct: Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)),
    weekNumber: Math.max(1, Math.ceil((now - start) / (7 * 86400000)) + 1),
  };
}

function slotKey(classId: string, subjectId: string): string {
  return `${classId}:${subjectId}`;
}

export async function fetchPulseData(
  userId: string,
  schoolId: string,
  credits: number | null
): Promise<PulseSnapshot> {
  const today = isoDate(new Date());
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const tomorrowDow = todayDow === 7 ? 1 : todayDow + 1;
  const weekStart = getWeekStart(new Date());
  const recentSchoolDays = lastSchoolDays(5);

  const [slotsRes, termRes, teacherClassesRes] = await Promise.all([
    supabase
      .from("timetable_slots")
      .select("id,day_of_week,period,start_time,end_time,subject_id,class_id")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .order("start_time"),
    supabase
      .from("academic_terms")
      .select("id,term,start_date,end_date")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("teacher_classes")
      .select("class_id,subject_id,subjects(name)")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId),
  ]);

  const rawSlots = (slotsRes.data ?? []) as TimetableSlotRow[];
  const termRow = (termRes.data ?? null) as AcademicTermRow | null;
  const teacherClassRows = (teacherClassesRes.data ?? []) as TeacherClassRow[];

  const subjectIds = Array.from(new Set(rawSlots.map((slot) => slot.subject_id).filter(Boolean)));
  const classIdsFromSlots = Array.from(new Set(rawSlots.map((slot) => slot.class_id).filter(Boolean)));

  const [subjectsRes, classesRes] = await Promise.all([
    subjectIds.length > 0
      ? supabase.from("subjects").select("id,name").eq("school_id", schoolId).in("id", subjectIds)
      : Promise.resolve({ data: [] as SubjectRow[] }),
    classIdsFromSlots.length > 0
      ? supabase.from("classes").select("id,name,stream").eq("school_id", schoolId).in("id", classIdsFromSlots)
      : Promise.resolve({ data: [] as ClassRow[] }),
  ]);

  const subjectMap = new Map(
    ((subjectsRes.data ?? []) as SubjectRow[]).map((subject) => [subject.id, subject.name])
  );

  const classMap = new Map(
    ((classesRes.data ?? []) as ClassRow[]).map((klass) => [
      klass.id,
      klass.stream ? `${klass.name} ${klass.stream}` : klass.name,
    ])
  );

  const baseSlots = rawSlots.map((slot): Slot => ({
    id: slot.id,
    day_of_week: slot.day_of_week,
    period: slot.period ?? 0,
    start_time: slot.start_time,
    end_time: slot.end_time,
    subject_id: slot.subject_id,
    class_id: slot.class_id,
    subject: subjectMap.get(slot.subject_id) ?? "Subject",
    class_name: classMap.get(slot.class_id) ?? "Class",

    lesson_plan_id: null,
    curriculum_id: null,
    scheme_id: null,

    attendance_status: "none",
    evidence_count: 0,
    task_status: "none",
    submission_count: 0,
    marking_status: "none",
    progress_record_status: "none",
    reflection_status: "none",
    next_lesson_status: "none",
  }));

  const todayBaseSlots = baseSlots.filter((slot) => Number(slot.day_of_week) === todayDow);
  const tomorrowSlots = baseSlots
    .filter((slot) => Number(slot.day_of_week) === tomorrowDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const todaySlotIds = todayBaseSlots.map((slot) => slot.id);
  const todayClassIds = Array.from(new Set(todayBaseSlots.map((slot) => slot.class_id)));
  const activeTermNum = termRow?.term ?? null;
  const { termProgressPct, weekNumber } = safeTermProgress(termRow);

  const [attendanceTodayRes, lessonPlansRes, homeworkRes, ungradedHomeworkRes, absenceRes, recentAbsenceRes, streakRes, tpadRes, vcParticipantsRes, recentAttendanceRes, recentPlansRes] =
    await Promise.all([
      todaySlotIds.length > 0
        ? supabase
            .from("attendance")
            .select("timetable_slot_id")
            .eq("school_id", schoolId)
            .eq("teacher_id", userId)
            .in("timetable_slot_id", todaySlotIds)
            .eq("date", today)
        : Promise.resolve({ data: [] as AttendanceSlotRow[] }),

      todayBaseSlots.length > 0
        ? supabase
            .from("lesson_plans")
            .select("id,class_id,subject_id,timetable_slot_id")
            .eq("school_id", schoolId)
            .eq("teacher_id", userId)
            .eq("week_start", weekStart)
            .in("class_id", todayClassIds)
        : Promise.resolve({ data: [] as LessonPlanRow[] }),

      todayClassIds.length > 0
        ? supabase
            .from("homework")
            .select("id,title,subject,due_date,class_id")
            .eq("school_id", schoolId)
            .eq("teacher_id", userId)
            .gte("due_date", today)
            .lte("due_date", isoDate(new Date(Date.now() + 7 * 86400000)))
            .order("due_date")
        : Promise.resolve({ data: [] as HomeworkRow[] }),

      todayClassIds.length > 0
        ? supabase
            .from("homework")
            .select("id,title,subject,class_id,homework_submissions(status,mark)")
            .eq("school_id", schoolId)
            .eq("teacher_id", userId)
            .in("class_id", todayClassIds)
        : Promise.resolve({ data: [] as HomeworkRow[] }),

      termRow?.start_date && todayClassIds.length > 0
        ? supabase
            .from("attendance")
            .select("student_id,students(name)")
            .eq("school_id", schoolId)
            .eq("status", "absent")
            .in("class_id", todayClassIds)
            .gte("date", termRow.start_date)
        : Promise.resolve({ data: [] as AbsenceRow[] }),

      todayClassIds.length > 0
        ? supabase
            .from("attendance")
            .select("student_id,date,status,students(name)")
            .eq("school_id", schoolId)
            .in("class_id", todayClassIds)
            .in("date", recentSchoolDays)
            .order("date", { ascending: false })
        : Promise.resolve({ data: [] as AbsenceRow[] }),

      supabase
        .from("attendance")
        .select("marked_at")
        .eq("school_id", schoolId)
        .eq("teacher_id", userId)
        .order("marked_at", { ascending: false })
        .limit(60),

      termRow?.id
        ? supabase
            .from("tpad_deadlines")
            .select("self_appraisal_due")
            .eq("school_id", schoolId)
            .eq("term_id", termRow.id)
            .maybeSingle()
        : Promise.resolve({ data: null as { self_appraisal_due: string | null } | null }),

      supabase
        .from("vc_participants")
        .select("thread_id,last_read_at")
        .eq("school_id", schoolId)
        .eq("profile_id", userId),

      supabase
        .from("attendance")
        .select("class_id,marked_at,classes(name)")
        .eq("school_id", schoolId)
        .eq("teacher_id", userId)
        .order("marked_at", { ascending: false })
        .limit(5),

      supabase
        .from("lesson_plans")
        .select("id,class_id,subject_id,created_at,classes(name),subjects(name)")
        .eq("school_id", schoolId)
        .eq("teacher_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const attendanceRows = (attendanceTodayRes.data ?? []) as AttendanceSlotRow[];
  const markedSlotIds = new Set(attendanceRows.map((row) => row.timetable_slot_id).filter(Boolean));

  const lessonPlanRows = (lessonPlansRes.data ?? []) as LessonPlanRow[];
  const lessonPlanBySlot = new Map<string, string>();
  const lessonPlanByClassSubject = new Map<string, string>();

  for (const plan of lessonPlanRows) {
    if (plan.timetable_slot_id && plan.id) lessonPlanBySlot.set(plan.timetable_slot_id, plan.id);
    if (plan.id) lessonPlanByClassSubject.set(slotKey(plan.class_id, plan.subject_id), plan.id);
  }

  const homeworkRows = (homeworkRes.data ?? []) as HomeworkRow[];
  const homeworkDue = homeworkRows.map((homework) => ({
    title: homework.title ?? "Homework",
    subject: homework.subject ?? "",
    due_date: homework.due_date ?? "",
    class_id: homework.class_id ?? "",
  }));

  const tomorrowDate = isoDate(new Date(Date.now() + 86400000));
  const homeworkDueTomorrow = homeworkDue.filter((homework) => homework.due_date === tomorrowDate);

  const ungradedRows = (ungradedHomeworkRes.data ?? []) as HomeworkRow[];
  const homeworkUngraded = ungradedRows
    .map((homework) => {
      const submissions = homework.homework_submissions ?? [];
      const pendingCount = submissions.filter((submission) => submission.status === "submitted" && submission.mark == null).length;

      return {
        title: homework.title ?? "Homework",
        subject: homework.subject ?? "",
        class_id: homework.class_id ?? "",
        homework_id: homework.id ?? "",
        count: pendingCount,
      };
    })
    .filter((homework) => homework.count > 0 && homework.homework_id)
    .sort((a, b) => b.count - a.count);

  const homeworkByClass = new Map<string, HomeworkRow[]>();
  for (const homework of ungradedRows) {
    if (!homework.class_id) continue;
    const existing = homeworkByClass.get(homework.class_id) ?? [];
    existing.push(homework);
    homeworkByClass.set(homework.class_id, existing);
  }

  const todaySlots = todayBaseSlots.map((slot): Slot => {
    const lessonPlanId =
      lessonPlanBySlot.get(slot.id) ??
      lessonPlanByClassSubject.get(slotKey(slot.class_id, slot.subject_id)) ??
      null;

    const classHomework = homeworkByClass.get(slot.class_id) ?? [];
    const submittedCount = classHomework.reduce((total, homework) => {
      const submissions = homework.homework_submissions ?? [];
      return total + submissions.filter((submission) => submission.status === "submitted").length;
    }, 0);

    const pendingMarkingCount = classHomework.reduce((total, homework) => {
      const submissions = homework.homework_submissions ?? [];
      return total + submissions.filter((submission) => submission.status === "submitted" && submission.mark == null).length;
    }, 0);

    return {
      ...slot,
      lesson_plan_id: lessonPlanId,
      attendance_status: markedSlotIds.has(slot.id) ? "completed" : "pending",
      task_status: classHomework.length > 0 ? "assigned" : "none",
      submission_count: submittedCount,
      marking_status: pendingMarkingCount > 0 ? "pending" : submittedCount > 0 ? "completed" : "none",

      // These tables/routes are not confirmed yet, so they stay safe.
      curriculum_id: null,
      scheme_id: null,
      evidence_count: 0,
      progress_record_status: "none",
      reflection_status: "none",
      next_lesson_status: "none",
    };
  });

  const pendingMap = new Map<string, string>();
  todaySlots
    .filter((slot) => slot.attendance_status !== "completed")
    .forEach((slot) => pendingMap.set(slot.class_id, slot.class_name));
  const attPending = Array.from(pendingMap, ([class_id, class_name]) => ({ class_id, class_name }));

  const absenceRows = (absenceRes.data ?? []) as AbsenceRow[];
  const absenceCount: Record<string, { name: string; count: number }> = {};

  for (const row of absenceRows) {
    const studentName = one(row.students)?.name ?? "Student";
    if (!absenceCount[row.student_id]) absenceCount[row.student_id] = { name: studentName, count: 0 };
    absenceCount[row.student_id].count += 1;
  }

  const atRisk = Object.entries(absenceCount)
    .filter(([, value]) => value.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([id, value]) => ({ id, name: value.name, reason: `Absent ${value.count}x this term` }));

  const recentAbsenceRows = (recentAbsenceRes.data ?? []) as AbsenceRow[];
  const studentDayMap: Record<string, { name: string; dates: Set<string> }> = {};

  for (const row of recentAbsenceRows) {
    if (row.status !== "absent" || !row.date) continue;
    const studentName = one(row.students)?.name ?? "Student";
    if (!studentDayMap[row.student_id]) studentDayMap[row.student_id] = { name: studentName, dates: new Set() };
    studentDayMap[row.student_id].dates.add(row.date);
  }

  const consecutiveAbsences: { studentId: string; name: string; days: number }[] = [];

  for (const [studentId, value] of Object.entries(studentDayMap)) {
    let days = 0;
    for (const day of recentSchoolDays) {
      if (value.dates.has(day)) days += 1;
      else break;
    }
    if (days >= 2) consecutiveAbsences.push({ studentId, name: value.name, days });
  }

  consecutiveAbsences.sort((a, b) => b.days - a.days);

  const streakRows = (streakRes.data ?? []) as { marked_at: string }[];
  const markedDays = new Set(streakRows.map((row) => isoDate(new Date(row.marked_at))));
  const streakDate = new Date();
  let streak = 0;

  for (let i = 0; i < 30; i += 1) {
    const day = isoDate(streakDate);
    if (!markedDays.has(day)) break;
    streak += 1;
    streakDate.setDate(streakDate.getDate() - 1);
  }

  const tpadDue = (tpadRes.data as { self_appraisal_due: string | null } | null)?.self_appraisal_due ?? null;
  const tpadDays = tpadDue ? Math.ceil((new Date(tpadDue).getTime() - Date.now()) / 86400000) : null;

  let unreadMessages = 0;
  const participants = (vcParticipantsRes.data ?? []) as ParticipantRow[];

  if (participants.length > 0) {
    const threadIds = participants.map((participant) => participant.thread_id).filter((id): id is string => Boolean(id));
    const readMap = new Map(
      participants
        .filter((participant): participant is ParticipantRow & { thread_id: string } => Boolean(participant.thread_id))
        .map((participant) => [participant.thread_id, participant.last_read_at ?? "1970-01-01T00:00:00Z"])
    );

    if (threadIds.length > 0) {
      const { data: unreadRows } = await supabase
        .from("vc_messages")
        .select("thread_id,created_at")
        .eq("school_id", schoolId)
        .in("thread_id", threadIds)
        .neq("sender_id", userId)
        .is("deleted_at", null);

      const unreadThreadIds = new Set(
        ((unreadRows ?? []) as MessageRow[])
          .filter((row) => row.thread_id && row.created_at && row.created_at > (readMap.get(row.thread_id) ?? "1970-01-01T00:00:00Z"))
          .map((row) => row.thread_id as string)
      );

      unreadMessages = unreadThreadIds.size;
    }
  }

  const teacherClasses = teacherClassRows.filter((row): row is TeacherClassRow & { class_id: string } => Boolean(row.class_id));
  const currStats: PulseSnapshot["currStats"] = [];

  await Promise.allSettled(
    teacherClasses.map(async (teacherClass) => {
      const subjectName = one(teacherClass.subjects)?.name ?? "Subject";

      const classRes = await supabase
        .from("classes")
        .select("name")
        .eq("school_id", schoolId)
        .eq("id", teacherClass.class_id)
        .maybeSingle();

      const gradeName = classRes.data?.name ?? "";
      if (!gradeName) return;

      const [totalRes, coveredRes, lessonRes] = await Promise.allSettled([
        supabase
          .from("curriculum")
          .select("*", { count: "exact", head: true })
          .eq("grade", gradeName)
          .eq("subject", subjectName),
        activeTermNum
          ? supabase
              .from("strand_progress")
              .select("*", { count: "exact", head: true })
              .eq("school_id", schoolId)
              .eq("teacher_id", userId)
              .eq("subject_id", teacherClass.subject_id)
              .eq("class_id", teacherClass.class_id)
              .eq("term", activeTermNum)
              .in("status", ["done", "teaching"])
          : Promise.resolve({ count: 0 }),
        supabase
          .from("lesson_plans")
          .select("*", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("teacher_id", userId)
          .eq("subject_id", teacherClass.subject_id)
          .eq("class_id", teacherClass.class_id),
      ]);

      const total = totalRes.status === "fulfilled" ? totalRes.value.count ?? 0 : 0;
      const covered = coveredRes.status === "fulfilled" ? coveredRes.value.count ?? 0 : 0;
      const lessonCount = lessonRes.status === "fulfilled" ? lessonRes.value.count ?? 0 : 0;

      if (total > 0) {
        currStats.push({
          subject: subjectName,
          subjectId: teacherClass.subject_id,
          classId: teacherClass.class_id,
          covered,
          total,
          lessonCount,
        });
      }
    })
  );

  const missedLessonPlans = todaySlots
    .filter((slot) => !slot.lesson_plan_id)
    .map((slot) => ({
      slotId: slot.id,
      className: slot.class_name,
      subject: slot.subject,
      class_id: slot.class_id,
      subject_id: slot.subject_id,
    }));

  const recentAttendanceRows = (recentAttendanceRes.data ?? []) as MarkedAttendanceRow[];
  const recentPlanRows = (recentPlansRes.data ?? []) as LessonPlanRow[];

  const recentActivity: ActivityLog[] = [
    ...recentAttendanceRows
      .filter((row) => Boolean(row.marked_at))
      .map((row) => ({
        id: `attendance-${row.class_id}-${row.marked_at}`,
        type: "attendance" as const,
        title: "Attendance marked",
        subtitle: one(row.classes)?.name ?? "Class",
        timestamp: row.marked_at,
      })),
    ...recentPlanRows
      .filter((row) => Boolean(row.created_at))
      .map((row) => ({
        id: row.id ? `lesson-plan-${row.id}` : `lesson-plan-${row.created_at}`,
        type: "lesson_plan" as const,
        title: `Lesson plan filed — ${one(row.subjects)?.name ?? "Subject"}`,
        subtitle: one(row.classes)?.name ?? "Class",
        timestamp: row.created_at ?? "",
      })),
  ]
    .filter((activity) => Boolean(activity.timestamp))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 6);

  return {
    userId,
    schoolId,
    todaySlots,
    tomorrowSlots,
    homeworkDueTomorrow,
    attPending,
    atRisk,
    currStats,
    tpadDays,
    credits,
    streak,
    termProgressPct,
    unreadMessages,
    homeworkDue,
    homeworkUngraded,
    missedLessonPlans,
    consecutiveAbsences,
    termNumber: activeTermNum,
    weekNumber,
    recentActivity,
  };
}