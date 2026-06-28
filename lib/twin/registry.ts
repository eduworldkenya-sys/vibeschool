// lib/twin/registry.ts
// Unified Twin registry — every snapshot-backed answer key and every
// navigable teacher route, used for exact keyword matching (tier 2)
// and fuzzy fallback (tier 3/4). No AI, no network, runs offline.

import { TwinRegistryEntry } from "@/lib/types";

export const TWIN_REGISTRY: TwinRegistryEntry[] = [
  // ---- answer entries (id mirrors brain.intents keys) ----
  { id: "attendance_status",   type: "answer", label: "Attendance",          keywords: ["attendance", "mark attendance", "roll call", "submit attendance"] },
  { id: "what_is_pending",     type: "answer", label: "Pending attendance",  keywords: ["pending", "not done", "havent marked"] },
  { id: "have_i_marked",       type: "answer", label: "Attendance check",    keywords: ["have i marked", "did i mark"] },
  { id: "at_risk_students",    type: "answer", label: "At-risk students",    keywords: ["at risk", "at risk students", "absentee", "concern"] },
  { id: "who_is_absent",       type: "answer", label: "Frequent absentees",  keywords: ["who is absent", "frequent absentees"] },
  { id: "student_concerns",    type: "answer", label: "Student concerns",    keywords: ["worried about", "student concern"] },
  { id: "consecutive_absent",  type: "answer", label: "Consecutive absence", keywords: ["absent days", "days absent", "missing in a row"] },
  { id: "absent_streak",       type: "answer", label: "Absence streak",      keywords: ["absent streak", "consecutive absences"] },
  { id: "am_i_behind",         type: "answer", label: "Curriculum coverage", keywords: ["behind", "coverage", "curriculum", "scheme", "strand"] },
  { id: "curriculum_status",   type: "answer", label: "Curriculum status",   keywords: ["curriculum status", "subject status"] },
  { id: "how_many_credits",    type: "answer", label: "Credit balance",      keywords: ["credit", "credits", "balance", "how many credits"] },
  { id: "credits_status",      type: "answer", label: "Credit warning",      keywords: ["credit low", "running out of credits"] },
  { id: "tpad_status",         type: "answer", label: "TPAD status",         keywords: ["tpad", "appraisal", "tpad deadline"] },
  { id: "what_do_i_have_today", type: "answer", label: "Today's lessons",    keywords: ["today", "schedule", "what do i have", "my class today"] },
  { id: "my_schedule",         type: "answer", label: "My schedule",         keywords: ["my schedule", "my timetable today"] },
  { id: "my_streak",           type: "answer", label: "Attendance streak",   keywords: ["streak", "consistent", "days in a row"] },
  { id: "term_progress",       type: "answer", label: "Term progress",       keywords: ["term progress", "how far is the term"] },
  { id: "unread_messages",     type: "answer", label: "Unread messages",     keywords: ["messages", "unread", "vibeconnect inbox", "inbox"] },
  { id: "homework_due",        type: "answer", label: "Homework due",        keywords: ["homework", "homework due", "assignment"] },
  { id: "missed_plans",        type: "answer", label: "Lesson plan status",  keywords: ["lesson plan", "no plan filed", "plan today"] },
  { id: "students_overview",   type: "answer", label: "Students overview",   keywords: ["students", "my students", "students overview"] },
  { id: "how_many_students",   type: "answer", label: "Class size",          keywords: ["how many students", "class size", "how many kids"] },
  { id: "student_performance", type: "answer", label: "Class performance",   keywords: ["student performance", "class performance", "how is my class doing"] },
  { id: "who_needs_help",      type: "answer", label: "Who needs help",      keywords: ["who needs help", "who is struggling", "follow up", "check on"] },

  // ---- navigate entries (every reachable teacher route) ----
  { id: "nav_classhub",    type: "navigate", route: "/teacher/classhub",    label: "ClassHub",      keywords: ["classhub", "class hub", "my classes", "classes"] },
  { id: "nav_students",    type: "navigate", route: "/teacher/students",    label: "Students",      keywords: ["students page", "student list", "all students"] },
  { id: "nav_subjecthub",  type: "navigate", route: "/teacher/subjecthub",  label: "SubjectHub",    keywords: ["subjecthub", "subject hub", "subjects"] },
  { id: "nav_scheme",      type: "navigate", route: "/teacher/scheme",      label: "Scheme of Work", keywords: ["scheme", "scheme of work", "syllabus coverage"] },
  { id: "nav_timetable",   type: "navigate", route: "/teacher/timetable",   label: "Timetable",     keywords: ["timetable", "time table"] },
  { id: "nav_tpad",        type: "navigate", route: "/teacher/tpad",        label: "TPAD",          keywords: ["tpad page", "self appraisal page"] },
  { id: "nav_vibeconnect", type: "navigate", route: "/teacher/vibeconnect", label: "VibeConnect",   keywords: ["vibeconnect", "messages page", "chat page"] },
  { id: "nav_vibelearn",   type: "navigate", route: "/teacher/vibelearn",   label: "VibeLearn",     keywords: ["vibelearn", "learn module"] },
  { id: "nav_credits",     type: "navigate", route: "/teacher/credits",     label: "Credits",       keywords: ["credits page", "buy credits", "top up credits"] },
  { id: "nav_results",     type: "navigate", route: "/teacher/results",     label: "Results",       keywords: ["results", "report card", "exam results"] },
  { id: "nav_resources",   type: "navigate", route: "/teacher/resources",   label: "Resources",     keywords: ["resources", "materials", "teaching resources"] },
  { id: "nav_settings",    type: "navigate", route: "/teacher/settings",    label: "Settings",      keywords: ["settings", "preferences"] },
  { id: "nav_lessonnotes", type: "navigate", route: "/teacher/lessonnotes", label: "Lesson Notes",  keywords: ["lesson notes", "lessonnotes"] },
  { id: "nav_lessonplan",  type: "navigate", route: "/teacher/lessonplan",  label: "Lesson Plan",   keywords: ["lesson plan page", "create lesson plan", "new lesson plan"] },
  { id: "nav_assessment",  type: "navigate", route: "/teacher/assessment",  label: "Assessment",    keywords: ["assessment", "cbc assessment"] },
  { id: "nav_academics",   type: "navigate", route: "/teacher/academics",   label: "Academics",     keywords: ["academics"] },
  { id: "nav_schoolhub",   type: "navigate", route: "/teacher/schoolhub",   label: "SchoolHub",     keywords: ["schoolhub", "school hub"] },
  { id: "nav_profile",     type: "navigate", route: "/teacher/profile",     label: "Profile",       keywords: ["profile", "my profile"] },
  { id: "nav_pulse",       type: "navigate", route: "/teacher/pulse",       label: "Pulse",         keywords: ["pulse", "pulse page", "dashboard"] },
  { id: "nav_help",        type: "navigate", route: "/teacher/help",        label: "Help",          keywords: ["help", "support"] },
];
