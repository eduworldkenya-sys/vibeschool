import { supabase } from '@/lib/supabase'
import type { AttendanceRecord, AttendanceRangeSummary } from '@/lib/types'

interface GetAttendanceRecordsParams {
  classId?: string
  studentId?: string
  startDate: string
  endDate: string
}

export async function getAttendanceRecords(
  params: GetAttendanceRecordsParams
): Promise<AttendanceRecord[]> {
  const { classId, studentId, startDate, endDate } = params
  if (!classId && !studentId) return []

  let query = supabase
    .from('attendance')
    .select('id, student_id, class_id, date, status, is_late, notes')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (classId)   query = query.eq('class_id', classId)
  if (studentId) query = query.eq('student_id', studentId)

  const { data, error } = await query
  if (error) {
    console.error('getAttendanceRecords error:', error)
    return []
  }
  return (data ?? []) as AttendanceRecord[]
}

export function summarizeAttendance(records: AttendanceRecord[]): AttendanceRangeSummary {
  const total   = records.length
  const present = records.filter(r => r.status === 'present').length
  const absent  = records.filter(r => r.status === 'absent').length
  const late    = records.filter(r => r.is_late).length
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0
  return { total, present, absent, late, rate }
}

export function summarizeByStudent(
  records: AttendanceRecord[]
): Record<string, AttendanceRangeSummary> {
  const byStudent: Record<string, AttendanceRecord[]> = {}
  records.forEach(r => {
    if (!byStudent[r.student_id]) byStudent[r.student_id] = []
    byStudent[r.student_id].push(r)
  })
  const result: Record<string, AttendanceRangeSummary> = {}
  Object.keys(byStudent).forEach(sid => {
    result[sid] = summarizeAttendance(byStudent[sid])
  })
  return result
}
