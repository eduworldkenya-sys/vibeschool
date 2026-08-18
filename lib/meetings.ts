import { supabase } from './supabase'
import type { Database } from './application-database.types'

type MeetingInsert = Database['public']['Tables']['meetings']['Insert']
type MeetingUpdate = Database['public']['Tables']['meetings']['Update']
type AgendaItemInsert = Database['public']['Tables']['meeting_agenda_items']['Insert']
type MeetingActionInsert = Database['public']['Tables']['meeting_actions']['Insert']

export async function getMeetings(schoolId: string) {
  const { data, error } = await supabase
    .from('meetings')
    .select(`
      *,
      chair:profiles!meetings_chair_id_fkey(id, full_name),
      secretary:profiles!meetings_secretary_id_fkey(id, full_name),
      attendees:meeting_attendees(count),
      actions:meeting_actions(count)
    `)
    .eq('school_id', schoolId)
    .order('scheduled_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getMeeting(id: string) {
  const { data, error } = await supabase
    .from('meetings')
    .select(`
      *,
      chair:profiles!meetings_chair_id_fkey(id, full_name),
      secretary:profiles!meetings_secretary_id_fkey(id, full_name),
      agenda_items:meeting_agenda_items(* , presenter:profiles(id, full_name)),
      attendees:meeting_attendees(*, profile:profiles(id, full_name, avatar_url)),
      actions:meeting_actions(*,  owner:profiles(id, full_name)),
      minutes:meeting_minutes(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createMeeting(payload: MeetingInsert) {
  const { data, error } = await supabase
    .from('meetings')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMeeting(id: string, payload: MeetingUpdate) {
  const { data, error } = await supabase
    .from('meetings')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMeeting(id: string) {
  const { error } = await supabase.from('meetings').delete().eq('id', id)
  if (error) throw error
}

// ── Agenda ──────────────────────────────────────────────────────────────────
export async function upsertAgendaItem(item: AgendaItemInsert) {
  const { data, error } = await supabase
    .from('meeting_agenda_items')
    .upsert(item)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAgendaItem(id: string) {
  const { error } = await supabase.from('meeting_agenda_items').delete().eq('id', id)
  if (error) throw error
}

// ── Attendees ────────────────────────────────────────────────────────────────
export async function upsertAttendee(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('meeting_attendees')
    .upsert(payload, { onConflict: 'meeting_id,profile_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRSVP(meetingId: string, profileId: string, rsvp: string) {
  const { error } = await supabase
    .from('meeting_attendees')
    .update({ rsvp })
    .eq('meeting_id', meetingId)
    .eq('profile_id', profileId)
  if (error) throw error
}

export async function markAttendance(meetingId: string, profileId: string, attended: boolean) {
  const { error } = await supabase
    .from('meeting_attendees')
    .update({ attended })
    .eq('meeting_id', meetingId)
    .eq('profile_id', profileId)
  if (error) throw error
}

// ── Actions ──────────────────────────────────────────────────────────────────
export async function upsertAction(payload: MeetingActionInsert) {
  const { data, error } = await supabase
    .from('meeting_actions')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateActionStatus(id: string, status: string) {
  const { error } = await supabase
    .from('meeting_actions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Minutes ──────────────────────────────────────────────────────────────────
export async function upsertMinutes(payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('meeting_minutes')
    .upsert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function approveMinutes(id: string, approverId: string) {
  const { error } = await supabase
    .from('meeting_minutes')
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}
