import { supabase } from "@/lib/supabase";
import type { Slot, ActivityLog, PulseSnapshot } from "@/lib/types";

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
  classes?: { name: string; stream: string | null } | { name: string; stream: string | null }[] | null;
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

interface WeekAttendanceRow {
  timetable_slot_id: string | null;
  date: string;
  status: string;
}

interface WeekHomeworkRow {
  id: string;
  created_at: string | null;
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

export interface WeekOverride {
  termId: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
}

interface ActiveWeekRpcRow {
  term_id: string;
  term_number: number;
  academic_year: number;
  week_number: number;
  start_date: string;
  end_date: string;
  week_type: string;
  label: string | null;
}

export async function fetchPulseData(
  userId: string,
  schoolId: string,
  credits: number | null,
  weekOverride?: WeekOverride | null
): Promise<PulseSnapshot> {
  const today = isoDate(new Date());
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const tomorrowDow = todayDow === 7 ? 1 : todayDow + 1;
  const weekStart = getWeekStart(new Date());
  const recentSchoolDays = lastSchoolDays(5);

  const [slotsRes, termRes, teacherClassesRes, activeWeeksRes] = await Promise.all([
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
      .select("class_id,subject_id,subjects(name),classes(name,stream)")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId),
    supabase.rpc("get_teacher_active_weeks", { p_school_id: schoolId, p_teacher_id: userId }),
  ]);

  const rawSlots = (slotsRes.data ?? []) as TimetableSlotRow[];
  const termRow = (termRes.data ?? null) as AcademicTermRow | null;
  const teacherClassRows = (teacherClassesRes.data ?? []) as TeacherClassRow[];

  const myClasses: PulseSnapshot["myClasses"] = teacherClassRows
    .filter((row) => Boolean(row.class_id))
    .map((row) => {
      const cls = one(row.classes);
      const subj = one(row.subjects);
      return {
        class_id: row.class_id as string,
        class_name: cls ? (cls.stream ? `${cls.name} ${cls.stream}` : cls.name) : "Class",
        subject_id: row.subject_id,
        subject: subj?.name ?? "Subject",
        studentCount: 0,
      };
    });

  const allMyClassIds = Array.from(new Set(myClasses.map((c) => c.class_id)));
  if (allMyClassIds.length > 0) {
    const { data: rosterRows } = await supabase
      .from("students")
      .select("class_id")
      .in("class_id", allMyClassIds)
      .is("deleted_at", null);

    const countByClass = new Map<string, number>();
    for (const row of (rosterRows ?? []) as { class_id: string }[]) {
      countByClass.set(row.class_id, (countByClass.get(row.class_id) ?? 0) + 1);
    }
    for (const c of myClasses) {
      c.studentCount = countByClass.get(c.class_id) ?? 0;
    }
  }

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

  const availableWeeks: PulseSnapshot["availableWeeks"] = (
    (activeWeeksRes.data ?? []) as ActiveWeekRpcRow[]
  ).map((row) => ({
    termId: row.term_id,
    termNumber: row.term_number,
    academicYear: row.academic_year,
    weekNumber: row.week_number,
    startDate: row.start_date,
    endDate: row.end_date,
    weekType: row.week_type,
    label: row.label,
  }));

  // Always surface the live current week, even with zero activity logged yet.
  if (termRow?.id && weekNumber != null) {
    const alreadyListed = availableWeeks.some(
      (w) => w.termId === termRow.id && w.weekNumber === weekNumber
    );
    if (!alreadyListed) {
      const liveWeekEnd = (() => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 6);
        return isoDate(d);
      })();
      availableWeeks.push({
        termId: termRow.id,
        termNumber: activeTermNum ?? 0,
        academicYear: new Date(termRow.start_date ?? today).getFullYear(),
        weekNumber,
        startDate: weekStart,
        endDate: liveWeekEnd,
        weekType: "normal",
        label: null,
      });
    }
  }

  const selectedWeek: WeekOverride =
    weekOverride ??
    (termRow?.id && weekNumber != null
      ? {
          termId: termRow.id,
          weekNumber,
          startDate: weekStart,
          endDate: (() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 6);
            return isoDate(d);
          })(),
        }
      : { termId: "", weekNumber: 0, startDate: weekStart, endDate: weekStart });

  const selectedWeekKey = `${selectedWeek.termId}::${selectedWeek.weekNumber}`;

  let weekType: string | null = null;
  let weekLabel: string | null = null;
  if (termRow?.id && weekNumber != null) {
    const { data: weekRows } = await supabase
      .from("term_weeks")
      .select("school_id,week_type,label")
      .eq("term_id", termRow.id)
      .eq("week_number", weekNumber)
      .or(`school_id.eq.${schoolId},school_id.is.null`);
    const override = (weekRows ?? []).find((r) => r.school_id === schoolId);
    const national = (weekRows ?? []).find((r) => r.school_id === null);
    const chosen = override ?? national ?? null;
    weekType = chosen?.week_type ?? null;
    weekLabel = chosen?.label ?? null;
  }

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

  // Resolve every lesson_plan_id that today's slots could carry, so we
  // can look up real evidence/reflection/progress rows against them
  // instead of leaving these fields hardcoded.
  const todayLessonPlanIds = Array.from(
    new Set(
      todayBaseSlots
        .map((slot) => lessonPlanBySlot.get(slot.id) ?? lessonPlanByClassSubject.get(slotKey(slot.class_id, slot.subject_id)) ?? null)
        .filter((id): id is string => Boolean(id))
    )
  );

  const [evidenceRes, progressRes, reflectionRes] = await Promise.all([
    todayLessonPlanIds.length > 0
      ? supabase.from("lesson_evidence").select("lesson_id").in("lesson_id", todayLessonPlanIds)
      : Promise.resolve({ data: [] as { lesson_id: string | null }[] }),
    todayLessonPlanIds.length > 0
      ? supabase.from("progress_records").select("lesson_plan_id").in("lesson_plan_id", todayLessonPlanIds)
      : Promise.resolve({ data: [] as { lesson_plan_id: string | null }[] }),
    todayLessonPlanIds.length > 0
      ? supabase.from("lesson_reflections").select("lesson_plan_id").in("lesson_plan_id", todayLessonPlanIds)
      : Promise.resolve({ data: [] as { lesson_plan_id: string | null }[] }),
  ]);

  const evidenceCountByLesson = new Map<string, number>();
  for (const row of (evidenceRes.data ?? [])) {
    if (!row.lesson_id) continue;
    evidenceCountByLesson.set(row.lesson_id, (evidenceCountByLesson.get(row.lesson_id) ?? 0) + 1);
  }
  const progressDoneLessonIds = new Set((progressRes.data ?? []).map((row) => row.lesson_plan_id).filter(Boolean));
  const reflectionDoneLessonIds = new Set((reflectionRes.data ?? []).map((row) => row.lesson_plan_id).filter(Boolean));

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

      curriculum_id: null,
      scheme_id: null,
      evidence_count: lessonPlanId ? (evidenceCountByLesson.get(lessonPlanId) ?? 0) : 0,
      progress_record_status: lessonPlanId && progressDoneLessonIds.has(lessonPlanId) ? "completed" : "none",
      reflection_status: lessonPlanId && reflectionDoneLessonIds.has(lessonPlanId) ? "completed" : "none",
      next_lesson_status: "none",
    };
  });

  const pendingMap = new Map<string, string>();
  todaySlots
    .filter((slot) => slot.attendance_status !== "completed")
    .forEach((slot) => pendingMap.set(slot.class_id, slot.class_name));
  const attPending = Array.from(pendingMap, ([class_id, class_name]) => ({ class_id, class_name }));

  const totalStudentsToday = todayClassIds.length > 0
    ? (
        await supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .in("class_id", todayClassIds)
          .is("deleted_at", null)
      ).count ?? 0
    : 0;

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

  const overviewWeekStart = selectedWeek.startDate;
  const overviewWeekEnd = selectedWeek.endDate;

  const [weekAttendanceRes, weekHomeworkRes] = await Promise.all([
    supabase
      .from("attendance")
      .select("timetable_slot_id,date,status")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .gte("date", overviewWeekStart)
      .lte("date", overviewWeekEnd),
    supabase
      .from("homework")
      .select("id,created_at")
      .eq("school_id", schoolId)
      .eq("teacher_id", userId)
      .gte("created_at", `${overviewWeekStart}T00:00:00`)
      .lte("created_at", `${overviewWeekEnd}T23:59:59`),
  ]);

  const weekAttendanceRows = (weekAttendanceRes.data ?? []) as WeekAttendanceRow[];
  const lessonsTaughtSet = new Set(
    weekAttendanceRows
      .filter((row) => Boolean(row.timetable_slot_id))
      .map((row) => `${row.timetable_slot_id}-${row.date}`)
  );
  const presentCount = weekAttendanceRows.filter((row) => row.status === "present").length;
  const engagementPct = weekAttendanceRows.length > 0
    ? Math.round((presentCount / weekAttendanceRows.length) * 100)
    : 0;

  const weekOverview = {
    lessonsPlanned: baseSlots.length,
    lessonsTaught: lessonsTaughtSet.size,
    assignmentsGiven: ((weekHomeworkRes.data ?? []) as WeekHomeworkRow[]).length,
    engagementPct,
  };

  return {
    userId,
    schoolId,
    availableWeeks,
    selectedWeekKey,
    todaySlots,
    myClasses,
    tomorrowSlots,
    homeworkDueTomorrow,
    attPending,
    totalStudentsToday,
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
    weekType,
    weekLabel,
    recentActivity,
    weekOverview,
  };
}
