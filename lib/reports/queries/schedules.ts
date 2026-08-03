import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

const REPORT_FREQUENCIES = [
  'daily',
  'weekly',
  'end_of_term',
] as const

type ReportFrequency = typeof REPORT_FREQUENCIES[number]

function isReportFrequency(value: string): value is ReportFrequency {
  return REPORT_FREQUENCIES.includes(value as ReportFrequency)
}

function normalizeFilters(value: Json): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return {}
  }

  return value
}

export interface ReportSchedule {
  id: string
  school_id: string
  created_by: string
  report_type: string
  frequency: ReportFrequency
  filters: Record<string, unknown>
  recipients: string[]
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at: string
}

function normalizeSchedule(
  row: {
    id: string
    school_id: string
    created_by: string
    report_type: string
    frequency: string
    filters: Json
    recipients: string[]
    is_active: boolean
    last_run_at: string | null
    next_run_at: string | null
    created_at: string
  }
): ReportSchedule | null {
  if (!isReportFrequency(row.frequency)) return null

  return {
    id: row.id,
    school_id: row.school_id,
    created_by: row.created_by,
    report_type: row.report_type,
    frequency: row.frequency,
    filters: normalizeFilters(row.filters),
    recipients: row.recipients,
    is_active: row.is_active,
    last_run_at: row.last_run_at,
    next_run_at: row.next_run_at,
    created_at: row.created_at,
  }
}

export async function getSchedules(
  schoolId: string
): Promise<ReportSchedule[]> {
  const { data, error } = await supabase
    .from('report_schedules')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).flatMap(row => {
    const normalized = normalizeSchedule(row)
    return normalized ? [normalized] : []
  })
}

export async function createSchedule(
  payload: Omit<
    ReportSchedule,
    'id' | 'last_run_at' | 'next_run_at' | 'created_at'
  >
): Promise<ReportSchedule> {
  const { data, error } = await supabase
    .from('report_schedules')
    .insert({
      school_id: payload.school_id,
      created_by: payload.created_by,
      report_type: payload.report_type,
      frequency: payload.frequency,
      filters: payload.filters as Json,
      recipients: payload.recipients,
      is_active: payload.is_active,
    })
    .select()
    .single()

  if (error) throw error

  const normalized = normalizeSchedule(data)
  if (!normalized) {
    throw new Error('Invalid report schedule returned')
  }

  return normalized
}

export async function toggleSchedule(
  id: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('report_schedules')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('report_schedules')
    .delete()
    .eq('id', id)

  if (error) throw error
}
