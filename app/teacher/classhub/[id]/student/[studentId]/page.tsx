"use client";
'use client'
import React, { useEffect, useState, Suspense, CSSProperties } from 'react'
import { C } from '@/components/teacher/ui'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

/* ── Types ── */
interface Student {
  id: string; name: string; admission_number: string | null
  profile_id: string | null; date_of_birth: string | null; parent_linked_at: string | null
  gender: string | null; autonomy_level: number | null; created_at: string
}
interface ClaimCode { code: string; claimed: boolean; expires_at: string | null; role: string }
interface AttendanceRecord { id: string; date: string; status: string; is_late: boolean; notes: string | null }
interface Assessment {
  id: string; subject_id: string; strand_id: string | null; sub_strand: string | null
  assessment_type: string; performance: string; term: string; academic_year: string
  notes: string | null; created_at: string
}
interface Homework { id: string; title: string; subject: string; due_date: string; type: string }
interface Submission { homework_id: string; status: string; mark: number | null; feedback: string | null; submitted_at: string | null }
interface Streak { type: string; current_count: number; longest_count: number; last_recorded: string }
interface Goal { id: string; title: string; category: string; status: string; target_date: string | null; description: string | null }
interface Skill { id: string; name: string; category: string; level: string; notes: string | null; endorsed_by: string | null }
interface StudentGroup { type: string; name: string; color: string; bg: string }
interface Badge { id: string; name: string; icon: string; category: string; level: string; description: string; earned_at: string }
interface Subject { id: string; name: string }
interface ExamResult {
  id: string
  exam_id: string
  subject_id: string | null
  marks: number
  is_absent: boolean
}
interface ExamItem {
  id: string
  name: string
  term: number
  academic_year: number
  exam_type: string
  pass_mark: number
}

interface Resource { id: string; title: string; type: string; subject: string; external_url: string | null; content: string | null; created_at: string }

type Tab = 'overview' | 'results' | 'attendance' | 'assessments' | 'homework' | 'resources' | 'journey' | 'badges'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',    label: 'Overview',    icon: '👤' },
  { id: 'results',     label: 'Results',     icon: '📊' },
  { id: 'attendance',  label: 'Attendance',  icon: '✅' },
  { id: 'assessments', label: 'Assessments', icon: '📊' },
  { id: 'homework',    label: 'Homework',    icon: '📝' },
  { id: 'resources',   label: 'Resources',   icon: '📚' },
  { id: 'journey',     label: 'Journey',     icon: '🚀' },
  { id: 'badges',      label: 'Badges',      icon: '🏅' },
]

const PERF_COLORS: Record<string, { bg: string; color: string }> = {
  EM: { bg: '#d1fae5', color: '#065f46' },
  ME: { bg: '#dbeafe', color: '#1d4ed8' },
  AE: { bg: '#fef3c7', color: '#92400e' },
  BE: { bg: '#fee2e2', color: '#991b1b' },
}

function pill(label: string, bg: string, color: string) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color }}>
      {label}
    </span>
  )
}

function SectionHead({ title }: { title: string }) {
  return <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 12px' }}>{title}</p>
}

function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0' }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', margin: 0 }}>{text}</p>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

/* ── Overview Tab ── */
function OverviewTab({ student, classId, studentCode, parentCode, onReload, myGroups }: {
  student: Student; classId: string; studentCode: ClaimCode | null; parentCode: ClaimCode | null; onReload: () => Promise<void>; myGroups: StudentGroup[]
}) {
  const [editing, setEditing] = useState(false)
  const [name,    setName]    = useState(student.name)
  const [adm,     setAdm]     = useState(student.admission_number ?? '')
  const [saving,  setSaving]  = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [genning, setGenning] = useState(false)
  const [err,     setErr]     = useState('')

  async function handleSave() {
    if (!name.trim()) { setErr('Name required'); return }
    setSaving(true)
    const { error } = await supabase.from('students').update({
      name:             name.trim(),
      admission_number: adm.trim() || null,
    }).eq('id', student.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(false)
    await onReload()
  }

  async function handleGenCode() {
    setGenning(true)
    const studentCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const parentCode  = Math.random().toString(36).substring(2, 8).toUpperCase()
    await supabase.from('student_claim_codes').delete().eq('student_id', student.id).eq('claimed', false)
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + 30)
    const expiresAt = expiry.toISOString()

    await Promise.all([
      supabase.from('student_claim_codes').insert({ student_id: student.id, code: studentCode, claimed: false, role: 'student', expires_at: expiresAt }),
      supabase.from('student_claim_codes').insert({ student_id: student.id, code: parentCode,  claimed: false, role: 'parent',  expires_at: expiresAt }),
    ])
    setGenning(false)
    await onReload()
  }

  async function handleCopy(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 14, color: C.textPrimary,
    outline: 'none', fontFamily: 'inherit', background: '#f9fafb',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <SectionHead title="Student Info" />
          <button onClick={() => { setEditing(v => !v); setErr('') }} style={{ fontSize: 12, fontWeight: 700, color: editing ? C.textMuted : C.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {editing ? 'Cancel' : '✏️ Edit'}
          </button>
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 4 }}>Full Name *</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 4 }}>Admission Number</label>
              <input style={inputStyle} value={adm} onChange={e => setAdm(e.target.value)} placeholder="Optional" />
            </div>
            {err && <p style={{ fontSize: 12, color: C.error, margin: 0 }}>{err}</p>}
            <button onClick={handleSave} disabled={saving} style={{ padding: '11px', borderRadius: 10, background: saving ? C.accentLight : C.accent, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Full Name',      value: student.name },
              { label: 'Admission No.',  value: student.admission_number || '—' },
              { label: 'Gender',         value: student.gender || '—' },
              { label: 'Date of Birth',  value: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '—' },
              { label: 'Autonomy Level', value: student.autonomy_level != null ? String(student.autonomy_level) : '—' },
              { label: 'Enrolled',       value: new Date(student.created_at).toLocaleDateString() },
              { label: 'Account Status', value: student.profile_id ? 'Claimed ✓' : 'Unclaimed' },
              { label: 'Parent Status', value: student.parent_linked_at ? '👨‍👩‍👧 Parent Linked ✓' : 'No Parent Linked' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {myGroups.length > 0 && (
        <Card>
          <SectionHead title="Groups" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myGroups.map(g => (
              <div key={g.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 12, color: C.textMuted, textTransform: "capitalize" }}>{g.type} Group</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: g.bg, color: g.color }}>{g.name}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionHead title="Claim Codes" />
        {(studentCode || parentCode) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Student Code */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>🎒 Student Code</p>
              {studentCode ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 26, fontWeight: 900, color: C.dark, margin: 0, letterSpacing: 4, fontFamily: 'monospace' }}>{studentCode.code}</p>
                    {studentCode.expires_at && <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>Expires {new Date(studentCode.expires_at).toLocaleDateString()}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => handleCopy(studentCode.code)} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #10b981', background: 'transparent', color: C.accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Copy
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent("VibeSchool Student Code for " + student.name + ": " + studentCode.code + ". Go to vibeschool.vercel.app/student/claim and enter this code.")}`} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #25D366', background: 'transparent', color: '#25D366', fontWeight: 700, fontSize: 11, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
                      WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Not generated</p>
              )}
            </div>

            {/* Parent Magic Link */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>👨‍👩‍👧 Parent Link</p>
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: '#065f46', margin: 0, fontFamily: 'monospace' }}>vibeschool.vercel.app/parent/harmonize?sid=••••••••{parentCode ? "&token=" + parentCode.code.substring(0,2) + "••••" : ""}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleCopy("https://vibeschool.vercel.app/parent/harmonize?sid=" + student.id + (parentCode ? "&token=" + parentCode.code : ""))} style={{ flex: 1, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #10b981', background: 'transparent', color: C.accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Copy Link
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent("Hi! Use this link to connect with " + student.name + " on VibeSchool: https://vibeschool.vercel.app/parent/harmonize?sid=" + student.id + (parentCode ? "&token=" + parentCode.code : ""))}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #25D366', background: 'transparent', color: '#25D366', fontWeight: 700, fontSize: 11, cursor: 'pointer', textDecoration: 'none', textAlign: 'center' }}>
                  WhatsApp
                </a>
              </div>
            </div>
            <button onClick={handleGenCode} disabled={genning} style={{ padding: '8px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'transparent', color: C.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {genning ? 'Generating…' : '🔄 Regenerate Both Codes'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>No claim codes yet</p>
            <button onClick={handleGenCode} disabled={genning} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.dark, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {genning ? 'Generating…' : 'Generate Codes'}
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Attendance Tab ── */
function AttendanceTab({ records }: { records: AttendanceRecord[] }) {
  const total   = records.length
  const present = records.filter(r => r.status === 'present').length
  const absent  = records.filter(r => r.status === 'absent').length
  const late    = records.filter(r => r.is_late).length
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0

  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    present: { bg: '#d1fae5', color: '#065f46', label: 'Present' },
    absent:  { bg: '#fee2e2', color: '#991b1b', label: 'Absent'  },
    excused: { bg: '#e0f2fe', color: '#075985', label: 'Excused' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'Rate',    value: rate + '%' },
          { label: 'Present', value: present    },
          { label: 'Absent',  value: absent     },
          { label: 'Late',    value: late        },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '12px 6px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.textPrimary }}>{s.value}</div>
            <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <Card>
        <SectionHead title="Attendance Log" />
        {records.length === 0 ? (
          <EmptyState icon="🗓️" text="No attendance records yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {records.slice(0, 30).map(r => {
              const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.present
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    {r.notes && <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{r.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {r.is_late && pill('Late', '#fef3c7', '#92400e')}
                    {pill(s.label, s.bg, s.color)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Assessments Tab ── */
function AssessmentsTab({ assessments, subjects }: { assessments: Assessment[]; subjects: Subject[] }) {
  const subjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? id
  const grouped = assessments.reduce<Record<string, Assessment[]>>((acc, a) => {
    const key = subjectName(a.subject_id)
    acc[key] = acc[key] ?? []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {assessments.length === 0 ? (
        <Card><EmptyState icon="📊" text="No assessments recorded yet" /></Card>
      ) : (
        Object.entries(grouped).map(([subject, items]) => (
          <Card key={subject}>
            <SectionHead title={subject} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(a => {
                const pc = PERF_COLORS[a.performance] ?? { bg: '#f3f4f6', color: '#374151' }
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{a.assessment_type}</p>
                      <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>Term {a.term} · {a.academic_year}{a.sub_strand ? ' · ' + a.sub_strand : ''}</p>
                      {a.notes && <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0', fontStyle: 'italic' }}>{a.notes}</p>}
                    </div>
                    {pill(a.performance, pc.bg, pc.color)}
                  </div>
                )
              })}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

/* ── Homework Tab ── */
function HomeworkTab({ homework, submissions }: { homework: Homework[]; submissions: Submission[] }) {
  const subMap = Object.fromEntries(submissions.map(s => [s.homework_id, s]))

  const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
    submitted: { bg: '#d1fae5', color: '#065f46' },
    pending:   { bg: '#fef3c7', color: '#92400e' },
    late:      { bg: '#fee2e2', color: '#991b1b' },
    graded:    { bg: '#dbeafe', color: '#1d4ed8' },
  }

  return (
    <Card>
      <SectionHead title="Homework" />
      {homework.length === 0 ? (
        <EmptyState icon="📝" text="No homework assigned yet" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {homework.map(hw => {
            const sub    = subMap[hw.id]
            const status = sub?.status ?? 'pending'
            const sc     = STATUS_STYLE[status] ?? STATUS_STYLE.pending
            return (
              <div key={hw.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{hw.title}</p>
                    <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{hw.subject} · Due {new Date(hw.due_date).toLocaleDateString()}</p>
                  </div>
                  {pill(status.charAt(0).toUpperCase() + status.slice(1), sc.bg, sc.color)}
                </div>
                {sub?.feedback && <p style={{ fontSize: 11, color: C.textMuted, margin: '6px 0 0', fontStyle: 'italic' }}>💬 {sub.feedback}</p>}
                {sub?.mark != null && <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, margin: '4px 0 0' }}>Mark: {sub.mark}</p>}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/* ── Resources Tab ── */
function ResourcesTab({ resources }: { resources: Resource[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
    notes:      { icon: '📄', color: '#1d4ed8', bg: '#dbeafe' },
    assessment: { icon: '📝', color: '#065f46', bg: '#d1fae5' },
    exercise:   { icon: '🏋️', color: '#92400e', bg: '#fef3c7' },
    quiz:       { icon: '🧪', color: '#6d28d9', bg: '#ede9fe' },
    video:      { icon: '📺', color: '#991b1b', bg: '#fee2e2' },
    other:      { icon: '📁', color: '#374151', bg: '#f3f4f6' },
  }

  return (
    <Card>
      <SectionHead title="Class Resources" />
      {resources.length === 0 ? (
        <EmptyState icon="📚" text="No resources assigned to this class yet" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resources.map(r => {
            const meta   = TYPE_META[r.type] ?? TYPE_META.other
            const isOpen = expanded === r.id
            return (
              <div key={r.id} style={{ borderLeft: `3px solid ${meta.color}`, paddingLeft: 10, borderRadius: 4 }}>
                <button onClick={() => setExpanded(isOpen ? null : r.id)} style={{ width: '100%', background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{meta.icon}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{r.title}</p>
                      <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{r.subject}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div style={{ paddingBottom: 10 }}>
                    {r.content && <p style={{ fontSize: 13, color: C.textPrimary, whiteSpace: 'pre-wrap', margin: 0 }}>{r.content}</p>}
                    {r.external_url && (
                      <a href={r.external_url} target="_blank" rel="noreferrer noopener" style={{ display: 'inline-block', marginTop: 8, padding: '7px 14px', borderRadius: 8, background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                        🔗 Open Link
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/* ── Journey Tab ── */
function JourneyTab({ streaks, goals, skills }: { streaks: Streak[]; goals: Goal[]; skills: Skill[] }) {
  const SKILL_LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
    beginner:   { bg: '#fef3c7', color: '#92400e' },
    developing: { bg: '#dbeafe', color: '#1d4ed8' },
    proficient: { bg: '#d1fae5', color: '#065f46' },
    advanced:   { bg: '#ede9fe', color: '#6d28d9' },
    expert:     { bg: '#fce7f3', color: '#9d174d' },
  }

  const GOAL_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    active:    { bg: '#dbeafe', color: '#1d4ed8' },
    completed: { bg: '#d1fae5', color: '#065f46' },
    paused:    { bg: '#f3f4f6', color: '#374151' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionHead title="Learning Streaks" />
        {streaks.length === 0 ? (
          <EmptyState icon="🔥" text="No streaks recorded yet" />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {streaks.map((s, i) => (
              <div key={i} style={{ flex: 1, minWidth: 100, background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{s.current_count}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 2 }}>{s.type}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Best: {s.longest_count}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #064e3b 100%)' }}>
        <SectionHead title="Talent Projection" />
        {skills.length === 0 ? (
          <EmptyState icon="🌟" text="No skills recorded yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {skills.map(sk => {
              const lc = SKILL_LEVEL_COLORS[sk.level.toLowerCase()] ?? { bg: '#f3f4f6', color: '#374151' }
              return (
                <div key={sk.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>{sk.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{sk.category}{sk.endorsed_by ? ' · Endorsed' : ''}</p>
                  </div>
                  {pill(sk.level, lc.bg, lc.color)}
                </div>
              )
            })}
          </div>
        )}
        {skills.length > 0 && (
          <div style={{ marginTop: 14, padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#10b981', margin: '0 0 4px' }}>🎯 Career Path Signal</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
              {skills.length} skill{skills.length > 1 ? 's' : ''} recorded across {Array.from(new Set(skills.map(s => s.category))).length} domain{Array.from(new Set(skills.map(s => s.category))).length > 1 ? 's' : ''}. Strongest signal: <strong style={{ color: '#fff' }}>{skills[0].category}</strong>.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <SectionHead title="Goals" />
        {goals.length === 0 ? (
          <EmptyState icon="🎯" text="No goals set yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {goals.map(g => {
              const gc = GOAL_STATUS_COLORS[g.status] ?? GOAL_STATUS_COLORS.active
              return (
                <div key={g.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{g.title}</p>
                    {pill(g.status, gc.bg, gc.color)}
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted, margin: '3px 0 0' }}>{g.category}{g.target_date ? ' · ' + new Date(g.target_date).toLocaleDateString() : ''}</p>
                  {g.description && <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0', fontStyle: 'italic' }}>{g.description}</p>}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Badges Tab ── */
function BadgesTab({ badges }: { badges: Badge[] }) {
  const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
    bronze: { bg: '#fef3c7', color: '#92400e' },
    silver: { bg: '#f3f4f6', color: '#374151' },
    gold:   { bg: '#fef9c3', color: '#854d0e' },
  }

  return (
    <Card>
      <SectionHead title={`Badges · ${badges.length} earned`} />
      {badges.length === 0 ? (
        <EmptyState icon="🏅" text="No badges earned yet" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {badges.map(b => {
            const lc = LEVEL_COLORS[b.level?.toLowerCase()] ?? { bg: '#ede9fe', color: '#6d28d9' }
            return (
              <div key={b.id} style={{ background: lc.bg, borderRadius: 16, padding: '14px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 28 }}>{b.icon || '🏅'}</span>
                <p style={{ fontSize: 11, fontWeight: 800, color: lc.color, margin: 0, lineHeight: 1.3 }}>{b.name}</p>
                <p style={{ fontSize: 9, color: lc.color, margin: 0, opacity: 0.7 }}>{new Date(b.earned_at).toLocaleDateString()}</p>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/* ── Results Tab ── */
function ResultsTab({ examResults, exams, subjects }: { examResults: ExamResult[]; exams: ExamItem[]; subjects: Subject[] }) {
  function getGrade(marks: number): string {
    if (marks >= 80) return 'A'
    if (marks >= 75) return 'A-'
    if (marks >= 70) return 'B+'
    if (marks >= 65) return 'B'
    if (marks >= 60) return 'B-'
    if (marks >= 55) return 'C+'
    if (marks >= 50) return 'C'
    if (marks >= 45) return 'C-'
    if (marks >= 40) return 'D+'
    if (marks >= 35) return 'D'
    if (marks >= 30) return 'D-'
    return 'E'
  }
  function gradeColor(g: string): { bg: string; color: string } {
    if (g === 'A')                        return { bg: '#d1fae5', color: '#065f46' }
    if (g === 'A-' || g === 'B+')        return { bg: '#dbeafe', color: '#1e40af' }
    if (['B','B-','C+'].includes(g))     return { bg: '#fef3c7', color: '#92400e' }
    if (['C','C-','D+'].includes(g))     return { bg: '#fed7aa', color: '#9a3412' }
    return { bg: '#fee2e2', color: '#991b1b' }
  }
  function subjectName(id: string | null): string {
    if (!id) return 'General'
    return subjects.find(s => s.id === id)?.name ?? 'Unknown'
  }

  if (exams.length === 0 || examResults.length === 0) {
    return (
      <Card>
        <EmptyState icon="📊" text="No exam results recorded yet" />
      </Card>
    )
  }

  // Overall trend — average per exam
  const examAverages = exams.map(e => {
    const ers = examResults.filter(r => r.exam_id === e.id && !r.is_absent)
    if (ers.length === 0) return null
    const avg = ers.reduce((a, r) => a + r.marks, 0) / ers.length
    return { name: e.name, avg: Math.round(avg), pass_mark: e.pass_mark }
  }).filter(Boolean) as { name: string; avg: number; pass_mark: number }[]

  const trend = examAverages.length >= 2
    ? examAverages[examAverages.length - 1].avg - examAverages[0].avg
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Trend summary ── */}
      <div style={{ background: 'linear-gradient(135deg, #1c1917, #292524)', borderRadius: 20, padding: 16 }}>
        <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 800, color: '#C8A84B', letterSpacing: 2, textTransform: 'uppercase' }}>📈 Performance Trend</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {examAverages.map((e, i) => {
            const pct = Math.min(100, Math.round((e.avg / 100) * 100))
            const passed = e.avg >= e.pass_mark
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: 60, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: pct + '%', background: passed ? '#C8A84B' : '#ef4444', borderRadius: 8, transition: 'height 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{e.avg}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.2 }}>{e.name.split(' ').slice(0,2).join(' ')}</span>
              </div>
            )
          })}
        </div>
        {examAverages.length >= 2 && (
          <p style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 700, color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? `↑ Improved by ${trend} marks` : `↓ Dropped by ${Math.abs(trend)} marks`} since first exam
          </p>
        )}
      </div>

      {/* ── Per exam breakdown ── */}
      {exams.map(exam => {
        const ers = examResults.filter(r => r.exam_id === exam.id)
        if (ers.length === 0) return null
        const total = ers.filter(r => !r.is_absent).reduce((a, r) => a + r.marks, 0)
        const avg   = ers.filter(r => !r.is_absent).length > 0
          ? Math.round(total / ers.filter(r => !r.is_absent).length) : 0
        const passed = avg >= exam.pass_mark
        return (
          <Card key={exam.id} style={{ padding: 16 }}>
            {/* Exam header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textPrimary }}>{exam.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textMuted }}>Term {exam.term} · {exam.academic_year} · {exam.exam_type}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: passed ? '#065f46' : '#991b1b' }}>{avg}</p>
                <span style={{ fontSize: 10, fontWeight: 700, color: passed ? '#065f46' : '#991b1b' }}>{passed ? '✓ Pass' : '✗ Fail'}</span>
              </div>
            </div>

            {/* Subject rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ers.map(r => {
                const grade = r.is_absent ? null : getGrade(r.marks)
                const gc    = grade ? gradeColor(grade) : null
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: '#f9f7f4', border: '1px solid #EDE0CE' }}>
                    <span style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>{subjectName(r.subject_id)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: r.is_absent ? '#9ca3af' : C.textPrimary }}>
                        {r.is_absent ? 'ABS' : r.marks}
                      </span>
                      {grade && gc && (
                        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: gc.bg, color: gc.color }}>{grade}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pass mark note */}
            <p style={{ margin: '10px 0 0', fontSize: 11, color: C.textMuted }}>Pass mark: {exam.pass_mark}</p>
          </Card>
        )
      })}
    </div>
  )
}

/* ── Main Page ── */
function StudentProfileInner() {
  const router    = useRouter()
  const params    = useParams()
  const classId   = params.id as string
  const studentId = params.studentId as string

  const [student,     setStudent]     = useState<Student | null>(null)
  const [studentCode, setStudentCode] = useState<ClaimCode | null>(null)
  const [parentCode,  setParentCode]  = useState<ClaimCode | null>(null)
  const [attendance,  setAttendance]  = useState<AttendanceRecord[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [homework,    setHomework]    = useState<Homework[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [resources,   setResources]   = useState<Resource[]>([])
  const [streaks,     setStreaks]     = useState<Streak[]>([])
  const [goals,       setGoals]       = useState<Goal[]>([])
  const [skills,      setSkills]      = useState<Skill[]>([])
  const [badges,      setBadges]      = useState<Badge[]>([])
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [exams,       setExams]       = useState<ExamItem[]>([])
  const [subjects,    setSubjects]    = useState<Subject[]>([])
  const [myGroups,    setMyGroups]    = useState<StudentGroup[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<Tab>('overview')

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=teacher'); return }

    // FIX: removed duplicate subjects query — fetch once only
    const [
      stuRes, codeRes, attRes, asmRes, hwRes, subjRes, resRes,
      strRes, goalRes, skillRes,
    ] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).single(),
      supabase.from('student_claim_codes').select('code, role, claimed, expires_at').eq('student_id', studentId).eq('claimed', false),
      supabase.from('attendance').select('*').eq('student_id', studentId).eq('class_id', classId).order('date', { ascending: false }),
      supabase.from('cbc_assessments').select('*').eq('student_id', studentId).eq('class_id', classId).order('created_at', { ascending: false }),
      supabase.from('homework').select('*').eq('class_id', classId).order('due_date', { ascending: false }),
      supabase.from('subjects').select('id, name'),
      supabase.from('resources').select('*').eq('class_id', classId).order('created_at', { ascending: false }),
      supabase.from('child_streaks').select('*').eq('student_id', studentId),
      supabase.from('child_goals').select('*').eq('student_id', studentId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('child_skills').select('*').eq('student_id', studentId).is('deleted_at', null).order('created_at', { ascending: false }),
    ])

    if (!stuRes.data) { router.push('/teacher/classhub/' + classId); return }

    // Load exam results for this student

    // Parallel wave 2 — all independent of wave 1 results
    const [erRes, grpRes, cbRes] = await Promise.all([
      supabase.from('exam_results').select('id, exam_id, subject_id, marks, is_absent').eq('student_id', studentId),
      supabase.from('class_groups').select('id, name, color, type').eq('class_id', classId),
      supabase.from('child_badges').select('id, badge_id, earned_at, awarded_by, created_at').eq('student_id', studentId),
    ])

    // Wave 3 — depends on wave 2
    const erRows = (erRes.data ?? []) as ExamResult[]
    const grpData = grpRes.data ?? []
    const cb = cbRes.data ?? []

    const [examData, mbrData, subsData, bdgsData] = await Promise.all([
      erRows.length > 0
        ? supabase.from('exams').select('id, name, term, academic_year, exam_type, pass_mark').in('id', Array.from(new Set(erRows.map(r => r.exam_id)))).order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('class_group_members').select('group_id').eq('student_id', studentId),
      hwRes.data && hwRes.data.length > 0
        ? supabase.from('homework_submissions').select('*').eq('student_id', studentId).in('homework_id', hwRes.data.map((h: Homework) => h.id))
        : Promise.resolve({ data: [] }),
      cb.length > 0
        ? supabase.from('badges').select('*').in('id', cb.map((b: { badge_id: string }) => b.badge_id))
        : Promise.resolve({ data: [] }),
    ])

    setExamResults(erRows)
    setExams((examData.data ?? []) as ExamItem[])

    const myGroupIds = new Set((mbrData.data ?? []).map((m: { group_id: string }) => m.group_id))
    const COLOR_BG: Record<string, string> = { '#065f46': '#d1fae5', '#92400e': '#fef3c7', '#991b1b': '#fee2e2', '#1d4ed8': '#dbeafe', '#6d28d9': '#ede9fe', '#0f766e': '#ccfbf1', '#9d174d': '#fce7f3' }
    setMyGroups(grpData.filter((g: { id: string }) => myGroupIds.has(g.id)).map((g: { type: string; name: string; color: string }) => ({ type: g.type, name: g.name, color: g.color, bg: COLOR_BG[g.color] ?? '#f3f4f6' })))

    setStudent(stuRes.data)
        const codes = (codeRes.data ?? []) as ClaimCode[]
        setStudentCode(codes.find(c => c.role === 'student') ?? null)
        setParentCode(codes.find(c => c.role === 'parent') ?? null)
    setAttendance(attRes.data ?? [])
    setAssessments(asmRes.data ?? [])
    setSubjects(subjRes.data ?? [])
    setHomework(hwRes.data ?? [])
    setSubmissions(subsData.data ?? [])
    setResources(resRes.data ?? [])
    setStreaks(strRes.data ?? [])
    setGoals(goalRes.data ?? [])
    setSkills(skillRes.data ?? [])

    if (cb.length > 0) {
      const merged: Badge[] = (bdgsData.data ?? []).map((b: { id: string; name: string; icon: string; category: string; level: string; description: string }) => ({
        ...b,
        earned_at: cb.find((c: { badge_id: string; earned_at: string }) => c.badge_id === b.id)?.earned_at ?? '',
      }))
      setBadges(merged)
    }

    setLoading(false)
  }

  useEffect(() => { loadAll() }, [studentId, classId])

  const attRate = attendance.length > 0 ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100) : 0
  const hwDone  = homework.length > 0 ? submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length : 0
  const claimed = !!student?.profile_id

  if (loading || !student) {
    return (
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 56, borderRadius: 12, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
        ))}
      </div>
    )
  }

  return (
    <div id="student-profile-page" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: '100%' }}>
      <style>{`@keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }`}</style>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #10b981 150%)', padding: '20px 16px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <button onClick={() => router.push('/teacher/classhub/' + classId)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18, marginBottom: 20 }}>←</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: claimed ? 'linear-gradient(135deg, #10b981, #065f46)' : 'linear-gradient(135deg, #6d28d9, #4c1d95)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#fff', border: '3px solid rgba(255,255,255,0.2)' }}>
              {student.name.charAt(0).toUpperCase()}
            </div>
            {claimed && (
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: '#10b981', border: '2px solid #1e1b4b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 8, color: '#fff' }}>✓</span>
              </div>
            )}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>{student.name}</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '3px 0 4px' }}>
              {student.admission_number ? 'Adm · ' + student.admission_number : 'No admission number'}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: claimed ? 'rgba(16,185,129,0.2)' : 'rgba(255,193,7,0.2)', color: claimed ? '#10b981' : '#fbbf24' }}>
                {claimed ? '● Active' : '○ Unclaimed'}
              </span>
              {skills.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                  🌟 {skills[0].category}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <StatBox label="Attendance"  value={attRate + '%'} />
          <StatBox label="Assessments" value={assessments.length} />
          <StatBox label="HW Done"     value={homework.length > 0 ? hwDone + '/' + homework.length : '—'} />
          <StatBox label="Badges"      value={badges.length} />
        </div>
      </div>

      {/* TAB STRIP */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 56, zIndex: 100 }}>
        <div style={{ display: 'flex', overflowX: 'auto', padding: '0 8px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flexShrink: 0, padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: activeTab === t.id ? 800 : 600, color: activeTab === t.id ? C.accent : C.textMuted, borderBottom: activeTab === t.id ? '2.5px solid ' + C.accent : '2.5px solid transparent', transition: 'all 0.15s' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div style={{ padding: '16px', animation: 'slideDown 0.2s ease' }}>
        {activeTab === 'overview'    && <OverviewTab    student={student} classId={classId} studentCode={studentCode} parentCode={parentCode} onReload={loadAll} myGroups={myGroups} />}
        {activeTab === 'results'     && <ResultsTab     examResults={examResults} exams={exams} subjects={subjects} />}
        {activeTab === 'attendance'  && <AttendanceTab  records={attendance} />}
        {activeTab === 'assessments' && <AssessmentsTab assessments={assessments} subjects={subjects} />}
        {activeTab === 'homework'    && <HomeworkTab    homework={homework} submissions={submissions} />}
        {activeTab === 'resources'   && <ResourcesTab   resources={resources} />}
        {activeTab === 'journey'     && <JourneyTab     streaks={streaks} goals={goals} skills={skills} />}
        {activeTab === 'badges'      && <BadgesTab      badges={badges} />}
      </div>
    </div>
  )
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 56, borderRadius: 12, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
        ))}
      </div>
    }>
      <StudentProfileInner />
    </Suspense>
  )
}
