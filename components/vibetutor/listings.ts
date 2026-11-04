import { getSupabaseClient } from '@/lib/supabase'
import type { DayPart, DemoRequest, DemoTutor, Mode } from './data'

// Live listings only. A failed read is an error, never an empty result or demo fallback.

type TutorRow = {
  profile_id: string; display_name: string; levels: string[]; subjects: string[]
  teaching_mode: Mode; area: string | null; rate_kes: number | null; available_days: string[]
  dayparts: string[]; holiday_available: boolean; bio: string | null
}
type RequestRow = {
  id: string; learner_label: string; note: string | null; levels: string[]; subjects: string[]
  teaching_mode: Mode; area: string | null; budget_kes: number | null; available_days: string[]
  dayparts: string[]; created_at: string
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'VT'
}

export type LiveListings = {
  tutors: DemoTutor[]
  requests: DemoRequest[]
  signedIn: boolean
}

export async function fetchLiveListings(): Promise<LiveListings> {
  const client = getSupabaseClient()
  const [tutorsRes, sessionRes] = await Promise.all([
    client.from('vibetutor_public_tutors').select('*').order('created_at', { ascending: false }),
    client.auth.getSession(),
  ])

  if (tutorsRes.error) throw new Error('Tutor listings could not be loaded.')
  if (sessionRes.error) throw new Error('Your sign-in status could not be checked.')

  const signedIn = !!sessionRes.data.session
  let requestRows: RequestRow[] = []

  // The open-requests view is intentionally restricted to authenticated users.
  if (signedIn) {
    const requestsRes = await client.from('vibetutor_open_requests').select('*').order('created_at', { ascending: false })
    if (requestsRes.error) throw new Error('Learner requests could not be loaded.')
    requestRows = (requestsRes.data ?? []) as RequestRow[]
  }

  const tutors: DemoTutor[] = ((tutorsRes.data ?? []) as TutorRow[]).map(row => ({
    id: row.profile_id, name: row.display_name, initials: initialsOf(row.display_name),
    subjects: row.subjects, levels: row.levels, mode: row.teaching_mode, area: row.area ?? '',
    rateKes: row.rate_kes ?? 0, holidayAvailable: row.holiday_available, days: row.available_days,
    bio: row.bio ?? '', experience: '', formatNote: '', real: true,
  }))
  const requests: DemoRequest[] = requestRows.map(row => ({
    id: row.id, learnerLabel: row.learner_label, subjects: row.subjects, level: row.levels[0] ?? '',
    mode: row.teaching_mode, area: row.area ?? '', budgetKes: row.budget_kes ?? 0,
    days: row.available_days, dayparts: row.dayparts as DayPart[],
    postedDaysAgo: Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000)),
    note: row.note ?? '', real: true,
  }))
  return { tutors, requests, signedIn }
}

export async function saveTutorListing(input: {
  name: string; levels: string[]; subjects: string[]; mode: Mode; area: string
  rate: string; days: string[]; phone: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabaseClient()
  const { data: userData, error: authError } = await client.auth.getUser()
  if (authError) return { ok: false, error: 'We could not verify your sign-in. Please try again.' }
  if (!userData.user) return { ok: false, error: 'Sign in to publish your listing.' }
  const { error } = await client.from('vibetutor_tutors').upsert({
    profile_id: userData.user.id, display_name: input.name.trim(), levels: input.levels,
    subjects: input.subjects, teaching_mode: input.mode, area: input.area || null,
    rate_kes: Number(input.rate) || null, available_days: input.days, phone: input.phone,
    status: 'published', updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id' })
  return error ? { ok: false, error: 'Your listing could not be saved. Please try again.' } : { ok: true }
}

export async function saveLearnerRequest(input: {
  learner: string; levels: string[]; subjects: string[]; mode: Mode; area: string
  budget: string; days: string[]; phone: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabaseClient()
  const { data: userData, error: authError } = await client.auth.getUser()
  if (authError) return { ok: false, error: 'We could not verify your sign-in. Please try again.' }
  if (!userData.user) return { ok: false, error: 'Sign in to post your request.' }
  const { error } = await client.from('vibetutor_requests').insert({
    requester_id: userData.user.id, learner_label: input.learner.trim() || 'Learner',
    levels: input.levels, subjects: input.subjects, teaching_mode: input.mode,
    area: input.area || null, budget_kes: Number(input.budget) || null,
    available_days: input.days, phone: input.phone, status: 'open', source: 'vibetutor',
  })
  return error ? { ok: false, error: 'Your request could not be posted. Please try again.' } : { ok: true }
}
