import { getSupabaseClient } from '@/lib/supabase'
import type { DayPart, DemoRequest, DemoTutor, Mode } from './data'

// The generated database types do not include the VibeTutor tables yet, so
// these calls use an untyped view of the same client. Row shapes are checked below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function untypedClient() {
  return getSupabaseClient() as unknown as { from: (table: string) => any; auth: ReturnType<typeof getSupabaseClient>['auth'] }
}

// Live listings from the VibeTutor database. Rows are mapped to the shapes
// the cards already render. Demo examples are used only when there are none.

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

export async function fetchLiveListings(): Promise<{ tutors: DemoTutor[]; requests: DemoRequest[] }> {
  const client = untypedClient()
  const [tutorsRes, requestsRes] = await Promise.all([
    client.from('vibetutor_public_tutors').select('*').order('created_at', { ascending: false }),
    client.from('vibetutor_open_requests').select('*').order('created_at', { ascending: false }),
  ])
  const tutors: DemoTutor[] = ((tutorsRes.data ?? []) as TutorRow[]).map(row => ({
    id: row.profile_id, name: row.display_name, initials: initialsOf(row.display_name),
    subjects: row.subjects, levels: row.levels, mode: row.teaching_mode, area: row.area ?? '',
    rateKes: row.rate_kes ?? 0, holidayAvailable: row.holiday_available, days: row.available_days,
    bio: row.bio ?? '', experience: '', formatNote: '', real: true,
  }))
  const requests: DemoRequest[] = ((requestsRes.data ?? []) as RequestRow[]).map(row => ({
    id: row.id, learnerLabel: row.learner_label, subjects: row.subjects, level: row.levels[0] ?? '',
    mode: row.teaching_mode, area: row.area ?? '', budgetKes: row.budget_kes ?? 0,
    days: row.available_days, dayparts: row.dayparts as DayPart[],
    postedDaysAgo: Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000)),
    note: row.note ?? '', real: true,
  }))
  return { tutors, requests }
}

export async function saveTutorListing(input: {
  name: string; levels: string[]; subjects: string[]; mode: Mode; area: string
  rate: string; days: string[]; phone: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = untypedClient()
  const { data: userData } = await client.auth.getUser()
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
  const client = untypedClient()
  const { data: userData } = await client.auth.getUser()
  if (!userData.user) return { ok: false, error: 'Sign in to post your request.' }
  const { error } = await client.from('vibetutor_requests').insert({
    requester_id: userData.user.id, learner_label: input.learner.trim() || 'Learner',
    levels: input.levels, subjects: input.subjects, teaching_mode: input.mode,
    area: input.area || null, budget_kes: Number(input.budget) || null,
    available_days: input.days, phone: input.phone, status: 'open', source: 'vibetutor',
  })
  return error ? { ok: false, error: 'Your request could not be posted. Please try again.' } : { ok: true }
}
