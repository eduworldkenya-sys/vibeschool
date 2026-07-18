// lib/twin/brain.ts
import { supabase } from "@/lib/supabase";
import { fetchPulseData } from "@/lib/pulse/fetcher";
import { runRules } from "@/lib/pulse/rules";
import { TWIN_REGISTRY } from "@/lib/twin/registry";
import { fuzzyMatch } from "@/lib/twin/fuzzy";
import { TwinReply, TwinAction, TwinRegistryEntry } from "@/lib/types";
import type { PulseSnapshot } from "@/lib/types";
import { nairobiDateStr } from "@/lib/time";

const BRAIN_KEY     = "vibe_twin_brain_v2";
const BRAIN_TTL     = 30 * 60 * 1000;
const CACHE_MAX_BYTES = 200_000;
const CONTEXT_TOKEN_LIMIT = 1800;

export const CURRICULUM_WEAK_THRESHOLD   = 0.4;
export const CURRICULUM_STRONG_THRESHOLD = 0.7;
export const CURRICULUM_BEHIND_THRESHOLD = 0.5;

export interface TeacherFingerprint {
  peakHour:            number;
  peakHourSamples:     number[];
  weakSubjects:        string[];
  strongSubjects:      string[];
  studentsCaredAbout:  string[];
  consistencyScore:    number;
  lastConcern:         string;
  totalQueries:        number;
  joinedAt:            string;
  queryTopics:         Record<string, number>;
  lessonsPrepped:      number;
  lastActiveDate:      string;
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
  recentLessons: { title: string; topic: string; class_name: string; created_at: string; status: string }[];
  loadedAt:      number;
  isStale:       boolean;
}

function defaultFingerprint(): TeacherFingerprint {
  return {
    peakHour: 8, peakHourSamples: [],
    weakSubjects: [], strongSubjects: [],
    studentsCaredAbout: [], consistencyScore: 100,
    lastConcern: "", totalQueries: 0,
    joinedAt: new Date().toISOString(),
    queryTopics: {}, lessonsPrepped: 0,
    lastActiveDate: new Date().toISOString().split("T")[0],
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
  fp.lastConcern    = query.slice(0, 100);
  fp.lastActiveDate = new Date().toISOString().split("T")[0];

  const hour = new Date().getHours();
  fp.peakHourSamples = [...(fp.peakHourSamples ?? []), hour].slice(-20);
  const sum = fp.peakHourSamples.reduce((a, b) => a + b, 0);
  fp.peakHour = Math.round(sum / fp.peakHourSamples.length);

  fp.queryTopics = fp.queryTopics ?? {};
  const q = query.toLowerCase();
  if (q.includes("attendance"))                            fp.queryTopics["attendance"]  = (fp.queryTopics["attendance"]  ?? 0) + 1;
  if (q.includes("curriculum") || q.includes("coverage")) fp.queryTopics["curriculum"]  = (fp.queryTopics["curriculum"]  ?? 0) + 1;
  if (q.includes("student"))                              fp.queryTopics["students"]    = (fp.queryTopics["students"]    ?? 0) + 1;
  if (q.includes("tpad"))                                 fp.queryTopics["tpad"]        = (fp.queryTopics["tpad"]        ?? 0) + 1;
  if (q.includes("homework"))                             fp.queryTopics["homework"]    = (fp.queryTopics["homework"]    ?? 0) + 1;
  if (q.includes("lesson plan"))                          fp.queryTopics["lesson_plan"] = (fp.queryTopics["lesson_plan"] ?? 0) + 1;

  const names = (brain.snap?.atRisk ?? []).map(s => s.name);
  for (const name of names) {
    const wb = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (wb.test(query) && !fp.studentsCaredAbout.includes(name)) {
      fp.studentsCaredAbout = [name, ...fp.studentsCaredAbout].slice(0, 10);
    }
  }

  const stats = brain.snap?.currStats ?? [];
  fp.weakSubjects   = stats.filter(s => s.total > 0 && (s.covered / s.total) < CURRICULUM_WEAK_THRESHOLD).map(s => s.subject);
  fp.strongSubjects = stats.filter(s => s.total > 0 && (s.covered / s.total) >= CURRICULUM_STRONG_THRESHOLD).map(s => s.subject);
  fp.consistencyScore = Math.min(100, (brain.snap?.streak ?? 0) * 10 + 50);
  if (brain.snap?.missedLessonPlans?.length === 0) fp.lessonsPrepped = (fp.lessonsPrepped ?? 0) + 1;

  saveFingerprint(userId, fp);
  return fp;
}

function creditBurnForecast(snap: PulseSnapshot): string | null {
  if (snap.credits === null || snap.credits === undefined) return null;
  if (snap.termProgressPct <= 0) return null;
  const used = Math.max(0, 20 - snap.credits);
  if (used === 0) return null;
  const daysUsed = (snap.termProgressPct / 100) * 90;
  const burnRate = used / daysUsed;
  const daysLeft = ((100 - snap.termProgressPct) / 100) * 90;
  const projectedBalance = snap.credits - (burnRate * daysLeft);
  if (projectedBalance < 0) {
    const d = Math.round(snap.credits / burnRate);
    return `At current usage you may run out of credits in ~${d} day${d === 1 ? "" : "s"} — top up before end of term.`;
  }
  if (snap.credits <= 5) return `Only ${snap.credits} credits left and the term is ${Math.round(snap.termProgressPct)}% done — top up soon.`;
  return null;
}

function streakWarning(snap: PulseSnapshot): string | null {
  if (!snap.streak || snap.streak < 3 || snap.attPending.length === 0) return null;
  if (new Date().getHours() >= 14)
    return `⚠ You have a ${snap.streak}-day attendance streak — mark today's classes before the day ends or it resets.`;
  return null;
}

function timeOfDayContext(snap: PulseSnapshot | null): string {
  const hour = new Date().getHours();
  if (!snap) return "";
  if (hour < 8) {
    const slots = snap.todaySlots;
    if (slots.length > 0) {
      const first = slots[0];
      const hasPlan = !snap.missedLessonPlans.find((p: any) => p.class_id === first.class_id);
      return hasPlan
        ? `Early start. Your first class is ${first.class_name} (${first.subject}) — plan is filed.`
        : `Early start. Your first class is ${first.class_name} (${first.subject}) — no plan filed yet.`;
    }
    return "Early start. No classes today.";
  }
  if (hour < 12) {
    return snap.attPending.length > 0
      ? `Morning. Attendance still pending for: ${snap.attPending.map((c: any) => c.class_name).join(", ")}.`
      : "Morning. Attendance submitted — focus on teaching.";
  }
  if (hour < 14) {
    const behind = snap.currStats.filter((s: any) => s.total > 0 && (s.covered / s.total) < CURRICULUM_BEHIND_THRESHOLD);
    return behind.length > 0
      ? `Afternoon. ${behind[0].subject} is behind — afternoon session is a good time to accelerate.`
      : "Afternoon. Curriculum on track.";
  }
  if (hour < 17) {
    if (snap.attPending.length > 0)
      return `Late afternoon. Still need to mark attendance for: ${snap.attPending.map((c: any) => c.class_name).join(", ")} — do it before you leave.`;
    if (snap.streak >= 3) return `Late afternoon. Day almost done — ${snap.streak}-day streak intact.`;
    return "Late afternoon. Classes almost done for the day.";
  }
  return "Day done. A few notes now saves an hour tomorrow.";
}

function buildIntents(snap: PulseSnapshot | null, name: string): Record<string, string> {
  if (!snap) return {};
  const intents: Record<string, string> = {};
  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", month: "long", day: "numeric" });

  if (snap.attPending.length > 0) {
    const names = snap.attPending.map((c: any) => c.class_name).join(", ");
    intents["attendance_status"] = `${names} — attendance not yet submitted today.`;
    intents["what_is_pending"]   = `You still need to mark attendance for: ${names}.`;
    intents["have_i_marked"]     = `Not yet. ${names} still pending.`;
  } else {
    intents["attendance_status"] = "All attendance submitted for today. Well done.";
    intents["have_i_marked"]     = "Yes — all classes marked today.";
    intents["what_is_pending"]   = "Nothing pending — all attendance submitted.";
  }

  if (snap.atRisk.length > 0) {
    const list = snap.atRisk.map((s: any) => `${s.name} (${s.reason})`).join(", ");
    intents["at_risk_students"] = `Students needing attention: ${list}.`;
    intents["who_is_absent"]    = `Frequent absentees this term: ${list}.`;
    intents["student_concerns"] = `${snap.atRisk[0].name} is your most at-risk student — ${snap.atRisk[0].reason}.`;
  } else {
    intents["at_risk_students"] = "No students flagged as at-risk this term.";
    intents["who_is_absent"]    = "No chronic absentees detected this term.";
    intents["student_concerns"] = "No specific student concerns right now.";
  }

  if (snap.consecutiveAbsences.length > 0) {
    const top = snap.consecutiveAbsences[0];
    intents["consecutive_absent"] = `${top.name} has been absent ${top.days} days in a row — follow up today.`;
    intents["absent_streak"] = snap.consecutiveAbsences.map((s: any) => `${s.name} (${s.days} consecutive days)`).join(", ");
  } else {
    intents["consecutive_absent"] = "No students with consecutive absences in the last 5 days.";
    intents["absent_streak"] = "No consecutive absence patterns detected.";
  }

  const behind = snap.currStats.filter((s: any) => s.total > 0 && (s.covered / s.total) < CURRICULUM_BEHIND_THRESHOLD);
  if (behind.length > 0) {
    const b = behind[0];
    intents["am_i_behind"]       = `${b.subject} is at ${Math.round((b.covered/b.total)*100)}% coverage — behind schedule.`;
    intents["curriculum_status"] = behind.map((s: any) => `${s.subject}: ${Math.round((s.covered/s.total)*100)}%`).join(", ") + " — needs attention.";
  } else {
    intents["am_i_behind"]       = "Curriculum coverage looks on track across your subjects.";
    intents["curriculum_status"] = "All subjects on track.";
  }

  if (snap.credits !== null) {
    const forecast = creditBurnForecast(snap);
    intents["how_many_credits"] = `You have ${snap.credits} credit${snap.credits === 1 ? "" : "s"} remaining.`;
    intents["credits_status"] = snap.credits <= 3
      ? `Only ${snap.credits} credits left — top up soon.${forecast ? " " + forecast : ""}`
      : `${snap.credits} credits available.${forecast ? " " + forecast : ""}`;
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
    const missing = snap.missedLessonPlans.map((p: any) => `${p.className} (${p.subject})`).join(", ");
    intents["missed_plans"]       = `No lesson plan filed this week for: ${missing}.`;
    intents["lesson_plan_status"] = intents["missed_plans"];
  } else {
    intents["missed_plans"]       = "All today's classes have lesson plans filed this week.";
    intents["lesson_plan_status"] = intents["missed_plans"];
  }

  if (snap.streak >= 3) {
    intents["my_streak"] = streakWarning(snap) ?? `You are on a ${snap.streak}-day attendance streak. Keep it going.`;
  } else {
    intents["my_streak"] = snap.streak > 0 ? `${snap.streak}-day attendance streak. Build on it.` : "No active streak. Start one today by marking attendance.";
  }

  intents["term_progress"] = `The term is ${Math.round(snap.termProgressPct)}% complete.`;

  intents["unread_messages"] = snap.unreadMessages > 0
    ? `You have ${snap.unreadMessages} unread message thread${snap.unreadMessages === 1 ? "" : "s"} in VibeConnect.`
    : "No unread messages in VibeConnect.";

  if (snap.homeworkDue?.length > 0) {
    const next = snap.homeworkDue[0];
    intents["homework_due"] = `Next homework due: "${next.title}" (${next.subject}) on ${new Date(next.due_date).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" })}.`;
  } else {
    intents["homework_due"] = "No homework due in the next 7 days.";
  }

  if (snap.homeworkUngraded?.length > 0) {
    const totalUngraded = snap.homeworkUngraded.reduce((sum: number, h: any) => sum + h.count, 0);
    const top = snap.homeworkUngraded[0];
    intents["homework_grading"] = snap.homeworkUngraded.length === 1
      ? `"${top.title}" has ${top.count} submission${top.count === 1 ? "" : "s"} waiting to be graded.`
      : `${totalUngraded} homework submission${totalUngraded === 1 ? "" : "s"} across ${snap.homeworkUngraded.length} assignments are waiting to be graded. "${top.title}" has the most, with ${top.count}.`;
  } else {
    intents["homework_grading"] = "Nothing waiting to be graded right now.";
  }

  const studentParts: string[] = [];
  if (snap.consecutiveAbsences.length > 0) studentParts.push(`Absent right now: ${snap.consecutiveAbsences.map((s: any) => `${s.name} (${s.days} days in a row)`).join(", ")}.`);
  if (snap.atRisk.length > 0) studentParts.push(`At-risk this term: ${snap.atRisk.map((s: any) => s.name).join(", ")}.`);
  if (snap.homeworkDue.length > 0) studentParts.push(`Homework due soon: ${snap.homeworkDue.map((h: any) => h.title).join(", ")}.`);
  intents["students_overview"] = studentParts.length > 0 ? studentParts.join(" ") : "No student issues flagged right now.";

  intents["how_many_students"] = snap.todaySlots.length > 0
    ? `You have classes with ${Array.from(new Set(snap.todaySlots.map((s: any) => s.class_name))).join(", ")} today.`
    : "No classes today.";

  intents["student_performance"] = snap.currStats.length > 0
    ? snap.currStats.map((s: any) => `${s.subject}: ${Math.round((s.covered/s.total)*100)}% curriculum covered`).join(", ") + "."
    : "No curriculum data available.";

  intents["who_needs_help"] = snap.consecutiveAbsences.length > 0
    ? `Follow up with: ${snap.consecutiveAbsences.map((s: any) => s.name).join(", ")} — absent multiple days in a row.`
    : snap.atRisk.length > 0
    ? `Keep an eye on: ${snap.atRisk.map((s: any) => s.name).join(", ")}.`
    : "No students flagged as needing urgent follow-up.";

  intents["time_context"] = timeOfDayContext(snap);

  return intents;
}

const SCORED_MATCHERS: [RegExp, string, number][] = [
  [/\bhave i marked\b|\bdid i mark\b/,                        "have_i_marked",        10],
  [/\bpending\b|\bnot done\b|\bhaven.t marked\b/,             "what_is_pending",       8],
  [/\battend|\bmark\b|\bsubmit\b|\broll call\b|\bregister\b/, "attendance_status",     7],
  [/\bat.risk\b|\babsentee\b|\bconcern\b/,                    "at_risk_students",      9],
  [/\bwho.*absent\b|\bfrequent\b/,                            "who_is_absent",         8],
  [/\bworried about\b|\bstudent concern\b/,                   "student_concerns",      9],
  [/\babsent.*days\b|\bdays.*absent\b|\bmissing.*row\b/,      "consecutive_absent",    9],
  [/\babsent.*streak\b|\bconsecutive\b/,                      "absent_streak",         8],
  [/\bbehind\b|\bcoverage\b|\bcurriculum\b|\bstrand\b|\bscheme\b|\bsyllabus\b/, "am_i_behind", 7],
  [/\bcurriculum status\b|\bsubject status\b/,                "curriculum_status",     9],
  [/\bhow many credits\b|\bcredit balance\b/,                 "how_many_credits",     10],
  [/\bcredit\b|\bbalance\b/,                                  "how_many_credits",      6],
  [/\bcredit.*low\b|\brunning out\b|\blow.*credit\b/,         "credits_status",        9],
  [/\btpad\b|\bappraisal\b/,                                  "tpad_status",           9],
  [/\bwhat do i have\b|\bmy class today\b|\bclasses today\b|\bteaching today\b/, "what_do_i_have_today", 10],
  [/\btoday\b|\bschedule\b|\btimetable\b/,                    "what_do_i_have_today",  5],
  [/\bmy schedule\b|\bmy timetable\b/,                        "my_schedule",           9],
  [/\bstreak\b|\bconsistent\b|\bdays in a row\b/,             "my_streak",             8],
  [/\bterm.*progress\b|\bhow far.*term\b|\bterm.*left\b/,     "term_progress",         9],
  [/\bmessage\b|\bunread\b|\bvibeconnect\b|\binbox\b/,        "unread_messages",       8],
  [/\bhomework\b|\bdue\b|\bassignment\b/,                     "homework_due",          7],
  [/\bgrade\b|\bgrading\b|\bmark.*homework\b|\bungraded\b|\bto grade\b/, "homework_grading",  8],
  [/\blesson plan\b|\bno plan\b|\bplan.*today\b|\bfiled\b/,   "missed_plans",          8],
  [/\bhow many students\b|\bclass size\b|\bhow many kids\b/,  "how_many_students",     9],
  [/\bstudent.*perform\b|\bclass.*perform\b|\bhow.*class doing\b/, "student_performance", 9],
  [/\bwho needs help\b|\bwho.*struggle\b|\bfollow up\b|\bcheck on\b/, "who_needs_help", 8],
  [/\bmy students\b|\bstudents overview\b|\btell me.*students\b/, "students_overview", 7],
];

interface ScoredMatch { key: string; score: number; text: string }

function matchAllIntents(query: string, brain: TwinBrainState): ScoredMatch[] {
  const q = query.toLowerCase().trim();
  const scoreMap: Record<string, number> = {};
  for (const [pattern, key, weight] of SCORED_MATCHERS) {
    if (pattern.test(q) && brain.intents[key]) {
      scoreMap[key] = Math.max(scoreMap[key] ?? 0, weight);
    }
  }
  return Object.entries(scoreMap)
    .sort((a, b) => b[1] - a[1])
    .map(([key, score]) => ({ key, score, text: brain.intents[key] }));
}

export function resolveIntent(query: string, brain: TwinBrainState): string | null {
  const matches = matchAllIntents(query, brain);
  return matches.length > 0 ? matches[0].text : null;
}

function scheduleActions(brain: TwinBrainState): TwinAction[] {
  const snap = brain.snap;
  if (!snap || snap.todaySlots.length === 0) return [];
  const seen = new Set<string>();
  const actions: TwinAction[] = [];
  const today = nairobiDateStr();
  for (const slot of snap.todaySlots as any[]) {
    if (seen.has(slot.id)) continue;
    seen.add(slot.id);
    actions.push({
      label: `${slot.class_name} · ${slot.subject}`,
      route:
        `/teacher/attendance?mode=lesson` +
        `&classId=${encodeURIComponent(slot.class_id)}` +
        `&timetableSlotId=${encodeURIComponent(slot.id)}` +
        `&date=${encodeURIComponent(today)}`,
    });
  }
  return actions;
}

function replyFromEntry(entry: TwinRegistryEntry, brain: TwinBrainState): TwinReply {
  if (entry.type === "navigate" && entry.route) {
    return { text: `Opening ${entry.label}…`, actions: [{ label: `Open ${entry.label}`, route: entry.route }], source: "nav" };
  }
  const text = brain.intents[entry.id] ?? `${entry.label} — no data available right now.`;
  return { text, source: "js" };
}

export function resolveTwinReply(rawQuery: string, brain: TwinBrainState): TwinReply | null {
  const query = rawQuery.toLowerCase().trim();
  const allMatches = matchAllIntents(query, brain);

  if (allMatches.length > 0) {
    if (allMatches.length >= 2) {
      const combined = allMatches.slice(0, 3).map(m => m.text).join("\n\n");
      const isSchedule = allMatches.some(m => m.key === "what_do_i_have_today" || m.key === "my_schedule");
      return { text: combined, actions: isSchedule ? scheduleActions(brain) : undefined, source: "js" };
    }
    const top = allMatches[0];
    const actions = (top.key === "what_do_i_have_today" || top.key === "my_schedule") ? scheduleActions(brain) : undefined;
    return { text: top.text, actions, source: "js" };
  }

  const exact = TWIN_REGISTRY.find(e => e.keywords.some(k => k.toLowerCase() === query));
  if (exact) return replyFromEntry(exact, brain);

  if (brain.snap) {
    const allStudents = [
      ...(brain.snap.atRisk ?? []).map((s: any) => ({ name: s.name, detail: s.reason })),
      ...(brain.snap.consecutiveAbsences ?? []).map((s: any) => ({ name: s.name, detail: `absent ${s.days} days in a row` })),
    ];
    for (const student of allStudents) {
      const wb = new RegExp(`\\b${student.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (wb.test(rawQuery)) return { text: `${student.name}: ${student.detail}.`, source: "js" };
    }
  }

  const fuzzy = fuzzyMatch(query, TWIN_REGISTRY);
  if (fuzzy.kind === "confident") return replyFromEntry(fuzzy.entry, brain);
  if (fuzzy.kind === "ambiguous") {
    return { text: "Did you mean:", actions: fuzzy.candidates.map(c => ({ label: c.entry.label, resolveQuery: c.entry.keywords[0] })), source: "fuzzy" };
  }

  return null;
}

export function buildOpeningBrief(brain: TwinBrainState): string {
  const { snap, rulesOutput, firstName } = brain;
  if (!snap) return `Ready, ${firstName}. Ask me anything.`;

  const parts: string[] = [];
  const todayCount = Array.from(new Set(snap.todaySlots.map((s: any) => s.class_id))).length;
  if (todayCount > 0) {
    const pendingCount = snap.attPending.length;
    const planMissing  = snap.missedLessonPlans.length;
    parts.push(
      `${todayCount} class${todayCount === 1 ? "" : "es"} today` +
      (pendingCount > 0 ? `, ${pendingCount} attendance pending` : ", all attendance done") +
      (planMissing  > 0 ? `, ${planMissing} plan${planMissing === 1 ? "" : "s"} not filed` : "")
    );
  } else {
    parts.push("No classes today");
  }

  if (rulesOutput && rulesOutput.priority !== "calm") parts.push(rulesOutput.message);

  if (snap.consecutiveAbsences.length > 0) {
    const top = snap.consecutiveAbsences[0];
    parts.push(`${top.name} absent ${top.days} days in a row`);
  } else if (snap.atRisk.length > 0) {
    parts.push(`${snap.atRisk[0].name} — ${snap.atRisk[0].reason}`);
  }

  const creditLine = snap.credits !== null && snap.credits !== undefined
    ? snap.credits <= 3 ? ` · Only ${snap.credits} credits left.` : ` · ${snap.credits} credits.`
    : "";

  return `Ready, ${firstName}.${creditLine}\n${parts.join(" · ")}`;
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
  try {
    const serialised = JSON.stringify({ ...brain, isStale: false });
    if (serialised.length > CACHE_MAX_BYTES) {
      localStorage.setItem(`${BRAIN_KEY}_${brain.userId}`, JSON.stringify({ ...brain, recentMemory: [], isStale: false }));
    } else {
      localStorage.setItem(`${BRAIN_KEY}_${brain.userId}`, serialised);
    }
  } catch {}
}

export async function loadTwinBrain(userId: string): Promise<TwinBrainState> {
  const cached = loadCached(userId);
  if (cached && !cached.isStale) {
    try {
      const { data: memRows } = await supabase
        .from("twin_memory").select("type, content, created_at")
        .eq("profile_id", userId).order("created_at", { ascending: false }).limit(10);
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
  const fullName   = profileRes.data?.full_name ?? "Teacher";
  const firstName  = fullName.split(" ")[0];
  const schoolId   = memberRes.data?.school_id ?? teacherRes.data?.school_id ?? profileRes.data?.school_id ?? "";
  const schoolRes  = schoolId ? await supabase.from("schools").select("name").eq("id", schoolId).single() : { data: null };
  const schoolName = schoolRes.data?.name ?? "Independent";

  let recentMemory: { type: string; content: string; created_at: string }[] = [];
  try {
    const { data: memRows } = await supabase
      .from("twin_memory").select("type, content, created_at")
      .eq("profile_id", userId).order("created_at", { ascending: false }).limit(10);
    recentMemory = (memRows ?? []).reverse();
  } catch { recentMemory = cached?.recentMemory ?? []; }

  let recentLessons: { title: string; topic: string; class_name: string; created_at: string; status: string }[] = [];
  try {
    const { data: lessonRows } = await supabase
      .from("lesson_plans")
      .select("title,topic,created_at,status,classes(name,stream)")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);
    recentLessons = (lessonRows ?? []).map((h: any) => ({
      title: h.title ?? "Untitled",
      topic: h.topic ?? "",
      class_name: h.classes ? h.classes.name + (h.classes.stream ? " " + h.classes.stream : "") : "",
      created_at: h.created_at,
      status: h.status ?? "draft",
    }));
  } catch { recentLessons = cached?.recentLessons ?? []; }

  let snap: PulseSnapshot | null = null;
  try {
    if (schoolId) {
      const credRes = await supabase.rpc("get_credit_balance", { p_teacher_id: userId });
      const credits = credRes.data?.success ? (credRes.data.balance ?? null) : null;
      snap = await fetchPulseData(userId, schoolId, credits);
    }
  } catch { snap = cached?.snap ?? null; }

  const rulesOutput = snap ? runRules(snap) : null;
  const intents     = buildIntents(snap, firstName);
  const fingerprint = loadFingerprint(userId);

  const brain: TwinBrainState = {
    userId, schoolId, fullName, firstName, schoolName,
    snap, rulesOutput, intents, fingerprint, recentMemory, recentLessons,
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
    const pendingIds = new Set(snap.attPending.map((c: any) => c.class_id));
    const seen = new Set<string>();
    const classLines: string[] = [];
    for (const slot of snap.todaySlots) {
      if (seen.has(slot.class_id)) continue;
      seen.add(slot.class_id);
      const att  = pendingIds.has(slot.class_id) ? "NOT SUBMITTED" : "Submitted";
      const curr = snap.currStats.find((c: any) => c.classId === slot.class_id);
      const cov  = curr && curr.total > 0 ? `${curr.covered}/${curr.total} (${Math.round((curr.covered/curr.total)*100)}%)` : "No data";
      const plan = snap.missedLessonPlans.find((p: any) => p.class_id === slot.class_id && p.subject_id === slot.subject_id);
      classLines.push(`- ${slot.class_name}, ${slot.subject} | Att: ${att} | Coverage: ${cov} | Plan: ${plan ? "NO PLAN" : "Filed"}`);
    }
    lines.push(`Classes today:\n${classLines.join("\n")}`);
  } else {
    lines.push("No classes today.");
  }

  if (snap && snap.atRisk.length > 0)
    lines.push(`\nAt-risk:\n${snap.atRisk.map((s: any) => `  • ${s.name} — ${s.reason}`).join("\n")}`);
  if (snap && snap.consecutiveAbsences.length > 0)
    lines.push(`\nConsecutive absences:\n${snap.consecutiveAbsences.map((s: any) => `  • ${s.name} — ${s.days} days in a row`).join("\n")}`);
  if (snap?.tpadDays !== null && snap?.tpadDays !== undefined && snap.tpadDays <= 14)
    lines.push(`\nTPAD due in ${snap.tpadDays} day${snap.tpadDays === 1 ? "" : "s"}.`);
  if (fingerprint.weakSubjects.length > 0)
    lines.push(`\nWeak subjects: ${fingerprint.weakSubjects.join(", ")}`);
  if (fingerprint.studentsCaredAbout.length > 0)
    lines.push(`Teacher focuses on: ${fingerprint.studentsCaredAbout.join(", ")}`);
  if (fingerprint.lastConcern)
    lines.push(`Last concern: "${fingerprint.lastConcern}"`);
  lines.push(`Twin interactions: ${fingerprint.totalQueries}`);

  if (snap?.unreadMessages && snap.unreadMessages > 0)
    lines.push(`\nUnread VibeConnect messages: ${snap.unreadMessages} thread${snap.unreadMessages === 1 ? "" : "s"} waiting.`);

  if (snap && snap.homeworkDue?.length > 0) {
    const hwLines = snap.homeworkDue
      .map((h: { title: string; subject: string; due_date: string }) =>
        `  • ${h.title} (${h.subject}) — due ${new Date(h.due_date).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}`)
      .join("\n");
    lines.push(`\nHomework due this week:\n${hwLines}`);
  }

  if (snap && snap.homeworkUngraded?.length > 0) {
    const ungLines = snap.homeworkUngraded
      .map((h: { title: string; subject: string; count: number }) =>
        `  • ${h.title} (${h.subject}) — ${h.count} submission${h.count === 1 ? "" : "s"} pending`)
      .join("\n");
    lines.push(`\nHomework awaiting grading:\n${ungLines}`);
  }

  if (brain.recentLessons?.length > 0) {
    const lessonLines = brain.recentLessons
      .slice(0, 5)
      .map(l => `  • ${l.class_name || "Class"} — "${l.title}"${l.topic ? ` (${l.topic})` : ""} — ${l.status} — ${new Date(l.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`)
      .join("\n");
    lines.push(`\nRecently taught / planned lessons:\n${lessonLines}`);
  }

  const baseContext = lines.filter(Boolean).join("\n");
  const baseWords   = baseContext.split(/\s+/).length;

  if (brain.recentMemory?.length > 0 && baseWords < CONTEXT_TOKEN_LIMIT - 200) {
    const memLines = brain.recentMemory
      .filter(m => m.type === "teacher_query" || m.type === "teacher_reply")
      .map(m => `  [${m.type === "teacher_query" ? "Teacher" : "Twin"}]: ${m.content}`)
      .join("\n");
    if (memLines) {
      const combined = `${baseContext}\n\nRecent conversation history:\n${memLines}`;
      const words = combined.split(/\s+/);
      if (words.length > CONTEXT_TOKEN_LIMIT) return words.slice(0, CONTEXT_TOKEN_LIMIT).join(" ") + "\n[context trimmed]";
      return combined;
    }
  }

  return baseContext;
}

