// lib/twin/hq-brain.ts
// HQ Twin brain — platform admin intelligence layer

import { hqSupabase as supabase } from "@/lib/hq/supabase";
import { fuzzyMatch } from "@/lib/twin/fuzzy";
import { HQ_TWIN_REGISTRY as TWIN_REGISTRY } from "@/lib/twin/hq-registry";
import { TwinReply, TwinRegistryEntry } from "@/lib/types";

const HQ_BRAIN_KEY = "vibe_hq_brain_v1";
const HQ_BRAIN_TTL = 5 * 60 * 1000;

export interface HQSnapshot {
  totalSchools:     number;
  activeSchools:    number;
  totalTeachers:    number;
  draftCourses:     { id: string; title: string; domain: string; days: number }[];
  liveCourses:      number;
  flaggedContent:   { id: string; app: string; author: string; reason: string }[];
  pendingContent:   { id: string; app: string; title: string; type: string }[];
  lowCreditSchools: { id: string; name: string; credits: number }[];
  recentSignups:    number;
  platformHealth:   "healthy" | "warning" | "critical";
}

export interface HQBrainState {
  userId:    string;
  fullName:  string;
  firstName: string;
  snap:      HQSnapshot | null;
  intents:   Record<string, string>;
  loadedAt:  number;
  isStale:   boolean;
}

function loadCached(userId: string): HQBrainState | null {
  try {
    const raw = localStorage.getItem(`${HQ_BRAIN_KEY}_${userId}`);
    if (!raw) return null;
    const cached: HQBrainState = JSON.parse(raw);
    cached.isStale = Date.now() - cached.loadedAt > HQ_BRAIN_TTL;
    return cached;
  } catch { return null; }
}

function saveCache(brain: HQBrainState) {
  try { localStorage.setItem(`${HQ_BRAIN_KEY}_${brain.userId}`, JSON.stringify({ ...brain, isStale: false })); } catch {}
}

async function fetchHQSnapshot(): Promise<HQSnapshot> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 86400000
  ).toISOString()

  const [
    schoolsRes,
    teachersRes,
    coursesRes,
    signupsRes,
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("id, status"),

    supabase
      .from("teacher_profiles")
      .select("profile_id", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("courses")
      .select(
        "id, title, domain, status, created_at"
      ),

    supabase
      .from("profiles")
      .select("id", {
        count: "exact",
        head: true,
      })
      .gte("created_at", sevenDaysAgo),
  ])

  const schools = schoolsRes.data ?? []
  const courses = coursesRes.data ?? []
  const now = Date.now()

  const totalSchools = schools.length

  const activeSchools = schools.filter(
    school => school.status === "active"
  ).length

  const totalTeachers = teachersRes.count ?? 0
  const recentSignups = signupsRes.count ?? 0

  const draftCourses = courses
    .filter(course => course.status === "draft")
    .map(course => {
      const createdAt = course.created_at
        ? new Date(course.created_at).getTime()
        : now

      return {
        id: course.id,
        title: course.title,
        domain: course.domain,
        days: Math.max(
          0,
          Math.floor((now - createdAt) / 86400000)
        ),
      }
    })
    .slice(0, 5)

  const liveCourses = courses.filter(
    course => course.status === "published"
  ).length

  /*
   * These datasets are intentionally empty until their
   * authoritative tables are added to the live schema:
   *
   * - content_flags
   * - content_submissions
   * - school_credits
   */
  const flaggedContent: HQSnapshot["flaggedContent"] = []
  const pendingContent: HQSnapshot["pendingContent"] = []
  const lowCreditSchools: HQSnapshot["lowCreditSchools"] = []

  const platformHealth: HQSnapshot["platformHealth"] =
    draftCourses.length >= 5
      ? "warning"
      : "healthy"

  return {
    totalSchools,
    activeSchools,
    totalTeachers,
    draftCourses,
    liveCourses,
    flaggedContent,
    pendingContent,
    lowCreditSchools,
    recentSignups,
    platformHealth,
  }
}

function buildHQIntents(snap: HQSnapshot | null): Record<string, string> {
  if (!snap) return {};
  const i: Record<string, string> = {};

  i["platform_health"] = snap.platformHealth === "critical"
    ? `⚠️ Platform needs attention — ${snap.flaggedContent.length} flagged items unresolved.`
    : snap.platformHealth === "warning"
    ? `Platform has minor issues — ${snap.flaggedContent.length} flagged, ${snap.draftCourses.length} drafts stale.`
    : "Platform is healthy. No critical issues.";

  i["platform_summary"] =
    `${snap.activeSchools}/${snap.totalSchools} schools active · ${snap.liveCourses} courses live · ` +
    `${snap.flaggedContent.length} flagged · ${snap.pendingContent.length} pending review · ${snap.recentSignups} signups this week.`;

  i["school_count"]  = `${snap.totalSchools} schools on the platform, ${snap.activeSchools} active.`;
  i["school_status"] = snap.activeSchools < snap.totalSchools
    ? `${snap.totalSchools - snap.activeSchools} school${snap.totalSchools - snap.activeSchools === 1 ? "" : "s"} inactive.`
    : `All ${snap.totalSchools} schools are active.`;

  i["teacher_count"]  = `${snap.totalTeachers} teacher${snap.totalTeachers === 1 ? "" : "s"} registered.`;
  i["recent_signups"] = snap.recentSignups > 0
    ? `${snap.recentSignups} new profile${snap.recentSignups === 1 ? "" : "s"} in the last 7 days.`
    : "No new signups in the last 7 days.";

  i["course_status"]  = `${snap.liveCourses} course${snap.liveCourses === 1 ? "" : "s"} live, ${snap.draftCourses.length} in draft.`;
  i["draft_courses"]  = snap.draftCourses.length > 0
    ? `Drafts: ${snap.draftCourses.map(c => `${c.title} (${c.days}d old)`).join(", ")}.`
    : "No courses in draft.";

  i["flagged_content"]  = snap.flaggedContent.length > 0
    ? `${snap.flaggedContent.length} flagged: ${snap.flaggedContent.slice(0, 2).map(f => `${f.app} — ${f.reason}`).join("; ")}.`
    : "No flagged content.";
  i["pending_reviews"]  = snap.pendingContent.length > 0
    ? `${snap.pendingContent.length} pending: ${snap.pendingContent.slice(0, 3).map(p => `${p.app}: ${p.title}`).join(", ")}.`
    : "No content pending review.";
  i["moderation_status"] = snap.flaggedContent.length > 0 || snap.pendingContent.length > 0
    ? `${snap.flaggedContent.length} flagged, ${snap.pendingContent.length} pending review.`
    : "Moderation queue is clear.";

  i["low_credit_schools"] = snap.lowCreditSchools.length > 0
    ? `${snap.lowCreditSchools.length} school${snap.lowCreditSchools.length === 1 ? "" : "s"} low on credits: ${snap.lowCreditSchools.map(s => `${s.name} (${s.credits})`).join(", ")}.`
    : "No schools critically low on credits.";

  return i;
}

const HQ_MATCHERS: [RegExp, string, number][] = [
  [/\bplatform.*health\b|\bhow.*platform\b|\ball.*good\b|\beverything.*ok\b/, "platform_health",    10],
  [/\bsummary\b|\boverview\b|\bwhat.*going.*on\b|\bhow.*things\b/,            "platform_summary",    9],
  [/\bhow many school\b|\bschool.*count\b|\bnumber.*school\b/,                "school_count",        9],
  [/\bschool.*status\b|\bactive.*school\b|\binactive\b/,                      "school_status",       8],
  [/\bteacher.*count\b|\bhow many teacher\b|\bregistered.*teacher\b/,         "teacher_count",       9],
  [/\bsignup\b|\bnew user\b|\bnew.*profile\b|\brecent.*join\b/,               "recent_signups",      8],
  [/\bcourse.*status\b|\bhow many course\b|\blive.*course\b/,                 "course_status",       9],
  [/\bdraft\b|\bunpublished\b|\bstale.*course\b/,                             "draft_courses",       8],
  [/\bflag\b|\breported\b|\bviolat\b|\bflagged\b/,                            "flagged_content",     9],
  [/\bpending.*review\b|\breview.*queue\b/,                                   "pending_reviews",     9],
  [/\bmoderat\b|\bcontent.*queue\b/,                                          "moderation_status",   8],
  [/\bcredit.*low\b|\blow.*credit\b|\bschool.*credit\b/,                      "low_credit_schools",  9],
];

function matchHQIntents(query: string, brain: HQBrainState) {
  const q = query.toLowerCase().trim();
  const scoreMap: Record<string, number> = {};
  for (const [pattern, key, weight] of HQ_MATCHERS) {
    if (pattern.test(q) && brain.intents[key]) scoreMap[key] = Math.max(scoreMap[key] ?? 0, weight);
  }
  return Object.entries(scoreMap).sort((a, b) => b[1] - a[1]).map(([key, score]) => ({ key, score, text: brain.intents[key] }));
}

function replyFromEntry(entry: TwinRegistryEntry, brain: HQBrainState): TwinReply {
  if (entry.type === "navigate" && entry.route)
    return { text: `Opening ${entry.label}…`, actions: [{ label: `Open ${entry.label}`, route: entry.route }], source: "nav" };
  return { text: brain.intents[entry.id] ?? `${entry.label} — no data.`, source: "js" };
}

export function resolveHQReply(rawQuery: string, brain: HQBrainState): TwinReply | null {
  const query = rawQuery.toLowerCase().trim();
  const matches = matchHQIntents(query, brain);
  if (matches.length >= 2) return { text: matches.slice(0, 3).map(m => m.text).join("\n\n"), source: "js" };
  if (matches.length === 1) return { text: matches[0].text, source: "js" };

  const exact = TWIN_REGISTRY.find(e => e.keywords.some(k => k.toLowerCase() === query));
  if (exact) return replyFromEntry(exact, brain);

  const fuzzy = fuzzyMatch(query, TWIN_REGISTRY);
  if (fuzzy.kind === "confident") return replyFromEntry(fuzzy.entry, brain);
  if (fuzzy.kind === "ambiguous") return { text: "Did you mean:", actions: fuzzy.candidates.map(c => ({ label: c.entry.label, resolveQuery: c.entry.keywords[0] })), source: "fuzzy" };
  return null;
}

export function buildHQOpeningBrief(brain: HQBrainState): string {
  const { snap, firstName } = brain;
  if (!snap) return `Ready, ${firstName}. Ask me anything about the platform.`;
  const icon = snap.platformHealth === "critical" ? "⚠️" : snap.platformHealth === "warning" ? "🟡" : "✅";
  const parts: string[] = [`${snap.activeSchools}/${snap.totalSchools} schools active`];
  if (snap.flaggedContent.length > 0) parts.push(`${snap.flaggedContent.length} flagged`);
  if (snap.draftCourses.length > 0)   parts.push(`${snap.draftCourses.length} drafts`);
  if (snap.lowCreditSchools.length > 0) parts.push(`${snap.lowCreditSchools.length} low-credit schools`);
  return `${icon} Ready, ${firstName}.\n${parts.join(" · ")}`;
}

export function buildHQContextString(brain: HQBrainState): string {
  const { snap, fullName } = brain;
  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const lines = [`HQ Admin: ${fullName}`, `Today: ${today}`, ""];
  if (!snap) { lines.push("Platform data unavailable."); return lines.join("\n"); }
  lines.push(`Platform health: ${snap.platformHealth}`);
  lines.push(`Schools: ${snap.activeSchools} active / ${snap.totalSchools} total`);
  lines.push(`Teachers: ${snap.totalTeachers}`);
  lines.push(`New signups (7d): ${snap.recentSignups}`);
  lines.push(`Courses: ${snap.liveCourses} live, ${snap.draftCourses.length} draft`);
  lines.push(`Moderation: ${snap.flaggedContent.length} flagged, ${snap.pendingContent.length} pending`);
  if (snap.draftCourses.length > 0) { lines.push("\nDraft courses:"); snap.draftCourses.forEach(c => lines.push(`  • ${c.title} (${c.domain}) — ${c.days}d`)); }
  if (snap.flaggedContent.length > 0) { lines.push("\nFlagged:"); snap.flaggedContent.forEach(f => lines.push(`  • ${f.app} by ${f.author} — ${f.reason}`)); }
  if (snap.lowCreditSchools.length > 0) { lines.push("\nLow credits:"); snap.lowCreditSchools.forEach(s => lines.push(`  • ${s.name} — ${s.credits} credits`)); }
  return lines.join("\n");
}

export async function loadHQBrain(userId: string): Promise<HQBrainState> {
  const cached = loadCached(userId);
  if (cached && !cached.isStale) return cached;
  const profileRes = await supabase.from("profiles").select("full_name").eq("id", userId).single();
  const fullName  = profileRes.data?.full_name ?? "Admin";
  const firstName = fullName.split(" ")[0];
  let snap: HQSnapshot | null = null;
  try { snap = await fetchHQSnapshot(); } catch { snap = cached?.snap ?? null; }
  const brain: HQBrainState = { userId, fullName, firstName, snap, intents: buildHQIntents(snap), loadedAt: Date.now(), isStale: false };
  saveCache(brain);
  return brain;
}
