"use client";
import { nairobiDateStr } from '@/lib/time'
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'
import { refreshPulse } from "@/lib/pulse/refresh";

type AttStatus = 'present' | 'absent' | 'late' | 'excused'
type Mode = 'class' | 'lesson'

interface TSlot {
  id:      string
  classId: string
  subject: string
  class:   string
  room:    string
  start:   string
  end:     string
  marked:  boolean
}

interface ClassOption {
  id:       string
  name:     string
  stream:   string | null
  schoolId: string | null
}

interface Student {
  id:    string
  name:  string
  admNo: string
}

const OPTIONS: AttStatus[] = ['present', 'absent', 'late', 'excused']

const STATUS_COLOR: Record<AttStatus, { bg: string; color: string }> = {
  present: { bg: C.accent,  color: '#fff' },
  absent:  { bg: C.error,   color: '#fff' },
  late:    { bg: C.warning, color: '#fff' },
  excused: { bg: '#6366f1', color: '#fff' },
}

const STATUS_IDLE = { bg: '#f3f4f6', color: C.textMuted }

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function AttendanceInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const urlClassId   = searchParams.get('classId')
  const urlDate      = searchParams.get('date')
  const today        = nairobiDateStr()

  const [mode,            setMode]            = useState<Mode>(urlClassId ? 'class' : 'class')
  const [selectedDate,    setSelectedDate]    = useState(urlDate ?? today)
  const [uid,             setUid]             = useState<string | null>(null)
  const [schoolId,        setSchoolId]        = useState<string | null>(null)

  // class mode
  const [classes,         setClasses]         = useState<ClassOption[]>([])
  const [activeClassId,   setActiveClassId]   = useState<string | null>(urlClassId ?? null)
  const [classesLoading,  setClassesLoading]  = useState(true)

  // lesson mode
  const [slots,           setSlots]           = useState<TSlot[]>([])
  const [activeSlot,      setActiveSlot]      = useState<TSlot | null>(null)
  const [slotsLoading,    setSlotsLoading]    = useState(true)

  // register
  const [students,        setStudents]        = useState<Student[]>([])
  const [statuses,        setStatuses]        = useState<Record<string, AttStatus>>({})
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [saveState,       setSaveState]       = useState<'idle' | 'saved' | 'error'>('idle')

  // init — fetch user, school, classes, slots
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUid(user.id)

      const dow = new Date(selectedDate + 'T12:00:00').getDay()

      const [profileRes, memberRes, classesRes, slotsRes] = await Promise.all([
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('teacher_classes').select('class_id, is_class_teacher').eq('teacher_id', user.id),
        supabase.from('timetable_slots')
          .select('id, room, start_time, end_time, class_id, subject_id, day_of_week')
          .eq('teacher_id', user.id)
          .eq('day_of_week', dow === 0 ? 7 : dow)
          .order('start_time', { ascending: true }),
      ])

      setSchoolId(memberRes.data?.school_id ?? profileRes.data?.school_id ?? null)

      const loadedClasses: ClassOption[] = (classesRes.data ?? []).map(c => ({
        id:       c.id,
        name:     c.name,
        stream:   c.stream,
        schoolId: c.school_id ?? null,
      }))
      setClasses(loadedClasses)
      setClassesLoading(false)

      if (!activeClassId && loadedClasses.length > 0) {
        setActiveClassId(loadedClasses[0].id)
      }

      // fetch subjects and classes for slots separately
      const rawSlots = slotsRes.data ?? []
      const subjectIds = Array.from(new Set(rawSlots.map((s: any) => s.subject_id).filter(Boolean)))
      const classIds   = Array.from(new Set(rawSlots.map((s: any) => s.class_id).filter(Boolean)))

      const [subjRes, clsRes] = await Promise.all([
        subjectIds.length > 0 ? supabase.from('subjects').select('id,name').in('id', subjectIds) : Promise.resolve({ data: [] }),
        classIds.length > 0   ? supabase.from('classes').select('id,name,stream').in('id', classIds) : Promise.resolve({ data: [] }),
      ])

      const subjMap = Object.fromEntries((subjRes.data ?? []).map((s: any) => [s.id, s.name]))
      const clsMap  = Object.fromEntries((clsRes.data ?? []).map((c: any) => [c.id, c.name + (c.stream ? ' ' + c.stream : '')]))

      const slotIds = rawSlots.map((s: any) => s.id)
      let markedSet = new Set<string>()
      if (slotIds.length > 0) {
        const { data: attRows } = await supabase
          .from('attendance')
          .select('timetable_slot_id')
          .in('timetable_slot_id', slotIds)
          .gte('timestamp', selectedDate + 'T00:00:00')
          .lte('timestamp', selectedDate + 'T23:59:59')
        markedSet = new Set((attRows ?? []).map((r: any) => r.timetable_slot_id))
      }

      const mapped: TSlot[] = rawSlots.map((s: any) => ({
        id:      s.id,
        classId: s.class_id,
        subject: subjMap[s.subject_id] ?? 'Unknown',
        class:   clsMap[s.class_id] ?? '',
        room:    s.room ?? '',
        start:   s.start_time,
        end:     s.end_time,
        marked:  markedSet.has(s.id),
      }))

      setSlots(mapped)
      setSlotsLoading(false)

      if (mode === 'lesson') {
        const first = mapped.find(s => !s.marked) ?? mapped[0] ?? null
        if (first) setActiveSlot(first)
      }
    }
    init()
  }, [selectedDate])

  // load register for class mode
  const loadClassRegister = useCallback(async (classId: string) => {
    setStudentsLoading(true)
    setStatuses({})

    const [studentsRes, attRes] = await Promise.all([
      supabase.from('student_classes').select('student_id, students(id, name, admission_number)').eq('class_id', classId).eq('is_current', true),
      supabase.from('attendance').select('student_id, status, is_late').eq('class_id', classId).gte('timestamp', selectedDate + 'T00:00:00').lte('timestamp', selectedDate + 'T23:59:59').is('timetable_slot_id', null),
    ])

    const studs: Student[] = (studentsRes.data ?? []).map((r: any) => r.students).filter(Boolean).map((s: any) => ({
      id: s.id, name: s.name, admNo: s.admission_number ?? '',
    }))

    const existingMap: Record<string, AttStatus> = {}
    ;(attRes.data ?? []).forEach((r: any) => {
      existingMap[r.student_id] = r.is_late ? 'late' : r.status as AttStatus
    })

    const initialStatuses: Record<string, AttStatus> = {}
    studs.forEach(s => { initialStatuses[s.id] = existingMap[s.id] ?? 'present' })

    setStudents(studs)
    setStatuses(initialStatuses)
    setStudentsLoading(false)
  }, [selectedDate])

  // load register for lesson mode
  const loadSlotRegister = useCallback(async (slot: TSlot) => {
    setStudentsLoading(true)
    setStatuses({})

    const [studentsRes, attRes] = await Promise.all([
      supabase.from('student_classes').select('student_id, students(id, name, admission_number)').eq('class_id', slot.classId).eq('is_current', true),
      supabase.from('attendance').select('student_id, status, is_late').eq('timetable_slot_id', slot.id).gte('timestamp', selectedDate + 'T00:00:00').lte('timestamp', selectedDate + 'T23:59:59'),
    ])

    const studs: Student[] = (studentsRes.data ?? []).map((r: any) => r.students).filter(Boolean).map((s: any) => ({
      id: s.id, name: s.name, admNo: s.admission_number ?? '',
    }))

    const existingMap: Record<string, AttStatus> = {}
    ;(attRes.data ?? []).forEach((r: any) => {
      existingMap[r.student_id] = r.is_late ? 'late' : r.status as AttStatus
    })

    const initialStatuses: Record<string, AttStatus> = {}
    studs.forEach(s => { initialStatuses[s.id] = existingMap[s.id] ?? 'present' })

    setStudents(studs)
    setStatuses(initialStatuses)
    setStudentsLoading(false)
  }, [selectedDate])

  useEffect(() => {
    if (mode === 'class' && activeClassId) loadClassRegister(activeClassId)
  }, [mode, activeClassId, loadClassRegister])

  useEffect(() => {
    if (mode === 'lesson' && activeSlot) loadSlotRegister(activeSlot)
  }, [mode, activeSlot, loadSlotRegister])

  async function save() {
    if (!uid) return
    if (mode === 'class' && !activeClassId) return
    if (mode === 'lesson' && !activeSlot) return
    setSaving(true)
    setSaveState('idle')

    const isLesson = mode === 'lesson'
    const classSchoolId = isLesson
      ? classes.find(c => c.id === activeSlot!.classId)?.schoolId ?? schoolId
      : classes.find(c => c.id === activeClassId)?.schoolId ?? schoolId
    const rows = students.map(s => ({
      student_id: s.id,
      class_id:   isLesson ? activeSlot!.classId : activeClassId!,
      teacher_id: uid,
      school_id:  classSchoolId,
      date:      selectedDate,
      status:     statuses[s.id] === 'late' ? 'present' : (statuses[s.id] ?? 'present'),
      is_late:    statuses[s.id] === 'late',
      marked_at:  new Date().toISOString(),
      ...(isLesson ? { timetable_slot_id: activeSlot!.id } : {}),
    }))

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, {
        onConflict: isLesson ? 'timetable_slot_id,student_id,date' : 'class_id,student_id,date',
      })

    if (!error) {
      if (isLesson && activeSlot) {
        setSlots(prev => prev.map(s => s.id === activeSlot.id ? { ...s, marked: true } : s))
        setActiveSlot(prev => prev ? { ...prev, marked: true } : prev)
      }
      setSaveState('saved')
      refreshPulse('attendance')
      setTimeout(() => setSaveState('idle'), 2500)
    } else {
      console.error('attendance save error:', error)
      setSaveState('error')
    }
    setSaving(false)
  }

  function markAll(status: AttStatus) {
    const all: Record<string, AttStatus> = {}
    students.forEach(s => { all[s.id] = status })
    setStatuses(all)
  }

  const presentCount = Object.values(statuses).filter(s => s === 'present').length
  const absentCount  = Object.values(statuses).filter(s => s === 'absent').length
  const lateCount    = Object.values(statuses).filter(s => s === 'late').length
  const activeClass  = classes.find(c => c.id === activeClassId)

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', borderRadius: 20, padding: 20, marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Attendance</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Mark Register</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{selectedDate}</div>

        {/* MODE TOGGLE */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 12 }}>
          {(['class', 'lesson'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setStudents([]); setStatuses({}) }} style={{ flex: 1, padding: '9px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12, background: mode === m ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)', color: mode === m ? '#065f46' : 'rgba(255,255,255,0.85)', transition: 'all 0.15s' }}>
              {m === 'class' ? '🏫 Class Register' : '📖 Lesson Register'}
            </button>
          ))}
        </div>

        {/* DATE NAV */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setSelectedDate(d => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() - 1); return dt.toISOString().split('T')[0] })} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Prev</button>
          <button onClick={() => setSelectedDate(today)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
          <button onClick={() => setSelectedDate(d => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 1); return dt.toISOString().split('T')[0] })} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
        </div>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#fff', color: '#111827', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }} />

        {urlClassId && (
          <button onClick={() => router.push('/teacher/classhub/' + urlClassId)} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← View Class</button>
        )}
      </div>

      {/* CLASS MODE — pick class */}
      {mode === 'class' && (
        <Card>
          <SectionLabel>Select Class</SectionLabel>
          {classesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <Skeleton key={i} h={48} />)}</div>
          ) : classes.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>No classes found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {classes.map(c => (
                <button key={c.id} onClick={() => setActiveClassId(c.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: activeClassId === c.id ? C.accentLight : C.surface, outline: activeClassId === c.id ? `2px solid ${C.accent}` : 'none', transition: 'background 0.15s' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{c.name}{c.stream ? ' · ' + c.stream : ''}</div>
                  {activeClassId === c.id && <span style={{ fontSize: 11, fontWeight: 700, color: '#065f46' }}>Selected</span>}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* LESSON MODE — pick slot */}
      {mode === 'lesson' && (
        <Card>
          <SectionLabel>Select Period</SectionLabel>
          {slotsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <Skeleton key={i} h={56} />)}</div>
          ) : slots.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>No lessons scheduled for this day</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slots.map(slot => (
                <button key={slot.id} onClick={() => setActiveSlot(slot)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: activeSlot?.id === slot.id ? C.accentLight : C.surface, outline: activeSlot?.id === slot.id ? `2px solid ${C.accent}` : 'none', transition: 'background 0.15s' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{slot.subject} · {slot.class}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{formatTime(slot.start)}–{formatTime(slot.end)}{slot.room ? ` · ${slot.room}` : ''}</div>
                  </div>
                  {slot.marked && <span style={{ fontSize: 11, fontWeight: 700, color: '#065f46', background: C.accentLight, padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>✓ Done</span>}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* REGISTER */}
      {((mode === 'class' && activeClassId) || (mode === 'lesson' && activeSlot)) && (
        <Card>
          <SectionLabel>
            {mode === 'class'
              ? `Register — ${activeClass ? activeClass.name + (activeClass.stream ? ' · ' + activeClass.stream : '') : ''}`
              : `Register — ${activeSlot?.class} · ${formatTime(activeSlot?.start ?? '')}`
            }
          </SectionLabel>

          {!studentsLoading && students.length > 0 && (
            <>
              {/* STATS */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Present', value: presentCount, bg: C.accentLight, color: '#065f46' },
                  { label: 'Absent',  value: absentCount,  bg: '#fee2e2',     color: '#991b1b' },
                  { label: 'Late',    value: lateCount,    bg: '#fef3c7',     color: '#92400e' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* QUICK ACTIONS */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {(['present', 'absent'] as AttStatus[]).map(s => (
                  <button key={s} onClick={() => markAll(s)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1.5px solid ' + (s === 'present' ? C.accent : C.error), background: 'transparent', color: s === 'present' ? C.accent : C.error, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                    All {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Tap to change status. Default: Present.</div>

          {studentsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4,5].map(i => <Skeleton key={i} h={44} />)}</div>
          ) : students.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>No students found for this class</div>
          ) : (
            <>
              {students.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}`, gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{s.name}</div>
                    {s.admNo && <div style={{ fontSize: 10, color: C.textMuted }}>{s.admNo}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {OPTIONS.map(o => {
                      const active = statuses[s.id] === o
                      const style  = active ? STATUS_COLOR[o] : STATUS_IDLE
                      return (
                        <button key={o} onClick={() => setStatuses(p => ({ ...p, [s.id]: o }))} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', background: style.bg, color: style.color, transition: 'all 0.12s' }}>
                          {o.charAt(0).toUpperCase() + o.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
                {saveState === 'saved' && <span style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>✓ Saved</span>}
                {saveState === 'error' && <span style={{ fontSize: 13, color: C.error, fontWeight: 700 }}>Error — try again</span>}
                <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Attendance'}</Btn>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  )
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: C.textMuted }}>Loading…</div>}>
      <AttendanceInner />
    </Suspense>
  )
}
