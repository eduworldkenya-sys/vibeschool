import { supabase } from '@/lib/supabase'

export interface ReportSchedule {
  id: string
  school_id: string
  created_by: string
  report_type: string
  frequency: 'daily' | 'weekly' | 'end_of_term'
  filters: Record<string, unknown>
  recipients: string[]
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at: string
}

export async function getSchedules(schoolId: string): Promise<ReportSchedule[]> {
  const { data, error } = await supabase
    .from('report_schedules')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createSchedule(
  payload: Omit<ReportSchedule, 'id' | 'last_run_at' | 'next_run_at' | 'created_at'>
): Promise<ReportSchedule> {
  const { data, error } = await supabase
    .from('report_schedules')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleSchedule(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('report_schedules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
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
