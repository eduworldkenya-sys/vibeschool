// Transitional compatibility types for public-schema objects verified in the
// live production database but not yet reconstructable from repository migrations.
//
// IMPORTANT:
// - lib/database.types.ts remains generated from the canonical clean rebuild.
// - Do not merge these declarations into the generated Database type.
// - Remove each declaration when its production lineage is reconciled into migrations.

export interface LegacyFinanceInvoiceRow {
  id: string
  school_id: string
  student_id: string
  class_id: string | null
  term: string
  year: number
  due_date: string | null
  status: string
  total_amount: number
  paid_amount: number
  notes: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface LegacyInvoiceAgingRow {
  id: string | null
  school_id: string | null
  student_id: string | null
  student_name: string | null
  admission_number: string | null
  term: string | null
  year: number | null
  status: string | null
  total_amount: number | null
  paid_amount: number | null
  balance: number | null
  due_date: string | null
  aging_bucket: string | null
  days_overdue: number | null
  created_at: string | null
}

export interface LegacyExamResultInsert {
  id?: string
  exam_id: string
  school_id: string
  class_id: string
  subject_id: string
  student_id: string
  teacher_id: string
  marks: number
  is_absent?: boolean
  created_at?: string
  updated_at?: string
}

export interface LegacyReportCardRemarkInsert {
  id?: string
  exam_id: string
  school_id: string
  class_id: string
  student_id: string
  class_teacher_id: string
  remarks?: string | null
  conduct?: string | null
  created_at?: string
  updated_at?: string
}

export interface LegacyMeetingInsert {
  id?: string
  school_id?: string | null
  title: string
  description?: string | null
  meeting_type?: string | null
  status?: string | null
  chair_id?: string | null
  secretary_id?: string | null
  venue?: string | null
  meeting_link?: string | null
  scheduled_at: string
  duration_mins?: number | null
  started_at?: string | null
  ended_at?: string | null
  confidentiality?: string | null
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type LegacyMeetingUpdate = Partial<LegacyMeetingInsert>

export interface LegacyMeetingAgendaItemInsert {
  id?: string
  meeting_id?: string | null
  title: string
  description?: string | null
  duration_mins?: number | null
  order_index?: number | null
  presenter_id?: string | null
  status?: string | null
  notes?: string | null
  created_at?: string | null
}

export interface LegacyMeetingActionInsert {
  id?: string
  meeting_id?: string | null
  agenda_item_id?: string | null
  title: string
  description?: string | null
  owner_id?: string | null
  due_date?: string | null
  priority?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface LegacyCreateChildForParentArgs {
  p_name: string
  p_dob: string
  p_class_id: string
}
