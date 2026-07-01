import { supabase } from "@/lib/supabase";

export interface PulseSnapshot {
  userId: string;
  schoolId: string;
  todaySlots: any[];
  tomorrowSlots: any[];
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
  recentActivity: { type: "attendance" | "lesson_plan"; title: string; subtitle: string; timestamp: string }[];
  todayLessonPlans: {
    id: string; class_id: string; subject_id: string;
    topic: string | null; objectives: string | null;
  }[];
  lessonEvidenceCounts: Record<string, number>;
  lessonReflectionDone: Record<string, boolean>;
  lessonInterventionCounts: Record<string, number>;
}

function one(x: any) { return Array.isArray(x) ? x[0] : x; }

export async function fetchPulseData(
  userId: string,
  schoolId: string,
  credits: number | null
): Promise<PulseSnapshot> {
  const today = new Date().toISOString().split("T")[0];
  const rawDow = new Date().getDay();
  const todayDow = rawDow === 0 ? 7 : rawDow;

  const [slotsRes, termRes, tcRes] = await Promise.all([
    supabase
      .from("timetable_slots")
      .select("id,day_of_week,period,start_time,end_time,subject_id,class_id")
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
      .eq("teacher_id", userId),
  ]);

  if (slotsRes.error) { console.error("[pulse] timetable_slots query failed:", slotsRes.error.message, slotsRes.error.details, slotsRes.error.hint); }
  if (termRes.error) { console.error("[pulse] academic_terms query failed:", termRes.error.message); }
  if (tcRes.error) { console.error("[pulse] teacher_classes query failed:", tcRes.error.message); }

  const rawSlots = (slotsRes.data ?? []) as any[];
  const slotSubjectIds = Array.from(new Set(rawSlots.map((s: any) => s.subject_id).filter(Boolean)));
  const slotClassIds = Array.from(new Set(rawSlots.map((s: any) => s.class_id).filter(Boolean)));

  const [subjNameRes, classNameRes] = await Promise.all([
    slotSubjectIds.length > 0
      ? supabase.from("subjects").select("id,name").in("id", slotSubjectIds)
      : Promise.resolve({ data: [], error: null }),
    slotClassIds.length > 0
      ? supabase.from("classes").select("id,name").in("id", slotClassIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if ((subjNameRes as any).error) { console.error("[pulse] subjects lookup failed:", (subjNameRes as any).error.message); }
  if ((classNameRes as any).error) { console.error("[pulse] classes lookup failed:", (classNameRes as any).error.message); }

  const subjNameMap = new Map(((subjNameRes.data ?? []) as any[]).map((s: any) => [s.id, s.name]));
  const classNameMap = new Map(((classNameRes.data ?? []) as any[]).map((c: any) => [c.id, c.name]));

  const allSlots = rawSlots.map((s: any) => ({
    id: s.id,
    day_of_week: s.day_of_week,
    period: s.period ?? 0,
    start_time: s.start_time,
    end_time: s.end_time,
    subject: subjNameMap.get(s.subject_id) ?? "Subject",
    class_name: classNameMap.get(s.class_id) ?? "Class",
    class_id: s.class_id,
    subject_id: s.subject_id,
  }));

  const todaySlots = allSlots.filter(s => Number(s.day_of_week) === todayDow);
  const tomorrowDow = todayDow === 7 ? 1 : todayDow + 1;
  const tomorrowSlots = allSlots
    .filter(s => Number(s.day_of_week) === tomorrowDow)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const slotIds = todaySlots.map(s => s.id);
  const classIds = Array.from(new Set(todaySlots.map((s: any) => s.class_id as string)));
  const termRow = termRes.data;
  const activeTermNum = termRow?.term ?? (Math.floor(new Date().getMonth() / 4) + 1);

  let termProgressPct = 50;
  let weekNumber: number | null = null;
  if (termRow?.start_date && termRow?.end_date) {
    const start = new Date(termRow.start_date).getTime();
    const end = new Date(termRow.end_date).getTime();
    const now = Date.now();
    termProgressPct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    weekNumber = Math.max(1, Math.ceil((now - start) / (7 * 86400000)) + 1);
  }

  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split("T")[0];

  const last5Days: string[] = [];
  const d = new Date();
  let counted = 0;
  while (counted < 5) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      last5Days.push(d.toISOString().split("T")[0]);
      counted++;
    }
    d.setDate(d.getDate() - 1);
  }

  const [attTodayRes, tpadRes, absenceRes, streakRes, vcUnreadRes, homeworkRes, plansRes, recentAttRes, ungradedRes, recentAttMarkedRes, recentPlansRes] = await Promise.all([
    slotIds.length > 0
      ? supabase
          .from("attendance")
          .select("timetable_slot_id")
          .in("timetable_slot_id", slotIds)
          .gte("timestamp", `${today}T00:00:00`)
          .lte("timestamp", `${today}T23:59:59`)
      : Promise.resolve({ data: [] }),
    termRow?.id
      ? supabase
          .from("tpad_deadlines")
          .select("self_appraisal_due")
          .eq("school_id", schoolId)
          .eq("term_id", termRow.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    termRow?.start_date && classIds.length > 0
      ? supabase
          .from("attendance")
          .select("student_id,students(name)")
          .eq("status", "absent")
          .in("class_id", classIds)
          .gte("timestamp", `${termRow.start_date}T00:00:00`)
      : Promise.resolve({ data: [] }),
    supabase
      .from("attendance")
      .select("timestamp")
      .eq("marked_by", userId)
      .order("timestamp", { ascending: false })
      .limit(60),
    supabase
      .from("vc_participants")
      .select("thread_id, last_read_at")
      .eq("profile_id", userId),
    classIds.length > 0
      ? supabase
          .from("homework")
          .select("title, subject, due_date, class_id")
          .eq("school_id", schoolId)
          .eq("teacher_id", userId)
          .gte("due_date", today)
          .lte("due_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0])
          .order("due_date")
      : Promise.resolve({ data: [] }),
    todaySlots.length > 0
      ? supabase
          .from("lesson_plans")
          .select("id, class_id, subject_id, topic, objectives")
          .eq("teacher_id", userId)
          .eq("week_start", weekStart)
          .in("class_id", todaySlots.map(s => s.class_id))
      : Promise.resolve({ data: [] }),
    classIds.length > 0 && last5Days.length > 0
      ? supabase
          .from("attendance")
          .select("student_id, date, status, students(name)")
          .in("class_id", classIds)
          .in("date", last5Days)
          .order("date", { ascending: false })
      : Promise.resolve({ data: [] }),
    classIds.length > 0
      ? supabase
          .from("homework")
          .select("id, title, subject, class_id, homework_submissions(status)")
          .eq("school_id", schoolId)
          .eq("teacher_id", userId)
          .in("class_id", classIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("attendance")
      .select("class_id, timestamp, classes(name)")
      .eq("marked_by", userId)
      .order("timestamp", { ascending: false })
      .limit(5),
    supabase
      .from("lesson_plans")
      .select("id, class_id, subject_id, created_at, classes(name), subjects(name)")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const markedIds = new Set((attTodayRes.data ?? []).map((a: any) => a.timetable_slot_id));
  const pendingMap = new Map<string, string>();
  todaySlots.filter(s => !markedIds.has(s.id)).forEach(s => pendingMap.set(s.class_id, s.class_name));
  const attPending = Array.from(pendingMap, ([class_id, class_name]) => ({ class_id, class_name }));

  const tpadDue = (tpadRes.data as any)?.self_appraisal_due ?? null;
  const tpadDays = tpadDue
    ? Math.ceil((new Date(tpadDue).getTime() - Date.now()) / 86400000)
    : null;

  const countMap: Record<string, { name: string; count: number }> = {};
  for (const a of ((absenceRes.data ?? []) as any[])) {
    const sId = a.student_id;
    const sName = one(a.students)?.name ?? "Student";
    if (!countMap[sId]) countMap[sId] = { name: sName, count: 0 };
    countMap[sId].count++;
  }
  const atRisk = Object.entries(countMap)
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([id, v]) => ({ id, name: v.name, reason: `Absent ${v.count}x this term` }))
    .slice(0, 4);

  let unreadMessages = 0;
  try {
    const participants = (vcUnreadRes.data ?? []) as any[];
    if (participants.length > 0) {
      const threadIds2 = participants.map((p: any) => p.thread_id);
      const readMap: Record<string, string> = {};
      participants.forEach((p: any) => { readMap[p.thread_id] = p.last_read_at ?? "1970-01-01T00:00:00Z"; });
      const { data: unreadRows } = await supabase
        .from("vc_messages")
        .select("thread_id, created_at")
        .in("thread_id", threadIds2)
        .neq("sender_id", userId)
        .is("deleted_at", null);
      const unreadSet = new Set(
        ((unreadRows ?? []) as any[])
          .filter((r: any) => r.created_at > (readMap[r.thread_id] ?? "1970-01-01T00:00:00Z"))
          .map((r: any) => r.thread_id)
      );
      unreadMessages = unreadSet.size;
    }
  } catch { unreadMessages = 0; }

  const homeworkDue = ((homeworkRes.data ?? []) as any[]).map((h: any) => ({
    title: h.title ?? "Homework",
    subject: h.subject ?? "",
    due_date: h.due_date ?? "",
    class_id: h.class_id ?? "",
  }));

  const tomorrowDateStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const homeworkDueTomorrow = homeworkDue.filter(h => h.due_date === tomorrowDateStr);

  const homeworkUngraded = ((ungradedRes.data ?? []) as any[])
    .map((h: any) => {
      const subs = Array.isArray(h.homework_submissions) ? h.homework_submissions : [];
      const count = subs.filter((s: any) => s.status === "submitted").length;
      return {
        title: h.title ?? "Homework",
        subject: h.subject ?? "",
        class_id: h.class_id ?? "",
        homework_id: h.id,
        count,
      };
    })
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count);

  const todayLessonPlans = ((plansRes.data ?? []) as any[]).map((p: any) => ({
    id: p.id,
    class_id: p.class_id,
    subject_id: p.subject_id,
    topic: p.topic ?? null,
    objectives: p.objectives ?? null,
  }));
  const filedSet = new Set(todayLessonPlans.map(p => `${p.class_id}:${p.subject_id}`));
  const missedLessonPlans = todaySlots
    .filter(s => !filedSet.has(`${s.class_id}:${s.subject_id}`))
    .map(s => ({
      slotId: s.id,
      className: s.class_name,
      subject: s.subject,
      class_id: s.class_id,
      subject_id: s.subject_id,
    }));

  const todayLessonIds = todayLessonPlans.map(p => p.id);
  const [evidenceRes, reflectionRes, interventionRes] = todayLessonIds.length > 0
    ? await Promise.all([
        supabase.from("lesson_evidence").select("lesson_id").in("lesson_id", todayLessonIds),
        supabase.from("lesson_reflections").select("lesson_id").in("lesson_id", todayLessonIds),
        supabase.from("lesson_interventions").select("lesson_id, status").in("lesson_id", todayLessonIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }] as any[];

  const lessonEvidenceCounts: Record<string, number> = {};
  for (const r of ((evidenceRes.data ?? []) as any[])) {
    lessonEvidenceCounts[r.lesson_id] = (lessonEvidenceCounts[r.lesson_id] ?? 0) + 1;
  }
  const lessonReflectionDone: Record<string, boolean> = {};
  for (const r of ((reflectionRes.data ?? []) as any[])) {
    lessonReflectionDone[r.lesson_id] = true;
  }
  const lessonInterventionCounts: Record<string, number> = {};
  for (const r of ((interventionRes.data ?? []) as any[])) {
    if (r.status === "resolved") continue;
    lessonInterventionCounts[r.lesson_id] = (lessonInterventionCounts[r.lesson_id] ?? 0) + 1;
  }

  const recentRows = (recentAttRes.data ?? []) as any[];
  const studentDayMap: Record<string, { name: string; dates: Set<string> }> = {};
  for (const r of recentRows) {
    if (r.status !== "absent") continue;
    const sid = r.student_id;
    const sname = one(r.students)?.name ?? "Student";
    if (!studentDayMap[sid]) studentDayMap[sid] = { name: sname, dates: new Set() };
    studentDayMap[sid].dates.add(r.date);
  }
  const consecutiveAbsences: { studentId: string; name: string; days: number }[] = [];
  for (const [sid, val] of Object.entries(studentDayMap)) {
    let streak = 0;
    for (const day of last5Days) {
      if (val.dates.has(day)) streak++;
      else break;
    }
    if (streak >= 2) consecutiveAbsences.push({ studentId: sid, name: val.name, days: streak });
  }
  consecutiveAbsences.sort((a, b) => b.days - a.days);

  let streak = 0;
  const streakRows = (streakRes.data ?? []) as any[];
  const daysSeen = new Set<string>();
  for (const r of streakRows) {
    daysSeen.add(r.timestamp.split("T")[0]);
  }
  const checkDate = new Date();
  for (let i = 0; i < 30; i++) {
    const dd = checkDate.toISOString().split("T")[0];
    if (daysSeen.has(dd)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  const tcRows = (tcRes.data ?? []) as any[];
  const currStats: { subject: string; subjectId: string; classId: string; covered: number; total: number; lessonCount: number }[] = [];
  await Promise.allSettled(
    tcRows.map(async (tc: any) => {
      const subjectName = one(tc.subjects)?.name ?? "Subject";
      const classRes = await supabase.from("classes").select("name").eq("id", tc.class_id).single();
      const gradeName = classRes.data?.name ?? "";
      if (!gradeName) return;
      const [totalRes, coveredRes, lessonRes] = await Promise.allSettled([
        supabase.from("curriculum").select("*", { count: "exact", head: true }).eq("grade", gradeName).eq("subject", subjectName),
        supabase.from("strand_progress").select("*", { count: "exact", head: true }).eq("teacher_id", userId).eq("subject_id", tc.subject_id).eq("school_id", schoolId).eq("term", activeTermNum).in("status", ["done", "teaching"]),
        supabase.from("lesson_plans").select("*", { count: "exact", head: true }).eq("teacher_id", userId).eq("subject_id", tc.subject_id).eq("class_id", tc.class_id),
      ]);
      const totalCount   = totalRes.status   === "fulfilled" ? ((totalRes as any).value?.count   ?? 0) : 0;
      const coveredCount = coveredRes.status === "fulfilled" ? ((coveredRes as any).value?.count ?? 0) : 0;
      const lessonCount  = lessonRes.status  === "fulfilled" ? ((lessonRes as any).value?.count  ?? 0) : 0;
      if (totalCount > 0) {
        currStats.push({
          subject: subjectName,
          subjectId: tc.subject_id,
          classId: tc.class_id,
          covered: coveredCount,
          total: totalCount,
          lessonCount,
        });
      }
    })
  );

  const recentActivity: PulseSnapshot["recentActivity"] = [
    ...((recentAttMarkedRes.data ?? []) as any[]).map((r: any) => ({
      type: "attendance" as const,
      title: "Attendance marked",
      subtitle: one(r.classes)?.name ?? "Class",
      timestamp: r.timestamp,
    })),
    ...((recentPlansRes.data ?? []) as any[]).map((r: any) => ({
      type: "lesson_plan" as const,
      title: `Lesson plan filed — ${one(r.subjects)?.name ?? "Subject"}`,
      subtitle: one(r.classes)?.name ?? "Class",
      timestamp: r.created_at,
    })),
  ]
    .filter(r => !!r.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 6);

  return {
    userId, schoolId, todaySlots, tomorrowSlots, attPending, atRisk,
    currStats, tpadDays, credits, streak, termProgressPct,
    unreadMessages, homeworkDue, homeworkDueTomorrow, homeworkUngraded, missedLessonPlans, consecutiveAbsences,
    termNumber: termRow?.term ?? null, weekNumber, recentActivity,
    todayLessonPlans, lessonEvidenceCounts, lessonReflectionDone, lessonInterventionCounts,
  };
}
