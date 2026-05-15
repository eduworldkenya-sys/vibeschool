export type TrendDirection = "improving" | "stable" | "declining";
export type PlanStatus     = "green" | "amber" | "red" | "grey";
export type SlotStatus     = "taught" | "scheduled" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type ThreadRole     = "parent" | "teacher" | "admin";
export type FlagType       = "attendance" | "resource_gap" | "performance";
export type FlagSeverity   = "critical" | "high" | "medium" | "low";

export interface Student {
  id: number;
  name: string;
  absences: number;
  trend: TrendDirection;
  score: number;
}

export interface TimetableSlot {
  id: number;
  subject: string;
  class: string;
  room: string;
  start: string;
  end: string;
  period: number;
  status: SlotStatus;
  planStatus: PlanStatus;
  attendanceMarked: boolean;
}

export interface Flag {
  id: number;
  type: FlagType;
  severity: FlagSeverity;
  student: string | null;
  message: string;
  action: string;
  resolved: boolean;
}

export interface Thread {
  id: number;
  type: ThreadRole;
  name: string;
  last: string;
  time: string;
  unread: number;
  avatar: string;
}

export interface LessonPlan {
  id: number;
  title: string;
  class: string;
  date: string;
  status: PlanStatus;
  topic: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  date: string;
}

export interface Teacher {
  name: string;
  school: string;
  class: string;
  subject: string;
  initials: string;
}
export interface TeacherAlert {
  id: string
  type: 'urgent' | 'warning' | 'info' | 'success'
  message: string
  action?: string
  actionHref?: string
}

export interface TeacherDocument {
  name: string
  status: 'valid' | 'expiring' | 'missing' | 'expired'
  expiryDate?: string
}

export interface ClassItem {
  id:               string
  name:             string
  stream:           string
  subject:          string
  created_at:       string
  unreadAlerts:     number
  lessonTime:       string
  studentCount:     number
  attendancePct:    number
  attendanceMarked: boolean
  nextAssessment:   string | null
}
