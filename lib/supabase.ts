import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { getHQSupabaseClient } from './hq/supabase'

type GeneratedHomeworkTable = Database['public']['Tables']['homework']

type LiveHomeworkProvenance = {
  source_publication_id: string | null
  source_chapter_id: string | null
  source_resource_id: string | null
  source_block_id: string | null
  source_outcome_id: string | null
  teaching_occurrence_id: string | null
}

type LiveHomeworkTable = {
  Row: GeneratedHomeworkTable['Row'] & LiveHomeworkProvenance
  Insert: GeneratedHomeworkTable['Insert'] & Partial<LiveHomeworkProvenance>
  Update: GeneratedHomeworkTable['Update'] & Partial<LiveHomeworkProvenance>
  Relationships: GeneratedHomeworkTable['Relationships']
}

/**
 * Production can briefly lead the checked-in generated Supabase snapshot.
 * Keep verified drift precise here instead of weakening feature code with
 * `any`/`unknown` casts. Regenerating database.types.ts can later collapse this
 * overlay without changing callers.
 */
type GeneratedTimetableSlots = Database['public']['Tables']['timetable_slots']
type GeneratedTeachingOccurrences = Database['public']['Tables']['teaching_occurrences']
type GeneratedSchoolPeriods = Database['public']['Tables']['school_periods']

type LiveTimetableSlotFields = {
  allocation_units: number
  recurrence_pattern: string
  resource_id: string | null
  release_id: string | null
}
type LiveSchoolPeriodFields = {
  schedule_day: number
  protected: boolean
}
type LiveSchoolPeriods = {
  Row: GeneratedSchoolPeriods['Row'] & LiveSchoolPeriodFields
  Insert: GeneratedSchoolPeriods['Insert'] & Partial<LiveSchoolPeriodFields>
  Update: GeneratedSchoolPeriods['Update'] & Partial<LiveSchoolPeriodFields>
  Relationships: GeneratedSchoolPeriods['Relationships']
}
type LiveOccurrenceFields = {
  actual_teacher_id: string | null
  exception_reason: string | null
  unscheduled_plan_id: string | null
  completion_review: Record<string, unknown> | null
}
type LiveTimetableSlots = {
  Row: GeneratedTimetableSlots['Row'] & LiveTimetableSlotFields
  Insert: GeneratedTimetableSlots['Insert'] & Partial<LiveTimetableSlotFields>
  Update: GeneratedTimetableSlots['Update'] & Partial<LiveTimetableSlotFields>
  Relationships: GeneratedTimetableSlots['Relationships']
}
type LiveTeachingOccurrences = {
  Row: GeneratedTeachingOccurrences['Row'] & LiveOccurrenceFields
  Insert: GeneratedTeachingOccurrences['Insert'] & Partial<LiveOccurrenceFields>
  Update: GeneratedTeachingOccurrences['Update'] & Partial<LiveOccurrenceFields>
  Relationships: GeneratedTeachingOccurrences['Relationships']
}

type LiveTeacherSwapListing = {
  Row: {
    id: string; teacher_id: string; current_county: string; current_subcounty: string;
    preferred_county: string; preferred_subcounty: string | null;
    school_level: string; subject: string; employment_sector: string; status: string;
    created_at: string; updated_at: string
  }
  Insert: {
    id?: string; teacher_id: string; current_county: string; current_subcounty: string;
    preferred_county: string; preferred_subcounty?: string | null;
    school_level: string; subject?: string; employment_sector?: string; status?: string;
    created_at?: string; updated_at?: string
  }
  Update: {
    id?: string; teacher_id?: string; current_county?: string; current_subcounty?: string;
    preferred_county?: string; preferred_subcounty?: string | null;
    school_level?: string; subject?: string; employment_sector?: string; status?: string;
    created_at?: string; updated_at?: string
  }
  Relationships: []
}
type LiveTeacherSwapInterest = {
  Row: {
    id: string; listing_id: string; sender_id: string; message: string;
    contact_phone: string | null; status: string; created_at: string
  }
  Insert: {
    id?: string; listing_id: string; sender_id: string; message?: string;
    contact_phone?: string | null; status?: string; created_at?: string
  }
  Update: {
    id?: string; listing_id?: string; sender_id?: string; message?: string;
    contact_phone?: string | null; status?: string; created_at?: string
  }
  Relationships: [{ foreignKeyName: "teacher_swap_interests_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "teacher_swap_listings"; referencedColumns: ["id"] }]
}

type LiveTeacherSwapMessage = {
  Row: { id: string; interest_id: string; sender_id: string; body: string; created_at: string }
  Insert: { id?: string; interest_id: string; sender_id: string; body: string; created_at?: string }
  Update: { id?: string; interest_id?: string; sender_id?: string; body?: string; created_at?: string }
  Relationships: [{ foreignKeyName: "teacher_swap_messages_interest_id_fkey"; columns: ["interest_id"]; isOneToOne: false; referencedRelation: "teacher_swap_interests"; referencedColumns: ["id"] }]
}

type LiveTeacherSwapReport = {
  Row: { id: string; reporter_id: string; listing_id: string; target_teacher_id: string; reason: string; details: string; created_at: string }
  Insert: { id?: string; reporter_id: string; listing_id: string; target_teacher_id: string; reason: string; details?: string; created_at?: string }
  Update: { id?: string; reporter_id?: string; listing_id?: string; target_teacher_id?: string; reason?: string; details?: string; created_at?: string }
  Relationships: [{ foreignKeyName: "teacher_swap_reports_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "teacher_swap_listings"; referencedColumns: ["id"] }]
}

// Versioned KASNEB course and paper metadata, introduced by the canonical
// 20261115111910 catalogue migration. Keep types at this shared boundary.
type GeneratedCourses = Database['public']['Tables']['courses']
type GeneratedModules = Database['public']['Tables']['modules']
type ProfessionalCourseFields = {
  qualification_code: string | null
  qualifying_body: string | null
  syllabus_source_url: string | null
  syllabus_checked_on: string | null
}
type ProfessionalModuleFields = {
  qualification_level: string | null
  qualification_requirement: string | null
}
type LiveCourses = {
  Row: GeneratedCourses['Row'] & ProfessionalCourseFields
  Insert: GeneratedCourses['Insert'] & Partial<ProfessionalCourseFields>
  Update: GeneratedCourses['Update'] & Partial<ProfessionalCourseFields>
  Relationships: GeneratedCourses['Relationships']
}
type LiveModules = {
  Row: GeneratedModules['Row'] & ProfessionalModuleFields
  Insert: GeneratedModules['Insert'] & Partial<ProfessionalModuleFields>
  Update: GeneratedModules['Update'] & Partial<ProfessionalModuleFields>
  Relationships: GeneratedModules['Relationships']
}

type LiveLearnerEducationPath = {
  Row: {
    user_id: string
    education_stage: 'post_secondary'
    programme_family: 'professional_studies' | 'college' | 'university' | 'tvet'
    qualification_code: string
    examining_body: string | null
    qualification_level: string | null
    paper_code: string | null
    institution_name: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    user_id: string
    education_stage: 'post_secondary'
    programme_family: 'professional_studies' | 'college' | 'university' | 'tvet'
    qualification_code: string
    examining_body?: string | null
    qualification_level?: string | null
    paper_code?: string | null
    institution_name?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    user_id?: string
    education_stage?: 'post_secondary'
    programme_family?: 'professional_studies' | 'college' | 'university' | 'tvet'
    qualification_code?: string
    examining_body?: string | null
    qualification_level?: string | null
    paper_code?: string | null
    institution_name?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: []
}

type LiveDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      ce_get_publication_auto_review_state: {
        Args: { p_publication_id: string }
        Returns: {
          publication_status: string
          human_approval_required: boolean
          machine_review_commissioned: boolean
          exact_version_approved: boolean
          review_state: 'published' | 'release_approved' | 'machine_reviewer_not_commissioned' | 'independent_machine_review_pending'
        }
      }
      parent_start_child_thread: { Args: { p_student_id: string; p_staff_id: string; p_context_tag?: string }; Returns: string }
      vibechat_my_handle: { Args: Record<never, never>; Returns: string }
      vibechat_lookup_handle: { Args: { p_handle: string }; Returns: { handle: string; display_name: string; account_role: string; avatar_url: string | null }[] }
      vibechat_search_handles: { Args: { p_query: string }; Returns: { handle: string; display_name: string; account_role: string; avatar_url: string | null; username: string | null }[] }
      vibechat_open_or_request_contact: { Args: { p_handle: string }; Returns: string | null }
      vibechat_request_contact: { Args: { p_handle: string }; Returns: string }
      vibechat_my_contacts: { Args: Record<never, never>; Returns: { id: string; name: string; avatar_url: string | null; handle: string; direction: 'incoming' | 'outgoing'; status: 'pending' | 'accepted' | 'declined'; thread_id: string | null; created_at: string }[] }
      get_my_auth_access_state: { Args: Record<never, never>; Returns: { authenticated: boolean; role: string | null; account_status: string | null; is_anonymized: boolean; profile_complete?: boolean } }
      vibechat_my_inbox_state: { Args: Record<never, never>; Returns: { kind: 'vc' | 'tuition'; room_id: string; updated: string | null; preview: string | null; unread: number; latest_incoming_id: string | null; peer_online: boolean; peer_delivered_at: string | null; peer_read_at: string | null }[] }
      vibechat_presence_settings: { Args: { p_enabled?: boolean }; Returns: { eligible: boolean; enabled: boolean } }
      vibechat_presence_tick: { Args: Record<never, never>; Returns: boolean }
      vibechat_send_rich: { Args: { p_owner: string; p_kind: 'vc' | 'tuition'; p_room: string; p_operation: string; p_body: string; p_reply?: string | null }; Returns: string }
      vibechat_change_message: { Args: { p_kind: 'vc' | 'tuition'; p_room: string; p_message: string; p_action: string; p_value?: string | null }; Returns: boolean }
      vibechat_my_conversation_preferences: { Args: Record<never, never>; Returns: { kind: 'vc' | 'tuition'; room_id: string; pinned: boolean; archived: boolean; muted: boolean }[] }
      vibechat_set_conversation_preference: { Args: { p_kind: 'vc' | 'tuition'; p_room: string; p_setting: 'pinned' | 'archived' | 'muted'; p_value: boolean }; Returns: boolean }
      vibechat_notification_preferences: { Args: { p_enabled?: boolean }; Returns: boolean }
      vibechat_message_page: { Args: { p_kind: 'vc' | 'tuition'; p_room: string; p_before?: string | null; p_before_id?: string | null; p_query?: string | null }; Returns: { id: string; body: string; mine: boolean; created_at: string; deleted_at: string | null; edited_at: string | null; reply_to_id: string | null; reply_excerpt: string | null; reactions: { reaction: string; mine: boolean }[] }[] }
      vibechat_rich_messages: { Args: { p_kind: 'vc' | 'tuition'; p_room: string }; Returns: { id: string; body: string; mine: boolean; created_at: string; deleted_at: string | null; edited_at: string | null; reply_to_id: string | null; reply_excerpt: string | null; reactions: { reaction: string; mine: boolean }[] }[] }
      vibechat_send_once: { Args: { p_owner: string; p_kind: 'vc' | 'tuition'; p_room: string; p_operation: string; p_body: string }; Returns: string }
      vibechat_ack_message: { Args: { p_kind: string; p_room: string; p_message: string; p_read?: boolean }; Returns: boolean }
      vibechat_thread_safety: { Args: { p_kind: string; p_room: string }; Returns: { blocked: boolean; blocked_by_me: boolean } }
      vibechat_block_thread: { Args: { p_kind: string; p_room: string; p_block: boolean }; Returns: boolean }
      vibechat_report_thread: { Args: { p_kind: string; p_room: string; p_reason: string }; Returns: string }
      vibechat_my_school_families: { Args: Record<never, never>; Returns: { student_id: string; student_name: string; parent_id: string; parent_name: string; avatar_url: string | null }[] }
      vibechat_start_teacher_parent_thread: { Args: { p_student_id: string; p_parent_id: string; p_context_tag?: string }; Returns: string }
      vibechat_my_chat_peers: { Args: Record<never, never>; Returns: { thread_id: string; name: string; avatar_url: string | null; handle?: string | null }[] }
      vibechat_my_tuition_peers: { Args: Record<never, never>; Returns: { invitation_id: string; name: string; avatar_url: string | null; handle?: string | null }[] }
      vibechat_respond_contact: { Args: { p_request: string; p_accept: boolean }; Returns: string | null }
      vibetutor_create_student_invite: { Args: Record<never, never>; Returns: string }
      vibetutor_claim_student_invite: { Args: { p_token: string }; Returns: "accepted" | "pending_guardian" }
      vibetutor_parent_student_invites: { Args: Record<never, never>; Returns: { id: string; student: string; tutor: string; status: string }[] }
      vibetutor_decide_student_invite: { Args: { p_id: string; p_approve: boolean }; Returns: undefined }
      vibetutor_my_student_invites: { Args: Record<never, never>; Returns: { id: string; token: string | null; student: string | null; status: string; created_at: string }[] }
      vibetutor_revoke_student_invite: { Args: { p_id: string }; Returns: undefined }
      vibetutor_preview_student_invite: { Args: { p_token: string }; Returns: { available: boolean; tutor?: string } }
      vibetutor_my_student_code: { Args: Record<never, never>; Returns: string }
      vibetutor_invite_student_by_code: { Args: { p_code: string }; Returns: string }
      vibetutor_student_inbox: { Args: Record<never, never>; Returns: { id: string; tutor: string; status: string; created_at: string }[] }
      vibetutor_my_lessons: { Args: Record<never, never>; Returns: { id: string; invitation_id: string; title: string; starts_at: string; ends_at: string; status: string }[] }
      vibetutor_my_lesson_messages: { Args: { p_invitation: string }; Returns: { id: string; body: string; mine: boolean; created_at: string }[] }
      vibetutor_schedule_lesson: { Args: { p_invitation: string; p_title: string; p_start: string; p_end: string }; Returns: string }
      vibetutor_cancel_lesson: { Args: { p_lesson: string }; Returns: undefined }
      vibetutor_send_lesson_message: { Args: { p_invitation: string; p_body: string }; Returns: string }
      vibetutor_assign_private_task: { Args: { p_invitation: string; p_title: string; p_instructions?: string }; Returns: string }
      vibetutor_my_private_tasks: { Args: { p_invitation?: string | null }; Returns: { id: string; invitation_id: string; title: string; instructions: string; status: string; learner_note: string; tutor_feedback: string; created_at: string; completed_at: string | null; reviewed_at: string | null; is_tutor: boolean }[] }
      vibetutor_complete_private_task: { Args: { p_task: string; p_note?: string }; Returns: undefined }
      vibetutor_review_private_task: { Args: { p_task: string; p_feedback: string }; Returns: undefined }
      vibetutor_create_private_group: { Args: { p_title: string }; Returns: string }
      vibetutor_add_private_group_member: { Args: { p_group: string; p_invitation: string }; Returns: undefined }
      vibetutor_remove_private_group_member: { Args: { p_group: string; p_invitation: string }; Returns: undefined }
      vibetutor_assign_private_group_task: { Args: { p_group: string; p_title: string; p_instructions?: string }; Returns: number }
      vibetutor_my_private_groups: { Args: Record<never, never>; Returns: { id: string; title: string; members: { invitation_id: string; student: string }[] }[] }
      vibetutor_respond_student_invite: { Args: { p_id: string; p_accept: boolean }; Returns: "accepted" | "pending_guardian" | "declined" }
      preview_timetable_conflicts: { Args: { p_school_id: string; p_teacher_id: string; p_class_id: string; p_subject_id: string; p_day_of_week: number; p_start_time: string; p_end_time: string; p_room?: string | null; p_effective_from?: string | null; p_effective_until?: string | null; p_exclude_slot_id?: string | null }; Returns: { conflict_type: string; conflicting_slot_id: string; conflicting_teacher_id: string | null; conflicting_class_id: string; conflicting_subject_id: string; conflicting_room: string | null; detail: string }[] }
      get_published_class_timetable: { Args: { p_class_id: string; p_on?: string | null }; Returns: LiveTimetableSlots['Row'][] }
      get_published_teacher_timetable: { Args: { p_teacher_id: string; p_on?: string | null }; Returns: LiveTimetableSlots['Row'][] }
      apply_teacher_absence: { Args: { p_absence_id: string }; Returns: number }
      assign_occurrence_substitute: { Args: { p_occurrence_id: string; p_substitute_teacher_id: string; p_reason?: string | null }; Returns: LiveTeachingOccurrences['Row'] }
      attach_active_slots_to_release: { Args: { p_release_id: string }; Returns: number }
      transition_timetable_release: { Args: { p_release_id: string; p_target: string }; Returns: Record<string, string | number | boolean | null> }
      get_my_school_day_blocks: { Args: Record<never, never>; Returns: { id: string; school_id: string; schedule_day: number; period_number: number; label: string; start_time: string; end_time: string; kind: string; protected: boolean }[] }
      suggest_school_timetable_candidates: { Args: { p_school_id: string; p_class_id: string; p_subject_id: string; p_teacher_id: string; p_effective_on?: string | null }; Returns: { day_of_week: number; period_id: string; start_time: string; end_time: string; score: number; explanation: string }[] }
      finalize_teaching_occurrence: { Args: { p_timetable_slot_id: string; p_occurrence_date: string; p_outcome: string; p_what_was_taught: string; p_challenges?: string | null; p_teacher_remarks?: string | null; p_next_steps?: string | null }; Returns: { occurrence_id: string; progress_record_id: string; scheme_id: string | null; scheme_status: string | null }[] }
      start_unscheduled_teaching: { Args: { p_draft_id: string }; Returns: { id: string; unscheduled_plan_id: string; occurrence_date: string; school_id: string; teacher_id: string; class_id: string; subject_id: string; timetable_slot_id: null; lifecycle: string } }
      complete_unscheduled_teaching: { Args: { p_occurrence_id: string; p_coverage: string; p_what_taught: string; p_reflection: string; p_attendance_reason: string; p_evidence_reason: string; p_next_steps?: string | null }; Returns: { id: string; lifecycle: string; completed_at: string | null } }
    }
    Tables: Omit<Database['public']['Tables'], 'homework' | 'timetable_slots' | 'teaching_occurrences' | 'school_periods' | 'courses' | 'modules'> & {
      homework: LiveHomeworkTable
      courses: LiveCourses
      modules: LiveModules
      learner_education_paths: LiveLearnerEducationPath
      timetable_slots: LiveTimetableSlots
      teaching_occurrences: LiveTeachingOccurrences
      school_periods: LiveSchoolPeriods
      teacher_swap_listings: LiveTeacherSwapListing
      teacher_swap_interests: LiveTeacherSwapInterest
      teacher_swap_messages: LiveTeacherSwapMessage
      teacher_swap_reports: LiveTeacherSwapReport
    }
  }
}

export function createSupabaseClient() {
  return createBrowserClient<LiveDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 7,
      },
      cookieEncoding: "raw",
    }
  )
}

type TypedBrowserClient = ReturnType<typeof createBrowserClient<LiveDatabase>>
type LiveSchemaCompatClient = TypedBrowserClient & {
  from(relation: string): any
  rpc(fn: string, args?: Record<string, unknown>): any
}

let client: TypedBrowserClient | null = null

export function getSupabaseClient() {
  if (!client) client = createSupabaseClient()
  return client
}

function activeBrowserClient(): any {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/hq')) {
    return getHQSupabaseClient()
  }
  return getSupabaseClient()
}

// Compatibility proxy: legacy HQ browser surfaces historically imported the shared
// client. Resolve the client at call time so /hq always uses the isolated HQ session,
// while every non-HQ route continues to use the normal application session. This also
// remains correct across client-side navigation because the pathname is checked for
// every property access rather than when the module singleton is first created.
export const supabase = new Proxy({} as LiveSchemaCompatClient, {
  get(_target, prop) {
    const active = activeBrowserClient()
    const value = active[prop as keyof typeof active]
    return typeof value === 'function' ? value.bind(active) : value
  },
})

export async function getTeacherProfile(userId: string) {
  const sb = getSupabaseClient()
  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('full_name, phone, school_id, schools(name)')
    .eq('id', userId)
    .single()
  if (profileErr) { console.error('getTeacherProfile error:', profileErr); return null }

  const joinedSchool = Array.isArray(profile?.schools)
    ? profile.schools[0] ?? null
    : profile?.schools ?? null

  return {
    name:   profile?.full_name ?? '',
    school: joinedSchool?.name ?? '',
    phone:  profile?.phone ?? '',
  }
}

export async function updateTeacherProfile(userId: string, updates: {
  name?: string
  phone?: string
}) {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('profiles')
    .update({
      full_name: updates.name,
      phone:     updates.phone,
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) console.error('updateTeacherProfile error:', error)
  return data
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!