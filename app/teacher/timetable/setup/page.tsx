"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, Btn, C, SectionLabel } from '@/components/teacher/ui'

interface SchoolChoice {
  id: string
  name: string
  status?: string | null
}

interface SchoolContext {
  active_school_id?: string | null
  schools?: SchoolChoice[]
}

interface SchoolPeriodRow {
  id: string
  school_id: string
  schedule_day: number
  period_number: number
  label: string
  start_time: string
  end_time: string
  kind: string
  protected: boolean
}

interface DurationRow {
  id: string
  school_id: string
  grade_label: string
  duration_minutes: number
}

const DAYS = [
  { value: 0, label: 'Every school day' },
  { value: 1, label: 'Monday only' },
  { value: 2, label: 'Tuesday only' },
  { value: 3, label: 'Wednesday only' },
  { value: 4, label: 'Thursday only' },
  { value: 5, label: 'Friday only' },
  { value: 6, label: 'Saturday only' },
  { value: 7, label: 'Sunday only' },
]

const KINDS = [
  ['lesson', 'Teaching period'],
  ['break', 'Break'],
  ['lunch', 'Lunch'],
  ['assembly', 'Assembly'],
  ['games', 'Games'],
  ['club', 'Club'],
  ['prep', 'Prep'],
  ['guidance', 'Guidance'],
  ['examination', 'Examination'],
  ['school_event', 'School event'],
  ['free', 'Free period'],
  ['custom', 'Other'],
] as const

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: 10,
  background: C.surface,
  color: C.textPrimary,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function formatTime(value: string) {
  return value?.slice(0, 5) || '--:--'
}

export default function TimetableSetupPage() {
  const router = useRouter()
  const [schools, setSchools] = useState<SchoolChoice[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [periods, setPeriods] = useState<SchoolPeriodRow[]>([])
  const [durations, setDurations] = useState<DurationRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [periodId, setPeriodId] = useState<string | null>(null)
  const [scheduleDay, setScheduleDay] = useState('0')
  const [label, setLabel] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('08:40')
  const [kind, setKind] = useState('lesson')
  const [protectedBlock, setProtectedBlock] = useState(false)

  const [gradeLabel, setGradeLabel] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('40')

  const selectedSchool = schools.find(school => school.id === selectedSchoolId) ?? null

  const loadSchool = useCallback(async (schoolId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [blocksRes, durationRes, manageRes] = await Promise.all([
        supabase.rpc('get_school_day_blocks_for_member', { p_school_id: schoolId }),
        supabase
          .from('school_lesson_duration_defaults')
          .select('id,school_id,grade_label,duration_minutes')
          .eq('school_id', schoolId)
          .order('grade_label'),
        supabase.rpc('can_manage_my_school_timetable', { p_school_id: schoolId }),
      ])

      if (blocksRes.error) throw blocksRes.error
      if (durationRes.error && !/relation .*school_lesson_duration_defaults.* does not exist/i.test(String(durationRes.error.message ?? ''))) {
        throw durationRes.error
      }
      if (manageRes.error) throw manageRes.error

      setPeriods((blocksRes.data ?? []) as SchoolPeriodRow[])
      setDurations((durationRes.data ?? []) as DurationRow[])
      setCanManage(Boolean(manageRes.data))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load school-day setup.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      setLoading(true)
      setError(null)
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) {
          router.replace('/?role=teacher')
          return
        }

        const { data, error } = await supabase.rpc('get_my_teacher_school_context')
        if (error) throw error
        const context = data as SchoolContext | null
        const choices = (context?.schools ?? []).filter(school => school.id && school.name)
        const active = context?.active_school_id ?? choices[0]?.id ?? ''
        if (!active) throw new Error('Connect a school before setting up the school day.')

        if (cancelled) return
        setSchools(choices)
        setSelectedSchoolId(active)
        await loadSchool(active)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load school-day setup.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [router, loadSchool])

  const groupedPeriods = useMemo(() => {
    const groups = new Map<number, SchoolPeriodRow[]>()
    for (const period of periods) {
      const group = groups.get(period.schedule_day) ?? []
      group.push(period)
      groups.set(period.schedule_day, group)
    }
    for (const group of groups.values()) group.sort((a, b) => a.start_time.localeCompare(b.start_time))
    return groups
  }, [periods])

  function resetPeriodForm() {
    setPeriodId(null)
    setScheduleDay('0')
    setLabel('')
    setStartTime('08:00')
    setEndTime('08:40')
    setKind('lesson')
    setProtectedBlock(false)
  }

  function editPeriod(period: SchoolPeriodRow) {
    setPeriodId(period.id)
    setScheduleDay(String(period.schedule_day))
    setLabel(period.label)
    setStartTime(formatTime(period.start_time))
    setEndTime(formatTime(period.end_time))
    setKind(period.kind)
    setProtectedBlock(period.protected)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function savePeriod() {
    if (!selectedSchoolId || !canManage || busy) return
    if (!label.trim()) {
      setError('Give this part of the school day a name.')
      return
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.')
      return
    }

    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { error } = await supabase.rpc('save_school_period_block', {
        p_period_id: periodId,
        p_school_id: selectedSchoolId,
        p_schedule_day: Number(scheduleDay),
        p_label: label.trim(),
        p_start_time: startTime,
        p_end_time: endTime,
        p_kind: kind,
        p_protected: protectedBlock || kind !== 'lesson',
      })
      if (error) throw error
      setNotice(periodId ? 'School-day block updated.' : 'School-day block added.')
      resetPeriodForm()
      await loadSchool(selectedSchoolId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save school-day block.'
      setError(message.includes('SCHOOL_PERIOD_OVERLAP')
        ? 'That time overlaps another school-day block. Edit the existing block or choose a free time.'
        : message)
    } finally {
      setBusy(false)
    }
  }

  async function deletePeriod(period: SchoolPeriodRow) {
    if (!canManage || busy) return
    if (!window.confirm(`Remove ${period.label} from the school day?`)) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { error } = await supabase.rpc('delete_school_period_block', { p_period_id: period.id })
      if (error) throw error
      setNotice('School-day block removed.')
      if (periodId === period.id) resetPeriodForm()
      await loadSchool(selectedSchoolId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not remove school-day block.'
      setError(message.includes('PERIOD_IN_USE')
        ? 'This teaching period is already used by active timetable lessons. Edit its time instead of deleting it.'
        : message)
    } finally {
      setBusy(false)
    }
  }

  async function saveDuration() {
    if (!selectedSchoolId || !canManage || busy) return
    const minutes = Number(durationMinutes)
    if (!gradeLabel.trim()) {
      setError('Enter the grade or level this duration applies to.')
      return
    }
    if (!Number.isFinite(minutes) || minutes < 20 || minutes > 120) {
      setError('Choose a lesson duration between 20 and 120 minutes.')
      return
    }

    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { error } = await supabase.rpc('set_school_lesson_duration_default', {
        p_school_id: selectedSchoolId,
        p_grade_label: gradeLabel.trim(),
        p_duration_minutes: minutes,
      })
      if (error) throw error
      setGradeLabel('')
      setNotice('Grade lesson duration saved.')
      await loadSchool(selectedSchoolId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save lesson duration.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 14 }}>
      <div>
        <button
          type="button"
          onClick={() => router.push('/teacher/timetable')}
          style={{ border: 0, background: 'transparent', color: C.accent, fontWeight: 800, padding: 0 }}
        >
          ← Timetable
        </button>
        <h1 style={{ margin: '10px 0 4px', fontSize: 22, color: C.textPrimary }}>School day setup</h1>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>
          Define the real teaching periods, breaks and grade-specific lesson lengths used by your school. Timetable creation will use these times instead of inventing a 55- or 60-minute lesson.
        </p>
      </div>

      {schools.length > 1 && (
        <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800, color: C.textMuted }}>
          School
          <select
            value={selectedSchoolId}
            onChange={async e => {
              setSelectedSchoolId(e.target.value)
              resetPeriodForm()
              await loadSchool(e.target.value)
            }}
            style={fieldStyle}
          >
            {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </label>
      )}

      {error && <div role="alert" style={{ padding: 11, borderRadius: 12, background: '#fef2f2', color: '#991b1b', fontSize: 12 }}>{error}</div>}
      {notice && <div role="status" style={{ padding: 11, borderRadius: 12, background: '#ecfdf5', color: '#065f46', fontSize: 12 }}>{notice}</div>}

      {!loading && !canManage && (
        <div style={{ padding: 12, borderRadius: 12, background: '#fffbeb', color: '#92400e', fontSize: 12, lineHeight: 1.5 }}>
          You can view {selectedSchool?.name ?? 'this school'}’s timetable rules. Only a school administrator can change school-wide periods and grade durations.
        </div>
      )}

      {canManage && (
        <Card>
          <SectionLabel>{periodId ? 'Edit school-day block' : 'Add school-day block'}</SectionLabel>
          <div style={{ display: 'grid', gap: 10 }}>
            <select value={scheduleDay} onChange={e => setScheduleDay(e.target.value)} style={fieldStyle}>
              {DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Period 1, Break, Lunch" style={fieldStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={fieldStyle} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={fieldStyle} />
            </div>
            <select value={kind} onChange={e => setKind(e.target.value)} style={fieldStyle}>
              {KINDS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
            <label style={{ fontSize: 12, color: C.textPrimary }}>
              <input type="checkbox" checked={protectedBlock} onChange={e => setProtectedBlock(e.target.checked)} /> Protect this block from lesson placement
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={savePeriod} disabled={busy}>{busy ? 'Saving…' : periodId ? 'Save changes' : 'Add block'}</Btn>
              {periodId && <Btn variant="ghost" onClick={resetPeriodForm} disabled={busy}>Cancel edit</Btn>}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SectionLabel>School day</SectionLabel>
        {loading ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Loading school periods…</div>
        ) : periods.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>No school-day blocks are configured yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {[...groupedPeriods.entries()].sort((a,b) => a[0]-b[0]).map(([day, rows]) => (
              <div key={day}>
                <div style={{ fontSize: 11, fontWeight: 750, color: C.textMuted, marginBottom: 6 }}>
                  {DAYS.find(item => item.value === day)?.label ?? 'School day'}
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {rows.map(period => (
                    <div key={period.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <div style={{ minWidth: 92, fontSize: 12, fontWeight: 800, color: C.textPrimary }}>
                        {formatTime(period.start_time)}–{formatTime(period.end_time)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 750, color: C.textPrimary }}>{period.label}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{period.kind}{period.protected ? ' · protected' : ''}</div>
                      </div>
                      {canManage && <>
                        <button type="button" onClick={() => editPeriod(period)} style={{ border: 0, background: 'transparent', color: C.accent, fontWeight: 800 }}>Edit</button>
                        <button type="button" onClick={() => void deletePeriod(period)} style={{ border: 0, background: 'transparent', color: '#b91c1c', fontWeight: 800 }}>Remove</button>
                      </>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Lesson length by grade</SectionLabel>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
          These are your school’s defaults. They guide custom lesson creation when a grade normally uses a different lesson length; configured period times still remain authoritative.
        </p>
        {durations.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
            {durations.map(row => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: C.textPrimary, fontWeight: 750 }}>{row.grade_label}</span>
                <span style={{ color: C.textMuted }}>{row.duration_minutes} minutes</span>
              </div>
            ))}
          </div>
        )}
        {canManage && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
            <input value={gradeLabel} onChange={e => setGradeLabel(e.target.value)} placeholder="e.g. Grade 8" style={fieldStyle} />
            <input type="number" min={20} max={120} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} style={fieldStyle} />
            <div style={{ gridColumn: '1 / -1' }}>
              <Btn onClick={saveDuration} disabled={busy || !gradeLabel.trim()}>Save grade duration</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
