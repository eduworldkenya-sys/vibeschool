import { supabase } from "@/lib/supabase";

export interface PulseSnapshot {
  userId: string;
  schoolId: string;
  todaySlots: any[];
  attPending: { class_id: string; class_name: string }[];
  atRisk: { id: string; name: string; reason: string }[];
  currStats: { subject: string; covered: number; total: number }[];
  tpadDays: number | null;
  credits: number | null;
  streak: number;
  termProgressPct: number;
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
      .select("id,day_of_week,period,start_time,end_time,subject_id,class_id,subjects(name),classes(name)")
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

  const allSlots = ((slotsRes.data ?? []) as any[]).map((s: any) => ({
    id: s.id,
    day_of_week: s.day_of_week,
    period: s.period ?? 0,
    start_time: s.start_time,
    end_time: s.end_time,
    subject: one(s.subjects)?.name ?? "Subject",
    class_name: one(s.classes)?.name ?? "Class",
    class_id: s.class_id,
    subject_id: s.subject_id,
  }));

  const todaySlots = allSlots.filter(s => Number(s.day_of_week) === todayDow);
  const slotIds = todaySlots.map(s => s.id);
  const classIds = Array.from(new Set(todaySlots.map((s: any) => s.class_id as string)));
  const termRow = termRes.data;
  const activeTermNum = termRow?.term ?? (Math.floor(new Date().getMonth() / 4) + 1);

  // Term progress %
  let termProgressPct = 50;
  if (termRow?.start_date && termRow?.end_date) {
    const start = new Date(termRow.start_date).getTime();
    const end = new Date(termRow.end_date).getTime();
    const now = Date.now();
    termProgressPct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  }

  const [attTodayRes, tpadRes, absenceRes, streakRes] = await Promise.all([
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
    // Streak: count consecutive days teacher marked attendance
    supabase
      .from("attendance")
      .select("timestamp")
      .eq("marked_by", userId)
      .order("timestamp", { ascending: false })
      .limit(60),
  ]);

  // Attendance pending
  const markedIds = new Set((attTodayRes.data ?? []).map((a: any) => a.timetable_slot_id));
  const pendingMap = new Map<string, string>();
  todaySlots.filter(s => !markedIds.has(s.id)).forEach(s => pendingMap.set(s.class_id, s.class_name));
  const attPending = Array.from(pendingMap, ([class_id, class_name]) => ({ class_id, class_name }));

  // TPAD days
  const tpadDue = (tpadRes.data as any)?.self_appraisal_due ?? null;
  const tpadDays = tpadDue
    ? Math.ceil((new Date(tpadDue).getTime() - Date.now()) / 86400000)
    : null;

  // At-risk students
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

  // Streak calculation
  let streak = 0;
  const streakRows = (streakRes.data ?? []) as any[];
  const daysSeen = new Set<string>();
  for (const r of streakRows) {
    daysSeen.add(r.timestamp.split("T")[0]);
  }
  const checkDate = new Date();
  for (let i = 0; i < 30; i++) {
    const d = checkDate.toISOString().split("T")[0];
    if (daysSeen.has(d)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Curriculum coverage — fully parallel
  const tcRows = (tcRes.data ?? []) as any[];
  const currStats: { subject: string; covered: number; total: number }[] = [];
  await Promise.all(
    tcRows.slice(0, 4).map(async (tc: any) => {
      const subjectName = one(tc.subjects)?.name ?? "Subject";
      const classRes = await supabase.from("classes").select("name").eq("id", tc.class_id).single();
      const gradeName = classRes.data?.name ?? "";
      if (!gradeName) return;
      const [totalRes, coveredRes] = await Promise.all([
        supabase.from("curriculum").select("*", { count: "exact", head: true }).eq("grade", gradeName).eq("subject", subjectName),
        supabase.from("strand_progress").select("*", { count: "exact", head: true }).eq("teacher_id", userId).eq("subject_id", tc.subject_id).eq("school_id", schoolId).eq("term", activeTermNum).in("status", ["done", "teaching"]),
      ]);
      if ((totalRes.count ?? 0) > 0) {
        currStats.push({ subject: subjectName, covered: coveredRes.count ?? 0, total: totalRes.count ?? 1 });
      }
    })
  );

  return {
    userId, schoolId, todaySlots, attPending, atRisk,
    currStats, tpadDays, credits, streak, termProgressPct,
  };
}
