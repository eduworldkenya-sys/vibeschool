'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SectionLabel, Btn, C } from '@/components/teacher/ui'

// ── Types ──────────────────────────────────────────────────────────────────
type AttStatus = 'present' | 'absent' | 'late' | 'excused'

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

interface Student {
  id:   string
  name: string
  admNo: string
}

// ── Constants ──────────────────────────────────────────────────────────────
const OPTIONS: AttStatus[] = ['present', 'absent', 'late', 'excused']

const STATUS_COLOR: Record<AttStatus, { bg: string; color: string }> = {
  present: { bg: C.accent,   color: '#fff'     },
  absent:  { bg: '#ef4444',  color: '#fff'     },
  late:    { bg: '#f59e0b',  color: '#fff'     },
  excused: { bg: '#6366f1',  color: '#fff'     },
}

const STATUS_IDLE = { bg: '#f3f4f6', color: '#6b7280' }

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function Skeleton({ h = 56 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const today = new Date().toISOString().split('T')[0]
  const dow   = new Date().getDay()

  const [uid,        setUid]        = useState<string | null>(null)
  const [schoolId,   setSchoolId]   = useState<string | null>(null)
  const [slots,      setSlots]      = useState<TSlot[]>([])
  const [activeSlot, setActiveSlot] = useState<TSlot | null>(null)
  const [students,   setStudents]   = useState<Student[]>([])
  const [statuses,   setStatuses]   = useState<Record<string, AttStatus>>({})
  const [slotsLoading,    setSlotsLoading]    = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveState,  setSaveState]  = useState<'idle' | 'saved' | 'error'>('idle')

  // ── 1. Load auth + slots ───────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUid(user.id)

      const [profileRes, slotsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .single(),

        supabase
          .from('timetable_slots')
          .select(`
            id, room, start_time, end_time, class_id,
            subjects ( name ),
            classes  ( name, stream )
          `)
          .eq('teacher_id', user.id)
          .eq('day_of_week', dow)
          .order('start_time', { ascending: true }),
      ])

      setSchoolId(profileRes.data?.school_id ?? null)

      // Check which slots already have attendance marked today
      const slotIds = (slotsRes.data ?? []).map(s => s.id)
      let markedSet = new Set<string>()

      if (slotIds.length > 0) {
        const { data: attRows } = await supabase
          .from('attendance')
          .select('timetable_slot_id')
          .in('timetable_slot_id', slotIds)
          .eq('date', today)

        markedSet = new Set((attRows ?? []).map(r => r.timetable_slot_id))
      }

      const mapped: TSlot[] = (slotsRes.data ?? []).map(s => {
        const sub = (s.subjects as unknown as { name: string } | null)?.name ?? 'Unknown'
        const cls = s.classes as unknown as { name: string; stream: string | null } | null
        return {
          id:      s.id,
          classId: s.class_id,
          subject: sub,
          class:   cls ? cls.name + (cls.stream ? ` ${cls.stream}` : '') : '',
          room:    s.room ?? '',
          start:   s.start_time,
          end:     s.end_time,
          marked:  markedSet.has(s.id),
        }
      })

      setSlots(mapped)
      setSlotsLoading(false)

      // Auto-select first unmarked slot, or first slot
      const first = mapped.find(s => !s.marked) ?? mapped[0] ?? null
      if (first) setActiveSlot(first)
    }

    init()
  }, [])

  // ── 2. Load students + existing attendance when slot changes ───────────
  const loadRegister = useCallback(async (slot: TSlot) => {
    setStudentsLoading(true)
    setStatuses({})

    const [studentsRes, attRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, name, admission_number')
        .eq('class_id', slot.classId)
        .order('name', { ascending: true }),

      supabase
        .from('attendance')
        .select('student_id, status')
        .eq('timetable_slot_id', slot.id)
        .eq('date', today),
    ])

    const studs: Student[] = (studentsRes.data ?? []).map(s => ({
      id:    s.id,
      name:  s.name,
      admNo: s.admission_number ?? '',
    }))

    // Pre-fill from existing records, default to 'present'
    const existingMap: Record<string, AttStatus> = {}
    ;(attRes.data ?? []).forEach(r => {
      existingMap[r.student_id] = r.status as AttStatus
    })

    const initialStatuses: Record<string, AttStatus> = {}
    studs.forEach(s => {
      initialStatuses[s.id] = existingMap[s.id] ?? 'present'
    })

    setStudents(studs)
    setStatuses(initialStatuses)
    setStudentsLoading(false)
  }, [today])

  useEffect(() => {
    if (activeSlot) loadRegister(activeSlot)
  }, [activeSlot, loadRegister])

  // ── 3. Save ────────────────────────────────────────────────────────────
  async function save() {
    if (!activeSlot || !uid) return
    setSaving(true)
    setSaveState('idle')

    const rows = students.map(s => ({
      timetable_slot_id: activeSlot.id,
      student_id:        s.id,
      class_id:          activeSlot.classId,
      teacher_id:        uid,
      school_id:         schoolId,
      date:              today,
      status:            statuses[s.id] ?? 'present',
      marked_at:         new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, {
        onConflict: 'timetable_slot_id,student_id,date',
      })

    if (!error) {
      // Mark slot as done in local state
      setSlots(prev => prev.map(s =>
        s.id === activeSlot.id ? { ...s, marked: true } : s
      ))
      setActiveSlot(prev => prev ? { ...prev, marked: true } : prev)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } else {
      setSaveState('error')
    }

    setSaving(false)
  }

  // ── Summary counts ─────────────────────────────────────────────────────
  const presentCount = Object.values(statuses).filter(s => s === 'present').length
  const absentCount  = Object.values(statuses).filter(s => s === 'absent').length
  const lateCount    = Object.values(statuses).filter(s => s === 'late').length

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Hero */}
      <div style={{
        background:   'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
        borderRadius: 20,
        padding:      '20px',
        marginBottom: 14,
        color:        '#fff',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          Attendance
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Mark Register</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
          {today} · Synced to ClassHub and progressive record.
        </div>
      </div>

      {/* Slot selector */}
      <Card>
        <SectionLabel>Select Period</SectionLabel>
        {slotsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} h={56} />)}
          </div>
        ) : slots.length === 0 ? (
          <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>
            No classes scheduled today
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map(slot => (
              <button
                key={slot.id}
                onClick={() => setActiveSlot(slot)}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '11px 14px',
                  borderRadius:   12,
                  border:         'none',
                  cursor:         'pointer',
                  fontFamily:     'inherit',
                  textAlign:      'left',
                  background:     activeSlot?.id === slot.id ? '#d1fae5' : '#f8f9fa',
                  outline:        activeSlot?.id === slot.id ? `2px solid ${C.accent}` : 'none',
                  transition:     'background 0.15s',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                    {slot.subject} · {slot.class}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {formatTime(slot.start)}–{formatTime(slot.end)}{slot.room ? ` · ${slot.room}` : ''}
                  </div>
                </div>
                {slot.marked && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
                    ✓ Done
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Register */}
      {activeSlot && (
        <Card>
          <SectionLabel>
            Register — {activeSlot.class} · {formatTime(activeSlot.start)}
          </SectionLabel>

          {/* Live summary bar */}
          {!studentsLoading && students.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Present', value: presentCount, bg: '#d1fae5', color: '#065f46' },
                { label: 'Absent',  value: absentCount,  bg: '#fee2e2', color: '#991b1b' },
                { label: 'Late',    value: lateCount,    bg: '#fef3c7', color: '#92400e' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
            Tap to change status. Default: Present.
          </div>

          {studentsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3,4,5].map(i => <Skeleton key={i} h={44} />)}
            </div>
          ) : students.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>
              No students found for this class
            </div>
          ) : (
            <>
              {students.map(s => (
                <div
                  key={s.id}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    padding:        '10px 0',
                    borderBottom:   `1px solid ${C.border}`,
                    gap:            8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{s.name}</div>
                    {s.admNo && (
                      <div style={{ fontSize: 10, color: C.textMuted }}>{s.admNo}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {OPTIONS.map(o => {
                      const active = statuses[s.id] === o
                      const style  = active ? STATUS_COLOR[o] : STATUS_IDLE
                      return (
                        <button
                          key={o}
                          onClick={() => setStatuses(p => ({ ...p, [s.id]: o }))}
                          style={{
                            padding:     '4px 8px',
                            borderRadius: 8,
                            border:      'none',
                            cursor:      'pointer',
                            fontSize:    11,
                            fontWeight:  700,
                            fontFamily:  'inherit',
                            background:  style.bg,
                            color:       style.color,
                            transition:  'all 0.12s',
                          }}
                        >
                          {o.charAt(0).toUpperCase() + o.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Save row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
                {saveState === 'saved' && (
                  <span style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>✓ Saved</span>
                )}
                {saveState === 'error' && (
                  <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>Error — try again</span>
                )}
                <Btn onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Attendance'}
                </Btn>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  )
}