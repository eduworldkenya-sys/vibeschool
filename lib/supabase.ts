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

type LiveDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      preview_timetable_conflicts: { Args: { p_school_id: string; p_teacher_id: string; p_class_id: string; p_subject_id: string; p_day_of_week: number; p_start_time: string; p_end_time: string; p_room?: string | null; p_effective_from?: string | null; p_effective_until?: string | null; p_exclude_slot_id?: string | null }; Returns: { conflict_type: string; conflicting_slot_id: string; conflicting_teacher_id: string | null; conflicting_class_id: string; conflicting_subject_id: string; conflicting_room: string | null; detail: string }[] }
      get_published_class_timetable: { Args: { p_class_id: string; p_on?: string | null }; Returns: LiveTimetableSlots['Row'][] }
      get_published_teacher_timetable: { Args: { p_teacher_id: string; p_on?: string | null }; Returns: LiveTimetableSlots['Row'][] }
      apply_teacher_absence: { Args: { p_absence_id: string }; Returns: number }
      assign_occurrence_substitute: { Args: { p_occurrence_id: string; p_substitute_teacher_id: string; p_reason?: string | null }; Returns: LiveTeachingOccurrences['Row'] }
      attach_active_slots_to_release: { Args: { p_release_id: string }; Returns: number }
      transition_timetable_release: { Args: { p_release_id: string; p_target: string }; Returns: Record<string, string | number | boolean | null> }
      get_my_school_day_blocks: { Args: Record<never, never>; Returns: { id: string; school_id: string; schedule_day: number; period_number: number; label: string; start_time: string; end_time: string; kind: string; protected: boolean }[] }
      suggest_school_timetable_candidates: { Args: { p_school_id: string; p_class_id: string; p_subject_id: string; p_teacher_id: string; p_effective_on?: string | null }; Returns: { day_of_week: number; period_id: string; start_time: string; end_time: string; score: number; explanation: string }[] }
    }
    Tables: Omit<Database['public']['Tables'], 'homework' | 'timetable_slots' | 'teaching_occurrences' | 'school_periods'> & {
      homework: LiveHomeworkTable
      timetable_slots: LiveTimetableSlots
      teaching_occurrences: LiveTeachingOccurrences
      school_periods: LiveSchoolPeriods
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