import type {
  Student,
  TimetableSlot,
  Flag,
  Thread,
  LessonPlan,
  Announcement,
  Teacher,
} from "./types";

export const TEACHER: Teacher = {
  name:     "Ms. Wanjiku Kamau",
  school:   "St. Mary's Academy",
  class:    "Grade 6B",
  subject:  "Mathematics",
  initials: "WK",
};

export const TODAY_SLOTS: TimetableSlot[] = [
  { id: 1, subject: "Mathematics", class: "6B", room: "Room 12", start: "07:30", end: "08:30", period: 1, status: "taught",    planStatus: "green", attendanceMarked: true  },
  { id: 2, subject: "Mathematics", class: "7A", room: "Room 12", start: "08:30", end: "09:30", period: 2, status: "scheduled", planStatus: "green", attendanceMarked: false },
  { id: 3, subject: "Mathematics", class: "6B", room: "Lab 2",   start: "10:00", end: "11:00", period: 3, status: "scheduled", planStatus: "amber", attendanceMarked: false },
  { id: 4, subject: "Mathematics", class: "8C", room: "Room 12", start: "11:00", end: "12:00", period: 4, status: "scheduled", planStatus: "red",   attendanceMarked: false },
  { id: 5, subject: "Mathematics", class: "6B", room: "Room 12", start: "14:00", end: "15:00", period: 5, status: "scheduled", planStatus: "green", attendanceMarked: false },
];

export const STUDENTS: Student[] = [
  { id: 1, name: "Amina Ochieng",  absences: 0, trend: "improving", score: 82 },
  { id: 2, name: "Brian Kamau",    absences: 3, trend: "declining",  score: 58 },
  { id: 3, name: "Cynthia Mwangi", absences: 1, trend: "stable",     score: 74 },
  { id: 4, name: "David Otieno",   absences: 5, trend: "declining",  score: 51 },
  { id: 5, name: "Esther Njoki",   absences: 0, trend: "improving",  score: 91 },
  { id: 6, name: "Felix Kipchoge", absences: 2, trend: "stable",     score: 67 },
  { id: 7, name: "Grace Auma",     absences: 0, trend: "improving",  score: 88 },
  { id: 8, name: "Hassan Maina",   absences: 1, trend: "stable",     score: 73 },
];

export const FLAGS: Flag[] = [
  { id: 1, type: "attendance",   severity: "high",   student: "David Otieno", message: "5 absences this term. Parent thread auto-created.",      action: "Message Parent",   resolved: false },
  { id: 2, type: "resource_gap", severity: "low",    student: null,           message: "Period 3 — Lab equipment unconfirmed for Geometry lesson.", action: "Resolve Resource", resolved: false },
  { id: 3, type: "attendance",   severity: "medium", student: "Brian Kamau",  message: "3 consecutive absences. Consider welfare check.",          action: "Message Parent",   resolved: false },
];

export const CURRICULUM = {
  strand:         "Algebra",
  topicsCovered:  14,
  topicsTotal:    18,
  weeksRemaining: 4,
};

export const ANNOUNCEMENTS: Announcement[] = [
  { id: 1, title: "Term 2 Report Card Deadline", body: "All assessments must be submitted by Friday 5pm.", pinned: true,  date: "Today"     },
  { id: 2, title: "Staff Meeting — Thursday",     body: "Mandatory meeting at 4pm in the main hall.",      pinned: false, date: "Yesterday" },
];

export const NEWS = [
  { id: 1, title: "Kenya National Exam Board Updates Mathematics Syllabus", source: "Education Weekly", time: "2h ago" },
  { id: 2, title: "New Approaches to Formative Assessment in African Schools", source: "EduAfrica",       time: "5h ago" },
  { id: 3, title: "KICD Releases New STEM Resources for Secondary Schools",  source: "Daily Nation",     time: "1d ago" },
];

export const VIBECONNECT_THREADS: Thread[] = [
  { id: 1, type: "parent",  name: "Mrs. Otieno (David's Parent)",   last: "Thank you for reaching out, I will talk to him tonight.", time: "10m ago",   unread: 1, avatar: "MO" },
  { id: 2, type: "teacher", name: "Mr. Odhiambo — Head of Maths",   last: "Can you share the assessment breakdown for 8C?",          time: "1h ago",    unread: 2, avatar: "JO" },
  { id: 3, type: "admin",   name: "Mrs. Njeri — Deputy Principal",   last: "Please ensure your register is submitted by end of day.", time: "2h ago",    unread: 1, avatar: "DN" },
  { id: 4, type: "parent",  name: "Mr. Kamau (Brian's Parent)",      last: "He has been dealing with some issues at home.",           time: "3h ago",    unread: 0, avatar: "PK" },
  { id: 5, type: "admin",   name: "School Admin Office",             last: "Term 2 timetable adjustments attached. Please confirm.", time: "Yesterday", unread: 0, avatar: "AO" },
  { id: 6, type: "teacher", name: "Ms. Akinyi — Form Tutor 7A",      last: "Thanks for covering last week!",                         time: "Yesterday", unread: 0, avatar: "SA" },
  { id: 7, type: "parent",  name: "Mrs. Njoki (Esther's Parent)",    last: "Esther said she really enjoys your lessons!",            time: "Yesterday", unread: 0, avatar: "FN" },
];

export const QUICK_ACTIONS = [
  { id: "classhub",    label: "ClassHub",      icon: "🏫", color: "#dbeafe", iconColor: "#1d4ed8" },
  { id: "timetable",   label: "SmartTimetable", icon: "🗓️", color: "#d1fae5", iconColor: "#065f46" },
  { id: "lessonplan",  label: "Lesson Plans",   icon: "📖", color: "#ede9fe", iconColor: "#6d28d9" },
  { id: "attendance",  label: "Attendance",     icon: "✅", color: "#d1fae5", iconColor: "#065f46" },
  { id: "subjecthub",  label: "SubjectHub",     icon: "🔬", color: "#e0f2fe", iconColor: "#075985" },
  { id: "vibelearn",   label: "VibeLearn",      icon: "🎓", color: "#fef9c3", iconColor: "#854d0e" },
  { id: "assessment",  label: "Assessment",     icon: "📊", color: "#fef3c7", iconColor: "#92400e" },
  { id: "schoolhub",   label: "SchoolHub",      icon: "🏛️", color: "#f3e8ff", iconColor: "#7e22ce" },
];

export const LESSON_PLANS: LessonPlan[] = [
  { id: 1, title: "Algebra — Linear Equations",      class: "6B", date: "Today · Period 2", status: "green", topic: "Balance method, real-world contexts"  },
  { id: 2, title: "Geometry — Angles in Polygons",   class: "6B", date: "Today · Period 3", status: "amber", topic: "Resource confirmation needed"          },
  { id: 3, title: "Algebra — Quadratic Introduction", class: "8C", date: "Today · Period 4", status: "red",   topic: "No plan generated yet"                },
  { id: 4, title: "Data Handling — Mean & Median",   class: "7A", date: "Tomorrow",         status: "green", topic: "Grouped data, calculator method"       },
];