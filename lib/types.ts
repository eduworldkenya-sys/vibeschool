// lib/types.ts

// ─── Union Types ─────────────────────────────────────────────────────────────

export type TrendDirection   = "improving" | "stable" | "declining";
export type PlanStatus       = "green" | "amber" | "red" | "grey";
export type SlotStatus       = "taught" | "scheduled" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type ThreadRole       = "parent" | "teacher" | "admin";
export type FlagType         = "attendance" | "resource_gap" | "performance";
export type FlagSeverity     = "critical" | "high" | "medium" | "low";
export type UserRole         = "teacher" | "parent" | "student" | "admin";
export type RequestStatus    = "pending" | "approved" | "rejected";

// ─── UI / Mockup Types ───────────────────────────────────────────────────────

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
  id: string;
  type: "urgent" | "warning" | "info" | "success";
  message: string;
  action?: string;
  actionHref?: string;
}

export interface TeacherDocument {
  name: string;
  status: "valid" | "expiring" | "missing" | "expired";
  expiryDate?: string;
}

export interface ClassItem {
  id:               string;
  name:             string;
  stream:           string;
  subject:          string;
  created_at:       string;
  unreadAlerts:     number;
  lessonTime:       string;
  studentCount:     number;
  attendancePct:    number;
  attendanceMarked: boolean;
  nextAssessment:   string | null;
}

// ─── Supabase DB Row Types ───────────────────────────────────────────────────

export interface Profile {
  id:            string;
  full_name:     string;
  role:          UserRole;
  school_id:     string | null;
  country_code:  string | null;
  date_of_birth: string | null;
}

export interface School {
  id:           string;
  name:         string;
  subdomain:    string;
  status:       string;
  created_by:   string;
  country_code: string | null;
}

export interface StudentRow {
  id:               string;
  class_id:         string | null;
  name:             string;
  admission_number: string | null;
  profile_id:       string | null;
}

export interface StudentClaimCode {
  id:         string;
  student_id: string;
  code:       string;
  claimed:    boolean;
  created_at: string;
  expires_at: string | null;
}

export interface StudentProfile {
  profile_id:   string;
  school_id:    string;
  admission_no: string;
  gender:       string | null;
}

export interface ParentProfile {
  profile_id:   string;
  relationship: string;
  occupation:   string | null;
}

export interface ParentStudentLink {
  id:              string;
  parent_id:       string;
  student_id:      string;
  school_id:       string;
  relationship:    string;
  is_primary:      boolean;
  can_pickup:      boolean;
  receives_alerts: boolean;
}

export interface ClassJoinRequest {
  id:         string;
  student_id: string;
  class_id:   string;
  parent_id:  string;
  status:     RequestStatus;
}

export interface StudentClass {
  id:         string;
  school_id:  string;
  student_id: string;
  class_id:   string;
  joined_at:  string;
  is_current: boolean;
}

export interface AttendanceRow {
  id:               string;
  class_id:         string;
  student_id:       string;
  date:             string;
  status:           AttendanceStatus;
  timetable_slot_id: string | null;
}

export interface Message {
  id:           string;
  recipient_id: string;
  sender_id:    string;
  body:         string;
  is_read:      boolean;
  created_at:   string;
}

// ─── Derived / UI Types ──────────────────────────────────────────────────────

export interface LinkedChild {
  student_id:     string;
  name:           string;
  class_name:     string;
  attendance_pct: number;
  school_name:    string;
}

// ─── Parent Nav ───────────────────────────────────────────────────────────────
export interface ParentNavTab {
  id:    "home" | "learn" | "vibelearn" | "connect" | "students";
  label: string;
  icon:  string;
  href:  string;
}

// ─── Homework ─────────────────────────────────────────────────────────────────

export type HomeworkType     = "smart" | "book";
export type SubmissionStatus = "pending" | "submitted" | "marked";

export interface Homework {
  id:           string;
  class_id:     string;
  teacher_id:   string;
  title:        string;
  subject:      string;
  instructions: string | null;
  type:         HomeworkType;
  due_date:     string;
  created_at:   string;
}

export interface HomeworkQuestion {
  id:          string;
  homework_id: string;
  question:    string;
  order_num:   number;
}

export interface HomeworkSubmission {
  id:           string;
  homework_id:  string;
  student_id:   string;
  submitted_at: string | null;
  status:       SubmissionStatus;
  photo_url:    string | null;
  mark:         number | null;
  feedback:     string | null;
  created_at:   string;
}

export interface HomeworkAnswer {
  id:            string;
  submission_id: string;
  question_id:   string;
  answer_text:   string | null;
  created_at:    string;
}

export interface MessageThread {
  teacherId:   string;
  teacherName: string;
  lastMessage: string;
  lastTime:    string;
  unreadCount: number;
}

// ─── Child Profile ────────────────────────────────────────────────────────────

export interface ChildProfile {
  id:                      string;
  student_id:              string;
  parent_id:               string;
  nickname:                string | null;
  favourite_color:         string | null;
  favourite_food:          string | null;
  favourite_animal:        string | null;
  favourite_book:          string | null;
  favourite_sport:         string | null;
  blood_group:             string | null;
  allergies:               string | null;
  medical_notes:           string | null;
  special_needs:           string | null;
  emergency_contact_name:  string | null;
  emergency_contact_phone: string | null;
  photo_url:               string | null;
  bio:                     string | null;
  owner:                   string;
  visibility:              string;
  created_at:              string;
  updated_at:              string;
  deleted_at:              string | null;
}

export interface ChildBadge {
  id:         string;
  student_id: string;
  badge_id:   string;
  earned_at:  string;
  awarded_by: string;
  badges: {
    code:        string;
    name:        string;
    icon:        string;
    description: string;
  };
}

export interface StudentFull {
  id:               string;
  name:             string;
  class_id:         string | null;
  admission_number: string | null;
  date_of_birth:    string | null;
  gender:           string | null;
  autonomy_level:   number;
}

// ─── Child Media ───────────────────────────────────────────────────────────────
export interface ChildMedia {
  id:            string;
  student_id:    string;
  parent_id:     string;
  title:         string | null;
  description:   string | null;
  type:          "photo" | "video" | "document" | string;
  url:           string;
  thumbnail_url: string | null;
  related_to:    string | null;
  owner:         string | null;
  visibility:    string | null;
  recorded_at:   string | null;
  created_at:    string;
  deleted_at:    string | null;
}

// ─── Health Records ────────────────────────────────────────────────────────────
export interface HealthRecord {
  id:          string;
  student_id:  string;
  parent_id:   string;
  record_type: "visit" | "illness" | "injury" | "other" | string;
  title:       string;
  description: string | null;
  provider:    string | null;
  location:    string | null;
  severity:    "mild" | "moderate" | "severe" | null;
  outcome:     string | null;
  recorded_at: string | null;
  created_at:  string;
  deleted_at:  string | null;
}

// ─── Health Vaccinations ───────────────────────────────────────────────────────
export interface HealthVaccination {
  id:              string;
  student_id:      string;
  parent_id:       string;
  vaccine_name:    string;
  dose:            string | null;
  administered_at: string | null;
  next_due_date:   string | null;
  provider:        string | null;
  location:        string | null;
  notes:           string | null;
  created_at:      string;
  deleted_at:      string | null;
}

// ─── VibeConnect ──────────────────────────────────────────────────────────────

export interface VCThread {
  id:                   string;
  school_id:            string;
  type:                 'direct' | 'circular';
  subject:              string | null;
  created_by:           string;
  created_at:           string;
  last_message_at:      string | null;
  last_message_preview: string | null;
}

export interface VCParticipant {
  id:           string;
  thread_id:    string;
  profile_id:   string;
  school_id:    string;
  joined_at:    string;
  left_at:      string | null;
  last_read_at: string | null;
}

export interface VCMessage {
  id:         string;
  thread_id:  string;
  school_id:  string;
  sender_id:  string;
  body:       string;
  created_at: string;
  deleted_at: string | null;
}

export interface VCCircular {
  id:            string;
  school_id:     string;
  title:         string;
  body:          string;
  audience_type: 'all_staff' | 'all_parents' | 'everyone';
  requires_ack:  boolean;
  ack_deadline:  string | null;
  sent_by:       string;
  sent_at:       string;
  created_at:    string;
}

export interface VCCircularRecipient {
  id:           string;
  circular_id:  string;
  profile_id:   string;
  delivered_at: string;
  ack_at:       string | null;
}

export interface VCThreadUI {
  threadId:      string;
  otherName:     string;
  otherInitials: string;
  lastMessage:   string;
  lastTime:      string;
  unreadCount:   number;
  otherRole:     string;
}

// ─── VibeConnect ──────────────────────────────────────────────────────────────

