// lib/twin/hq-registry.ts
// HQ Twin registry — keyword routes for the platform admin Twin

import { TwinRegistryEntry } from "@/lib/types";

export const HQ_TWIN_REGISTRY: TwinRegistryEntry[] = [
  // ── Answer entries ──────────────────────────────────────────────────────────
  { id: "platform_health",    type: "answer", label: "Platform health",     keywords: ["platform health", "how is the platform", "all good", "everything ok", "system status", "is everything fine"] },
  { id: "platform_summary",   type: "answer", label: "Platform summary",    keywords: ["summary", "overview", "status", "how are things", "what is going on", "give me a summary", "quick update"] },
  { id: "school_count",       type: "answer", label: "School count",        keywords: ["how many schools", "school count", "number of schools", "total schools", "schools on platform"] },
  { id: "school_status",      type: "answer", label: "School status",       keywords: ["school status", "active schools", "inactive schools", "which schools are active"] },
  { id: "teacher_count",      type: "answer", label: "Teacher count",       keywords: ["how many teachers", "teacher count", "registered teachers", "total teachers"] },
  { id: "recent_signups",     type: "answer", label: "Recent signups",      keywords: ["signups", "new users", "new profiles", "recent joins", "who joined", "this week signups"] },
  { id: "course_status",      type: "answer", label: "Course status",       keywords: ["course status", "how many courses", "live courses", "courses live", "published courses"] },
  { id: "draft_courses",      type: "answer", label: "Draft courses",       keywords: ["draft courses", "unpublished", "stale courses", "courses in draft", "what is in draft"] },
  { id: "flagged_content",    type: "answer", label: "Flagged content",     keywords: ["flagged", "reported content", "violations", "flags", "what is flagged", "content flags"] },
  { id: "pending_reviews",    type: "answer", label: "Pending reviews",     keywords: ["pending review", "review queue", "submitted for review", "awaiting review", "content queue"] },
  { id: "moderation_status",  type: "answer", label: "Moderation",          keywords: ["moderation", "content moderation", "mod queue", "what needs review"] },
  { id: "low_credit_schools", type: "answer", label: "Low credit schools",  keywords: ["low credit schools", "school credits", "credit warning", "schools low on credits", "which schools need credits"] },

  // ── Navigate entries ────────────────────────────────────────────────────────
  { id: "nav_hq_home",        type: "navigate", route: "/hq",               label: "HQ Home",      keywords: ["hq home", "home", "dashboard"] },
  { id: "nav_hq_courses",     type: "navigate", route: "/hq?screen=courses", label: "Academy",     keywords: ["academy", "courses", "course list"] },
  { id: "nav_hq_exam",        type: "navigate", route: "/hq?screen=exam",    label: "Exam",        keywords: ["exam", "kcse", "question bank"] },
  { id: "nav_hq_curriculum",  type: "navigate", route: "/hq?screen=curriculum", label: "Curriculum", keywords: ["curriculum", "cbc", "scheme content"] },
  { id: "nav_hq_global",      type: "navigate", route: "/hq?screen=global-mod", label: "Global mod", keywords: ["global", "vibepress", "vibechronicles", "moderation queue", "press"] },
  { id: "nav_hq_funhub",      type: "navigate", route: "/hq?screen=funhub", label: "FunHub",       keywords: ["funhub", "xp", "vouchers", "leaderboard"] },
];
