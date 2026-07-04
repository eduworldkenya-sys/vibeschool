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
  id:               string;
  class_id:         string;
  subject_id:       string;
  teacher_id?:      string;
  school_id?:       string;
  subject:          string;
  class:            string;
  room:             string;
  start:            string;
  end:              string;
  period:           number;
  status:           SlotStatus;
  planStatus:       PlanStatus;
  attendanceMarked: boolean;
  day_of_week?:     number;
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
  day_of_week?:     number;
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
  school_id:    string | null;
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
  school_id:       string | null;
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
  school_id:  string | null;
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
  student_id:       string;
  name:             string;
  class_name:       string;
  attendance_pct:   number;
  school_name:      string;
  pending_approval: boolean;
}

// ─── Parent Nav ───────────────────────────────────────────────────────────────
export interface ParentNavTab {
  id:    "home" | "learn" | "vibelearn" | "connect" | "students" | "funhub";
  label: string;
  icon:  string;
  href:  string;
}

// ─── Homework ─────────────────────────────────────────────────────────────────

export type HomeworkType     = "smart" | "general" | "reading" | "writing" | "project" | "revision";
export type SubmissionStatus = "pending" | "submitted" | "marked";

export interface Homework {
  id:              string;
  class_id:        string;
  teacher_id:      string;
  school_id:       string | null;
  title:           string;
  subject:         string;
  instructions:    string | null;
  type:            HomeworkType;
  due_date:        string;
  target_group_id: string | null;
  created_at:      string;
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
  school_id:            string | null;
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
  school_id:    string | null;
  joined_at:    string;
  left_at:      string | null;
  last_read_at: string | null;
}

export interface VCMessage {
  id:         string;
  thread_id:  string;
  school_id:  string | null;
  sender_id:  string;
  body:       string;
  created_at: string;
  deleted_at: string | null;
}

export interface VCCircular {
  id:            string;
  school_id:     string | null;
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


export interface VibeContent {
  id:           string
  title:        string
  description:  string | null
  body:         string | null
  type:         'epage' | 'ebook'
  source:       string | null
  url:          string
  tags:         string[]
  status:       string
  view_count:   number
  vibe_count:   number
  earnings_ksh: number
  created_at:   string
  submitted_by: string
}

// ─── VibeVoice ────────────────────────────────────────────────
export type VVTier       = 'human' | 'ai'
export type VVStatus     = 'pending' | 'approved' | 'live'
export type VVQStatus    = 'open' | 'claimed' | 'complete'
export type VVRoomStatus = 'active' | 'ended'
export type VVLang       = 'swahili' | 'english' | 'kikuyu' | 'dholuo' | 'sheng'

export interface VVNarration {
  id:           string
  title:        string
  excerpt:      string | null
  script:       string
  language:     VVLang
  subject:      string
  tier:         VVTier
  narrator_id:  string | null
  trust_score:  number
  play_count:   number
  duration_sec: number
  status:       VVStatus
  created_at:   string
}

export interface VVQueueItem {
  id:         string
  title:      string
  language:   VVLang
  subject:    string
  paragraphs: string[]
  status:     VVQStatus
  claimed_by: string | null
  claimed_at: string | null
  created_at: string
}

export interface VVReview {
  id:           string
  narration_id: string
  reviewer_id:  string | null
  approved:     boolean
  asr_score:    number | null
  created_at:   string
}

export interface VVLiveRoom {
  id:         string
  room_code:  string
  topic:      string
  language:   VVLang
  host_id:    string
  status:     VVRoomStatus
  created_at: string
  ended_at:   string | null
}

export interface VVScriptResponse {
  script:     string
  paragraphs: string[]
}

export interface VVTranslateResponse {
  translation: string
}

export interface VVQuestionResponse {
  question: string
  options:  string[]
  correct:  number
}

// ─── VibeExam ─────────────────────────────────────────────────────────────────

export type ExamDifficulty = 'easy' | 'medium' | 'hard'
export type ExamSubject    = 'Mathematics' | 'English' | 'Biology' | 'Chemistry' | 'History' | 'Physics' | 'Geography' | 'Kiswahili' | 'CRE' | 'Business Studies'
export type ExamForm       = 'Form 1' | 'Form 2' | 'Form 3' | 'Form 4'

export interface ExamQuestion {
  id:           string
  question:     string
  options:      [string, string, string, string]
  correctIndex: number
  explanation:  string
  teachingNote: string
  topic:        string
  hint?:        string
  bankId?:      string   // links back to exam_question_bank row, for flag/dismiss pipeline
}

export interface ExamAnswer {
  questionId:       string
  selectedIndex:    number
  isCorrect:        boolean
  timeSpentSeconds: number
}

export interface ExamSession {
  subject:        ExamSubject
  form:           ExamForm
  topic:          string
  difficulty:     ExamDifficulty
  totalQuestions: number
  questions:      ExamQuestion[]
  answers:        ExamAnswer[]
  startedAt:      string
  completedAt:    string | null
  currentStreak:  number
}

export interface ExamResult {
  score:        number
  total:        number
  percentage:   number
  weakTopics:   string[]
  strongTopics: string[]
  answers:      ExamAnswer[]
  questions:    ExamQuestion[]
}

export interface StudentStreak {
  currentStreak:  number
  lastActiveDate: string
}

export interface PulseTimetableSlot {
  id: string
  day_of_week: number
  period: number
  start_time: string
  end_time: string
  subject: string
  class_name: string
  class_id: string
  subject_id: string
}

export interface PulseAtRisk {
  id: string
  name: string
  reason: string
}

export interface PulseCurriculumStat {
  covered: number
  total: number
  subject: string
}

export interface TwinAction {
  label:        string
  route?:       string
  resolveQuery?: string
}

export interface TwinReply {
  text:    string
  actions?: TwinAction[]
  source:  "js" | "nav" | "fuzzy"
}

export interface TwinRegistryEntry {
  id:       string
  type:     "answer" | "navigate"
  keywords: string[]
  route?:   string
  label:    string
}

export interface TwinMessage {
  role:    "user" | "twin"
  text:    string
  source?: "js" | "ai" | "offline" | "nav" | "fuzzy"
  actions?: TwinAction[]
}

// --- Pulse types (moved from lib/pulse/fetcher.ts) ---

export type WorkflowState = "Done" | "Current" | "Next" | "Blocked" | "Not available yet";

export type PulseAttendanceStatus = "none" | "pending" | "completed";
export type TaskStatus = "none" | "assigned" | "completed";
export type MarkingStatus = "none" | "pending" | "completed";
export type RecordStatus = "none" | "pending" | "completed";

export interface Slot {
  id: string;
  day_of_week: number;
  period: number;
  class_id: string;
  class_name: string;
  subject: string;
  subject_id: string;
  start_time: string;
  end_time: string;

  lesson_plan_id: string | null;
  curriculum_id: string | null;
  scheme_id: string | null;

  attendance_status: PulseAttendanceStatus;
  evidence_count: number;
  task_status: TaskStatus;
  submission_count: number;
  marking_status: MarkingStatus;
  progress_record_status: RecordStatus;
  reflection_status: RecordStatus;
  next_lesson_status: RecordStatus;
}

export interface ActivityLog {
  id: string;
  type: "attendance" | "lesson_plan" | "homework";
  title: string;
  subtitle: string;
  timestamp: string;
}

export interface PulseSnapshot {
  userId: string;
  schoolId: string;
  todaySlots: Slot[];
  tomorrowSlots: Slot[];
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
  recentActivity: ActivityLog[];
  weekOverview: { lessonsPlanned: number; lessonsTaught: number; assignmentsGiven: number; engagementPct: number };
}

// --- Pulse rules/UI types (moved from lib/pulse/rules.ts and components/teacher/RecentActivity.tsx) ---

export type TaskSeverity = "critical" | "urgent" | "calm";

export interface PriorityTask {
  id: string;
  label: string;
  detail: string;
  severity: TaskSeverity;
  href: string;
}

export interface RuleResult {
  message: string;
  priority: TaskSeverity;
  upcomingWarning: string | null;
  confidence: number;
  signals: string[];
  tasks: PriorityTask[];
}

export interface ActivityItem {
  id: string;
  type: "attendance" | "lesson_plan" | "parent_message" | "gradebook" | "twin";
  title: string;
  subtitle: string;
  timestamp: string;
}

