export type { Json } from './database.types'
import type { Database as CanonicalDatabase } from './database.types'
import type {
  LegacyCreateChildForParentArgs,
  LegacyExamResultInsert,
  LegacyFinanceInvoiceRow,
  LegacyInvoiceAgingRow,
  LegacyMeetingActionInsert,
  LegacyMeetingAgendaItemInsert,
  LegacyMeetingInsert,
  LegacyMeetingUpdate,
  LegacyReportCardRemarkInsert,
} from './legacy-production.types'

type LegacyTable<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type FinanceInvoiceInsert = Omit<LegacyFinanceInvoiceRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & {
  id?: string
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

type ExamResultRow = Required<Pick<LegacyExamResultInsert,
  'exam_id' | 'school_id' | 'class_id' | 'subject_id' | 'student_id' | 'teacher_id' | 'marks'
>> & {
  id: string
  is_absent: boolean
  created_at: string
  updated_at: string
}

type ReportCardRemarkRow = Required<Pick<LegacyReportCardRemarkInsert,
  'exam_id' | 'school_id' | 'class_id' | 'student_id' | 'class_teacher_id'
>> & {
  id: string
  remarks: string | null
  conduct: string | null
  created_at: string
  updated_at: string
}

type MeetingRow = {
  id: string
  school_id: string | null
  title: string
  description: string | null
  meeting_type: string | null
  status: string | null
  chair_id: string | null
  secretary_id: string | null
  venue: string | null
  meeting_link: string | null
  scheduled_at: string
  duration_mins: number | null
  started_at: string | null
  ended_at: string | null
  confidentiality: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

type MeetingAgendaItemRow = {
  id: string
  meeting_id: string | null
  title: string
  description: string | null
  duration_mins: number | null
  order_index: number | null
  presenter_id: string | null
  status: string | null
  notes: string | null
  created_at: string | null
}

type MeetingActionRow = {
  id: string
  meeting_id: string | null
  agenda_item_id: string | null
  title: string
  description: string | null
  owner_id: string | null
  due_date: string | null
  priority: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Application-facing database contract.
 *
 * CanonicalDatabase is generated exclusively from the clean migration rebuild.
 * The additional members below are production objects verified by introspection
 * whose historical migrations have not yet been reconstructed. Keeping them in
 * this wrapper prevents production drift from being written into generated truth.
 */
export type Database = Omit<CanonicalDatabase, 'public'> & {
  public: Omit<CanonicalDatabase['public'], 'Tables' | 'Views' | 'Functions'> & {
    Tables: CanonicalDatabase['public']['Tables'] & {
      finance_invoices: LegacyTable<LegacyFinanceInvoiceRow, FinanceInvoiceInsert>
      exam_results: LegacyTable<ExamResultRow, LegacyExamResultInsert>
      report_card_remarks: LegacyTable<ReportCardRemarkRow, LegacyReportCardRemarkInsert>
      meetings: LegacyTable<MeetingRow, LegacyMeetingInsert, LegacyMeetingUpdate>
      meeting_agenda_items: LegacyTable<MeetingAgendaItemRow, LegacyMeetingAgendaItemInsert>
      meeting_actions: LegacyTable<MeetingActionRow, LegacyMeetingActionInsert>
    }
    Views: CanonicalDatabase['public']['Views'] & {
      v_invoice_aging: {
        Row: LegacyInvoiceAgingRow
        Relationships: []
      }
    }
    Functions: CanonicalDatabase['public']['Functions'] & {
      create_child_for_parent: {
        Args: LegacyCreateChildForParentArgs
        Returns: string
      }
    }
  }
}
