import { getSupabaseClient } from '@/lib/supabase'
import { codeFromAvatar, vibeMePath, defaultCharacter } from '@/lib/vibeme'
import type { DayPart, DemoRequest, DemoTutor, Mode } from './data'
import type { DiscoveryProfile } from './discovery'

// Live listings only. A failed read is an error, never an empty result or demo fallback.

type TutorRow = {
  profile_id: string; display_name: string; levels: string[]; subjects: string[]
  teaching_mode: Mode; area: string | null; rate_kes: number | null; available_days: string[]
  dayparts: string[]; holiday_available: boolean; bio: string | null; avatar_url?: string | null
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
  learnerPreference?: DiscoveryProfile
  tutorPreference?: DiscoveryProfile
  ownRequestIds?: string[]
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
  let ownRows: Pick<RequestRow, 'id' | 'levels' | 'subjects' | 'teaching_mode' | 'area' | 'budget_kes' | 'available_days'>[] = []

  // The open-requests view is intentionally restricted to authenticated users.
  if (signedIn) {
    const requestsRes = await client.from('vibetutor_open_requests').select('*').order('created_at', { ascending: false })
    if (requestsRes.error) throw new Error('Learner requests could not be loaded.')
    requestRows = (requestsRes.data ?? []) as RequestRow[]
    const uid = sessionRes.data.session?.user.id
    if (uid) {
      // Owner-scoped read, using existing RLS. Never request phone or learner identity.
      const own = await client.from('vibetutor_requests')
        .select('id,levels,subjects,teaching_mode,area,budget_kes,available_days')
        .eq('requester_id', uid).eq('status', 'open').order('created_at', { ascending: false }).limit(50)
      if (!own.error) ownRows = own.data ?? []
    }
  }

  const tutors: DemoTutor[] = ((tutorsRes.data ?? []) as TutorRow[]).map(row => ({
    id: row.profile_id, name: row.display_name, initials: initialsOf(row.display_name), avatarUrl: vibeMePath(codeFromAvatar(row.avatar_url) ?? defaultCharacter(row.profile_id)),
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
  const own = ownRows[0]
  const myTutor = tutors.find(t => t.id === sessionRes.data.session?.user.id)
  return {
    tutors, requests, signedIn, ownRequestIds: ownRows.map(row => row.id),
    learnerPreference: own ? { subjects: own.subjects, levels: own.levels, days: own.available_days, area: own.area ?? '', mode: own.teaching_mode, amount: own.budget_kes ?? 0 } : undefined,
    tutorPreference: myTutor ? { subjects: myTutor.subjects, levels: myTutor.levels, days: myTutor.days, area: myTutor.area, mode: myTutor.mode, amount: myTutor.rateKes } : undefined,
  }
}

export async function saveTutorListing(input: {
  name: string; levels: string[]; subjects: string[]; mode: Mode; area: string
  rate: string; days: string[]; phone: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabaseClient()
  const { data: userData, error: authError } = await client.auth.getUser()
  if (authError) return { ok: false, error: 'We could not verify your sign-in. Please try again.' }
  if (!userData.user) return { ok: false, error: 'Sign in to publish your listing.' }
  // Tutor public identity follows the verified Teacher OS account, not
  // a separately typed form value or stale local draft.
  const { data: profile, error: profileError } = await client.from('profiles')
    .select('full_name,role').eq('id', userData.user.id).maybeSingle()
  const officialName = profile?.full_name?.trim()
  if (profileError || profile?.role !== 'teacher' || !officialName)
    return { ok: false, error: 'Complete your teacher account name before publishing a tutor profile.' }
  const { error } = await client.from('vibetutor_tutors').upsert({
    profile_id: userData.user.id, display_name: officialName, levels: input.levels,
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
