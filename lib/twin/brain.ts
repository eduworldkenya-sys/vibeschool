// lib/twin/brain.ts
// TwinBrain — the JS intelligence layer for VibeTwin
// Loads once, caches to localStorage, answers without AI

import { supabase } from "@/lib/supabase";
import { fetchPulseData, PulseSnapshot } from "@/lib/pulse/fetcher";
import { runRules } from "@/lib/pulse/rules";

const BRAIN_KEY  = "vibe_twin_brain_v1";
const BRAIN_TTL  = 30 * 60 * 1000;

export interface TeacherFingerprint {
  peakHour:           number;
  weakSubjects:       string[];
  strongSubjects:     string[];
  studentsCaredAbout: string[];
  consistencyScore:   number;
  lastConcern:        string;
  totalQueries:       number;
  joinedAt:           string;
}

export interface TwinBrainState {
  userId:        string;
  schoolId:      string;
  fullName:      string;
  firstName:     string;
  schoolName:    string;
  snap:          PulseSnapshot | null;
  fingerprint:   TeacherFingerprint;
  rulesOutput:   ReturnType<typeof runRules> | null;
  intents:       Record<string, string>;
  recentMemory:  { type: string; content: string; created_at: string }[];
  loadedAt:      number;
  isStale:       boolean;
}

function defaultFingerprint(): TeacherFingerprint {
  return {
    peakHour: 8, weakSubjects: [], strongSubjects: [],
    studentsCaredAbout: [], consistencyScore: 100,
    lastConcern: "", totalQueries: 0, joinedAt: new Date().toISOString(),
  };
}

function loadFingerprint(userId: string): TeacherFingerprint {
  try {
    const raw = localStorage.getItem(`twin_fp_${userId}`);
    if (!raw) return defaultFingerprint();
    return { ...defaultFingerprint(), ...JSON.parse(raw) };
  } catch { return defaultFingerprint(); }
}

export function saveFingerprint(userId: string, fp: TeacherFingerprint) {
  try { localStorage.setItem(`twin_fp_${userId}`, JSON.stringify(fp)); } catch {}
}

export function updateFingerprint(userId: string, query: string, brain: TwinBrainState): TeacherFingerprint {
  const fp = { ...brain.fingerprint };
  fp.totalQueries++;
  fp.lastConcern = query.slice(0, 100);
  fp.peakHour    = new Date().getHours();
  const names = (brain.snap?.atRisk ?? []).map(s => s.name);
  for (const name of names) {
    if (query.toLowerCase().includes(name.toLowerCase())) {
      if (!fp.studentsCaredAbout.includes(name)) {
        fp.studentsCaredAbout = [name, ...fp.studentsCaredAbout].slice(0, 10);
      }
    }
  }
  const stats = brain.snap?.currStats ?? [];
  fp.weakSubjects   = stats.filter(s => s.total > 0 && (s.covered / s.total) < 0.4).map(s => s.subject);
  fp.strongSubjects = stats.filter(s => s.total > 0 && (s.covered / s.total) >= 0.7).map(s => s.subject);
  fp.consistencyScore = Math.min(100, (brain.snap?.streak ?? 0) * 10 + 50);
  saveFingerprint(userId, fp);
  return fp;
}

function buildIntents(snap: PulseSnapshot | null, name: string): Record<string, string> {
  if (!snap) return {};
  const intents: Record<string, string> = {};
  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", month: "long", day: "numeric" });

  if (snap.attPending.length > 0) {
    const names = snap.attPending.map(c => c.class_name).join(", ");
    intents["attendance_status"] = `${names} — attendance not yet submitted today.`;
    intents["what_is_pending"]   = `You still need to mark attendance for: ${names}.`;
    intents["have_i_marked"]     = `Not yet. ${names} still pending.`;
  } else {
    intents["attendance_status"] = "All attendance submitted for today. Well done.";
    intents["have_i_marked"]     = "Yes — all classes marked today.";
  }

  if (snap.atRisk.length > 0) {
    const list = snap.atRisk.map(s => `${s.name} (${s.reason})`).join(", ");
    intents["at_risk_students"] = `Students needing attention: ${list}.`;
    intents["who_is_absent"]    = `Frequent absentees this term: ${list}.`;
    intents["student_concerns"] = `${snap.atRisk[0].name} is your most at-risk student — ${snap.atRisk[0].reason}.`;
  } else {
    intents["at_risk_students"] = "No students flagged as at-risk this term.";
    intents["who_is_absent"]    = "No chronic absentees detected this term.";
  }

  if (snap.consecutiveAbsences.length > 0) {
    const top = snap.consecutiveAbsences[0];
    intents["consecutive_absent"] = `${top.name} has been absent ${top.days} days in a row — follow up today.`;
    intents["absent_streak"] = snap.consecutiveAbsences
      .map(s => `${s.name} (${s.days} consecutive days)`)
      .join(", ");
  } else {
    intents["consecutive_absent"] = "No students with consecutive absences in the last 5 days.";
    intents["absent_streak"] = "No consecutive absence patterns detected.";
  }

  const behind = snap.currStats.filter(s => s.total > 0 && (s.covered / s.total) < 0.5);
  if (behind.length > 0) {
    const b = behind[0];
    intents["am_i_behind"]       = `${b.subject} is at ${Math.round((b.covered/b.total)*100)}% coverage — behind schedule.`;
    intents["curriculum_status"] = behind.map(s => `${s.subject}: ${Math.round((s.covered/s.total)*100)}%`).join(", ") + " — needs attention.";
  } else {
    intents["am_i_behind"]       = "Curriculum coverage looks on track across your subjects.";
    intents["curriculum_status"] = "All subjects on track.";
  }

  if (snap.credits !== null) {
    intents["how_many_credits"] = `You have ${snap.credits} credit${snap.credits === 1 ? "" : "s"} remaining.`;
    intents["credits_status"]   = snap.credits <= 3 ? `Only ${snap.credits} credits left — top up soon.` : `${snap.credits} credits available.`;
  }

  if (snap.tpadDays !== null) {
    intents["tpad_status"] = snap.tpadDays <= 0
      ? "TPAD self-appraisal is overdue — submit immediately."
      : snap.tpadDays <= 7
      ? `TPAD due in ${snap.tpadDays} day${snap.tpadDays === 1 ? "" : "s"} — don't delay.`
      : `TPAD due in ${snap.tpadDays} days.`;
  }

  if (snap.todaySlots.length > 0) {
    const seen = new Set<string>();
    const classes: string[] = [];
    for (const s of snap.todaySlots) {
      if (!seen.has(s.class_id)) { seen.add(s.class_id); classes.push(`${s.class_name} (${s.subject})`); }
    }
    intents["what_do_i_have_today"] = `Today — ${today}: ${classes.join(", ")}.`;
    intents["my_schedule"]          = intents["what_do_i_have_today"];
  } else {
    intents["what_do_i_have_today"] = `No classes scheduled for today — ${today}.`;
    intents["my_schedule"]          = intents["what_do_i_have_today"];
  }

  if (snap.missedLessonPlans.length > 0) {
    const missing = snap.missedLessonPlans.map(p => `${p.className} (${p.subject})`).join(", ");
    intents["missed_plans"]       = `No lesson plan filed this week for: ${missing}.`;
    intents["lesson_plan_status"] = intents["missed_plans"];
  } else {
    intents["missed_plans"]       = "All today's classes have lesson plans filed this week.";
    intents["lesson_plan_status"] = intents["missed_plans"];
  }

  if (snap.streak >= 3) intents["my_streak"] = `You are on a ${snap.streak}-day attendance streak. Keep it going.`;
  intents["term_progress"] = `The term is ${Math.round(snap.termProgressPct)}% complete.`;

  if (snap.unreadMessages > 0) {
    intents["unread_messages"] = `You have ${snap.unreadMessages} unread message thread${snap.unreadMessages === 1 ? "" : "s"} in VibeConnect.`;
  } else {
    intents["unread_messages"] = "No unread messages in VibeConnect.";
  }

  if (snap.homeworkDue && snap.homeworkDue.length > 0) {
    const next = snap.homeworkDue[0];
    intents["homework_due"] = `Next homework due: "${next.title}" (${next.subject}) on ${new Date(next.due_date).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" })}.`;
  } else {
    intents["homework_due"] = "No homework due in the next 7 days.";
  }

  // Students overview — combines all student signals
  const studentParts: string[] = [];
  if (snap.consecutiveAbsences.length > 0) {
    studentParts.push(`Absent right now: ${snap.consecutiveAbsences.map(s => `${s.name} (${s.days} days in a row)`).join(", ")}.`);
  }
  if (snap.atRisk.length > 0) {
    studentParts.push(`At-risk this term: ${snap.atRisk.map(s => s.name).join(", ")}.`);
  }
  if (snap.homeworkDue.length > 0) {
    studentParts.push(`Homework due soon: ${snap.homeworkDue.map(h => h.title).join(", ")}.`);
  }
  if (studentParts.length > 0) {
    intents["students_overview"] = studentParts.join(" ");
  } else {
    intents["students_overview"] = "No student issues flagged right now.";
  }
  intents["how_many_students"] = snap.todaySlots.length > 0
    ? `You have classes with ${Array.from(new Set(snap.todaySlots.map((s: any) => s.class_name))).join(", ")} today.`
    : "No classes today.";
  intents["student_performance"] = snap.currStats.length > 0
    ? snap.currStats.map(s => `${s.subject}: ${Math.round((s.covered/s.total)*100)}% curriculum covered`).join(", ") + "."
    : "No curriculum data available.";
  intents["who_needs_help"] = snap.consecutiveAbsences.length > 0
    ? `Follow up with: ${snap.consecutiveAbsences.map(s => s.name).join(", ")} — absent multiple days in a row.`
    : snap.atRisk.length > 0
    ? `Keep an eye on: ${snap.atRisk.map(s => s.name).join(", ")}.`
    : "No students flagged as needing urgent follow-up.";

  return intents;
}

export function resolveIntent(query: string, brain: TwinBrainState): string | null {
  const q = query.toLowerCase().trim();
  const matchers: [RegExp, string][] = [
    [/attend|mark|submit|roll call/,                     "attendance_status"],
    [/pending|not done|haven.t marked/,                  "what_is_pending"],
    [/have i marked|did i mark/,                         "have_i_marked"],
    [/at.risk|absentee|concern/,                         "at_risk_students"],
    [/who.*absent|frequent/,                             "who_is_absent"],
    [/worried about|student concern/,                    "student_concerns"],
    [/absent.*days|days.*absent|missing.*row|row.*miss/, "consecutive_absent"],
    [/absent.*streak|consecutive/,                       "absent_streak"],
    [/behind|coverage|curriculum|strand|scheme/,         "am_i_behind"],
    [/curriculum status|subject status/,                 "curriculum_status"],
    [/credit|balance|how many credit/,                   "how_many_credits"],
    [/credit.*low|running out/,                          "credits_status"],
    [/tpad|appraisal|deadline/,                          "tpad_status"],
    [/today|schedule|what.*have|my class/,               "what_do_i_have_today"],
    [/streak|consistent|days in a row/,                  "my_streak"],
    [/term.*progress|how far.*term/,                     "term_progress"],
    [/message|unread|vibeconnect|inbox/,                 "unread_messages"],
    [/homework|due|assignment/,                          "homework_due"],
    [/lesson plan|no plan|plan.*today|filed/,            "missed_plans"],
    [/^students?$|my students|tell me.*students|students overview/, "students_overview"],
    [/how many students|class size|how many kids/,       "how_many_students"],
    [/student.*perform|class.*perform|how.*class doing/, "student_performance"],
    [/who needs help|who.*struggle|follow up|check on/,  "who_needs_help"],
    [/absent.*days|days.*absent|missing.*row/,           "consecutive_absent"],
    [/absent.*streak|consecutive/,                       "absent_streak"],
  ];
  for (const [pattern, key] of matchers) {
    if (pattern.test(q) && brain.intents[key]) return brain.intents[key];
  }
  return null;
}

function loadCached(userId: string): TwinBrainState | null {
  try {
    const raw = localStorage.getItem(`${BRAIN_KEY}_${userId}`);
    if (!raw) return null;
    const cached: TwinBrainState = JSON.parse(raw);
    cached.isStale = Date.now() - cached.loadedAt > BRAIN_TTL;
    return cached;
  } catch { return null; }
}

function saveCache(brain: TwinBrainState) {
  try { localStorage.setItem(`${BRAIN_KEY}_${brain.userId}`, JSON.stringify({ ...brain, isStale: false })); } catch {}
}

export async function loadTwinBrain(userId: string): Promise<TwinBrainState> {
  const cached = loadCached(userId);
  if (cached && !cached.isStale) {
    try {
      const { data: memRows } = await supabase
        .from("twin_memory")
        .select("type, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (memRows && memRows.length > (cached.recentMemory?.length ?? 0)) {
        const updated = { ...cached, recentMemory: memRows.reverse() };
        saveCache(updated);
        return updated;
      }
    } catch {}
    return cached;
  }

  const [profileRes, memberRes, teacherRes] = await Promise.all([
    supabase.from("profiles").select("full_name, school_id").eq("id", userId).single(),
    supabase.from("school_members").select("school_id").eq("profile_id", userId).maybeSingle(),
    supabase.from("teacher_profiles").select("school_id").eq("profile_id", userId).maybeSingle(),
  ]);
  const fullName  = profileRes.data?.full_name ?? "Teacher";
  const firstName = fullName.split(" ")[0];
  const schoolId  =
    memberRes.data?.school_id ??
    teacherRes.data?.school_id ??
    profileRes.data?.school_id ??
    "";
  const schoolRes  = schoolId ? await supabase.from("schools").select("name").eq("id", schoolId).single() : { data: null };
  const schoolName = schoolRes.data?.name ?? "Independent";

  let recentMemory: { type: string; content: string; created_at: string }[] = [];
  try {
    const { data: memRows } = await supabase
      .from("twin_memory")
      .select("type, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    recentMemory = (memRows ?? []).reverse();
  } catch { recentMemory = cached?.recentMemory ?? []; }

  let snap: PulseSnapshot | null = null;
  try {
    if (schoolId) {
      const credRes = await supabase.rpc("get_credit_balance", { p_teacher_id: userId });
      const credits = credRes.data?.success ? (credRes.data.balance ?? null) : null;
      snap = await fetchPulseData(userId, schoolId, credits);
    }
  } catch { snap = cached?.snap ?? null; }

  const rulesOutput  = snap ? runRules(snap) : null;
  const intents      = buildIntents(snap, firstName);
  const fingerprint  = loadFingerprint(userId);

  const brain: TwinBrainState = {
    userId, schoolId, fullName, firstName, schoolName,
    snap, rulesOutput, intents, fingerprint, recentMemory,
    loadedAt: Date.now(), isStale: false,
  };
  saveCache(brain);
  return brain;
}

export function buildContextString(brain: TwinBrainState): string {
  const { snap, fingerprint, rulesOutput, fullName, schoolName } = brain;
  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const lines: (string | null)[] = [
    `Teacher: ${fullName}`, `School: ${schoolName}`, `Today: ${today}`,
    snap ? `Term progress: ${Math.round(snap.termProgressPct)}% complete` : null,
    snap?.credits !== null && snap?.credits !== undefined ? `Credits remaining: ${snap.credits}` : null,
    snap?.streak && snap.streak >= 3 ? `Attendance streak: ${snap.streak} days` : null,
    rulesOutput ? `Current priority: ${rulesOutput.priority} — ${rulesOutput.message}` : null,
    "",
  ];

  if (snap && snap.todaySlots.length > 0) {
    const pendingIds = new Set(snap.attPending.map(c => c.class_id));
    const seen = new Set<string>();
    const classLines: string[] = [];
    for (const slot of snap.todaySlots) {
      if (seen.has(slot.class_id)) continue;
      seen.add(slot.class_id);
      const att  = pendingIds.has(slot.class_id) ? "NOT SUBMITTED" : "Submitted";
      const curr = snap.currStats.find(c => c.classId === slot.class_id);
      const cov  = curr && curr.total > 0 ? `${curr.covered}/${curr.total} (${Math.round((curr.covered/curr.total)*100)}%)` : "No data";
      const plan = snap.missedLessonPlans.find(p => p.class_id === slot.class_id && p.subject_id === slot.subject_id);
      const planStatus = plan ? "NO PLAN" : "Plan filed";
      classLines.push(`- ${slot.class_name}, ${slot.subject} | Att: ${att} | Coverage: ${cov} | Plan: ${planStatus}`);
    }
    lines.push(`Classes today:\n${classLines.join("\n")}`);
  } else { lines.push("No classes today."); }

  if (snap && snap.atRisk.length > 0) {
    lines.push(`\nAt-risk:\n${snap.atRisk.map(s => `  • ${s.name} — ${s.reason}`).join("\n")}`);
  }
  if (snap && snap.consecutiveAbsences.length > 0) {
    lines.push(`\nConsecutive absences:\n${snap.consecutiveAbsences.map(s => `  • ${s.name} — ${s.days} days in a row`).join("\n")}`);
  }
  if (snap?.tpadDays !== null && snap?.tpadDays !== undefined && snap.tpadDays <= 14) {
    lines.push(`\nTPAD due in ${snap.tpadDays} day${snap.tpadDays === 1 ? "" : "s"}.`);
  }
  if (fingerprint.weakSubjects.length > 0) lines.push(`\nWeak subjects: ${fingerprint.weakSubjects.join(", ")}`);
  if (fingerprint.studentsCaredAbout.length > 0) lines.push(`Teacher focuses on: ${fingerprint.studentsCaredAbout.join(", ")}`);
  if (fingerprint.lastConcern) lines.push(`Last concern: "${fingerprint.lastConcern}"`);
  lines.push(`Twin interactions: ${fingerprint.totalQueries}`);

  if (snap?.unreadMessages && snap.unreadMessages > 0) {
    lines.push(`\nUnread VibeConnect messages: ${snap.unreadMessages} thread${snap.unreadMessages === 1 ? "" : "s"} waiting.`);
  }
  if (snap?.homeworkDue && snap.homeworkDue.length > 0) {
    const hwLines = snap.homeworkDue
      .map((h: { title: string; subject: string; due_date: string }) =>
        `  • ${h.title} (${h.subject}) — due ${new Date(h.due_date).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}`
      ).join("\n");
    lines.push(`\nHomework due this week:\n${hwLines}`);
  }

  const { recentMemory } = brain;
  if (recentMemory && recentMemory.length > 0) {
    const memLines = recentMemory
      .filter(m => m.type === "teacher_query" || m.type === "teacher_reply")
      .map(m => `  [${m.type === "teacher_query" ? "Teacher" : "Twin"}]: ${m.content}`)
      .join("\n");
    if (memLines) lines.push(`\nRecent conversation history:\n${memLines}`);
  }

  return lines.filter(Boolean).join("\n");
}
