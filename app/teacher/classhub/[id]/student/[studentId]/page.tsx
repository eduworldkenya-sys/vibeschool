"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState, Suspense, CSSProperties } from 'react'
import { C } from '@/components/teacher/ui'
import { supabase } from '@/lib/supabase'
import { ClaimCodeCard } from '@/components/claims/ClaimCodeCard'
import { useRouter, useParams } from 'next/navigation'
import { getAttendanceRecords, summarizeAttendance } from '@/lib/attendance/summary'
import { getRangeDates } from '@/lib/attendance/ranges'
import type { AttendanceRecord, AttendanceRange } from '@/lib/types'

interface Student {
  id: string; name: string; admission_number: string | null
  profile_id: string | null; date_of_birth: string | null; parent_linked_at: string | null
  gender: string | null; autonomy_level: number | null; created_at: string
}
interface ClaimCode { code: string; claimed: boolean; expires_at: string | null; role: string }
interface Assessment {
  id: string; subject_id: string; strand_id: string | null; sub_strand: string | null
  assessment_type: string; performance: string; term: number; academic_year: number
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
interface ExamResult { id: string; exam_id: string; subject_id: string | null; marks: number; is_absent: boolean }
interface ExamItem { id: string; name: string; term: number; academic_year: number; exam_type: string; pass_mark: number }
interface Resource { id: string; title: string; type: string; subject: string; external_url: string | null; content: string | null; created_at: string }

type Tab = 'overview' | 'results' | 'attendance' | 'assessments' | 'homework' | 'resources' | 'journey' | 'badges'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '👤' },
  { id: 'results', label: 'Results', icon: '📊' },
  { id: 'attendance', label: 'Attendance', icon: '✅' },
  { id: 'assessments', label: 'Assessments', icon: '📊' },
  { id: 'homework', label: 'Homework', icon: '📝' },
  { id: 'resources', label: 'Resources', icon: '📚' },
  { id: 'journey', label: 'Journey', icon: '🚀' },
  { id: 'badges', label: 'Badges', icon: '🏅' },
]

const PERF_COLORS: Record<string, { bg: string; color: string }> = {
  EE: { bg: '#d1fae5', color: '#065f46' }, ME: { bg: '#dbeafe', color: '#1d4ed8' },
  AE: { bg: '#fef3c7', color: '#92400e' }, BE: { bg: '#fee2e2', color: '#991b1b' },
}

function pill(label: string, bg: string, color: string) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color }}>{label}</span>
}
function SectionHead({ title }: { title: string }) {
  return <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 12px' }}>{title}</p>
}
function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return <div style={{ background: '#fff', borderRadius: 20, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>{children}</div>
}
function EmptyState({ icon, text }: { icon: string; text: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0' }}><span style={{ fontSize: 32 }}>{icon}</span><p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', margin: 0 }}>{text}</p></div>
}
function StatBox({ label, value }: { label: string; value: string | number }) {
  return <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{value}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>{label}</div></div>
}

function OverviewTab({ student, claimCode, onGenerateCode, onRegenerateCode, myGroups }: {
  student: Student; claimCode: ClaimCode | null; onGenerateCode: () => Promise<void>; onRegenerateCode: () => Promise<void>; myGroups: StudentGroup[]
}) {
  async function handleResetPin() {
    const newPin = prompt('Enter new PIN for ' + student.name + ' (4-6 digits):')
    if (!newPin) return
    if (!/^\d{4,6}$/.test(newPin)) { alert('PIN must contain 4-6 digits.'); return }
    if (!student.profile_id) { alert('This learner has not claimed an account yet.'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { alert('Your session expired. Sign in again.'); return }
    const res = await fetch('/api/reset-student-pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ student_auth_id: student.profile_id, new_pin: newPin }) })
    const result = await res.json()
    if (result.ok) alert('PIN reset for ' + student.name)
    else alert('Failed: ' + result.error)
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Card><SectionHead title="School learner identity" /><div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 12 }}><p style={{ margin: 0, fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>This is the same canonical learner identity used by the student and parent views. Teacher access is instructional; school identity corrections must go through authorized school administration.</p></div><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[{ label: 'Full Name', value: student.name }, { label: 'Admission No.', value: student.admission_number || '—' }, { label: 'Gender', value: student.gender || '—' }, { label: 'Date of Birth', value: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '—' }, { label: 'Autonomy Level', value: student.autonomy_level != null ? String(student.autonomy_level) : '—' }, { label: 'Enrolled', value: new Date(student.created_at).toLocaleDateString() }, { label: 'Account Status', value: student.profile_id ? 'Claimed ✓' : 'Unclaimed' }, { label: 'Parent Status', value: student.parent_linked_at ? 'Parent Linked ✓' : 'No Parent Linked' }].map(row => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}><span style={{ fontSize: 12, color: C.textMuted }}>{row.label}</span><span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{row.value}</span></div>)}</div></Card>
    {myGroups.length > 0 && <Card><SectionHead title="Groups" /><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{myGroups.map(g => <div key={`${g.type}:${g.name}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}><span style={{ fontSize: 12, color: C.textMuted, textTransform: 'capitalize' }}>{g.type} Group</span><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: g.bg, color: g.color }}>{g.name}</span></div>)}</div></Card>}
    <ClaimCodeCard studentName={student.name} code={claimCode?.code ?? null} expiresAt={claimCode?.expires_at ?? null} onGenerate={onGenerateCode} onRegenerate={onRegenerateCode} />
    {student.profile_id && <Card><SectionHead title="Learner account" /><button onClick={handleResetPin} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Reset learner PIN</button><p style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.45, margin: '8px 0 0' }}>Only use this when the learner cannot access their existing account. The claim code is separate from the PIN.</p></Card>}
  </div>
}

const ATTENDANCE_RANGES: { id: AttendanceRange | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'term', label: 'Term' }, { id: 'year', label: 'Year' },
]

function AttendanceTab({ records, studentId }: { records: AttendanceRecord[]; studentId: string }) {
  const [range, setRange] = useState<AttendanceRange | 'all'>('all')
  const [rangeRecords, setRangeRecords] = useState<AttendanceRecord[] | null>(null)
  const [rangeLoading, setRangeLoading] = useState(false)
  useEffect(() => {
    if (range === 'all') { setRangeRecords(null); return }
    const activeRange: AttendanceRange = range; let cancelled = false
    async function load() { setRangeLoading(true); const { startDate, endDate } = await getRangeDates(activeRange); const data = await getAttendanceRecords({ studentId, startDate, endDate }); if (!cancelled) { setRangeRecords(data); setRangeLoading(false) } }
    load(); return () => { cancelled = true }
  }, [range, studentId])
  const activeRecords = range === 'all' ? records : (rangeRecords ?? [])
  const summary = summarizeAttendance(activeRecords)
  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = { present: { bg: '#d1fae5', color: '#065f46', label: 'Present' }, absent: { bg: '#fee2e2', color: '#991b1b', label: 'Absent' }, excused: { bg: '#e0f2fe', color: '#075985', label: 'Excused' } }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><div style={{ display: 'flex', gap: 6 }}>{ATTENDANCE_RANGES.map(r => <button key={r.id} onClick={() => setRange(r.id)} style={{ flex: 1, padding: '7px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 11, background: range === r.id ? C.accentLight : '#f3f4f6', color: range === r.id ? '#065f46' : C.textMuted }}>{r.label}</button>)}</div><div style={{ display: 'flex', gap: 8 }}>{[{ label: 'Rate', value: summary.rate + '%' }, { label: 'Present', value: summary.present }, { label: 'Absent', value: summary.absent }, { label: 'Late', value: summary.late }].map(s => <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '12px 6px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}><div style={{ fontSize: 18, fontWeight: 900, color: C.textPrimary }}>{s.value}</div><div style={{ fontSize: 9, color: C.textMuted, fontWeight: 600, marginTop: 2 }}>{s.label}</div></div>)}</div><Card><SectionHead title="Attendance Log" />{rangeLoading ? <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.textMuted }}>Loading…</div> : activeRecords.length === 0 ? <EmptyState icon="🗓️" text="No attendance records yet" /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{activeRecords.slice(0, 30).map(r => { const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.present; return <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}><div><p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>{r.notes && <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{r.notes}</p>}</div><div style={{ display: 'flex', gap: 4 }}>{r.is_late && pill('Late', '#fef3c7', '#92400e')}{pill(s.label, s.bg, s.color)}</div></div> })}</div>}</Card></div>
}

function AssessmentsTab({ assessments, subjects }: { assessments: Assessment[]; subjects: Subject[] }) {
  const subjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? id
  const grouped = assessments.reduce<Record<string, Assessment[]>>((acc, a) => { const key = subjectName(a.subject_id); acc[key] = acc[key] ?? []; acc[key].push(a); return acc }, {})
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{assessments.length === 0 ? <Card><EmptyState icon="📊" text="No assessments recorded yet" /></Card> : Object.entries(grouped).map(([subject, items]) => <Card key={subject}><SectionHead title={subject} /><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{items.map(a => { const pc = PERF_COLORS[a.performance] ?? { bg: '#f3f4f6', color: '#374151' }; return <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}><div><p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{a.assessment_type}</p><p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>Term {a.term} · {a.academic_year}{a.sub_strand ? ' · ' + a.sub_strand : ''}</p>{a.notes && <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0', fontStyle: 'italic' }}>{a.notes}</p>}</div>{pill(a.performance, pc.bg, pc.color)}</div> })}</div></Card>)}</div>
}

function HomeworkTab({ homework, submissions }: { homework: Homework[]; submissions: Submission[] }) {
  const subMap = Object.fromEntries(submissions.map(s => [s.homework_id, s]))
  const STATUS_STYLE: Record<string, { bg: string; color: string }> = { submitted: { bg: '#d1fae5', color: '#065f46' }, pending: { bg: '#fef3c7', color: '#92400e' }, late: { bg: '#fee2e2', color: '#991b1b' }, graded: { bg: '#dbeafe', color: '#1d4ed8' } }
  return <Card><SectionHead title="Homework" />{homework.length === 0 ? <EmptyState icon="📝" text="No homework assigned yet" /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{homework.map(hw => { const sub = subMap[hw.id]; const status = sub?.status ?? 'pending'; const sc = STATUS_STYLE[status] ?? STATUS_STYLE.pending; return <div key={hw.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{hw.title}</p><p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{hw.subject} · Due {new Date(hw.due_date).toLocaleDateString()}</p></div>{pill(status.charAt(0).toUpperCase() + status.slice(1), sc.bg, sc.color)}</div>{sub?.feedback && <p style={{ fontSize: 11, color: C.textMuted, margin: '6px 0 0', fontStyle: 'italic' }}>💬 {sub.feedback}</p>}{sub?.mark != null && <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, margin: '4px 0 0' }}>Mark: {sub.mark}</p>}</div> })}</div>}</Card>
}

function ResourcesTab({ resources }: { resources: Resource[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = { notes: { icon: '📄', color: '#1d4ed8', bg: '#dbeafe' }, assessment: { icon: '📝', color: '#065f46', bg: '#d1fae5' }, exercise: { icon: '🏋️', color: '#92400e', bg: '#fef3c7' }, quiz: { icon: '🧪', color: '#6d28d9', bg: '#ede9fe' }, video: { icon: '📺', color: '#991b1b', bg: '#fee2e2' }, other: { icon: '📁', color: '#374151', bg: '#f3f4f6' } }
  return <Card><SectionHead title="Class Resources" />{resources.length === 0 ? <EmptyState icon="📚" text="No resources assigned to this class yet" /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{resources.map(r => { const meta = TYPE_META[r.type] ?? TYPE_META.other; const isOpen = expanded === r.id; return <div key={r.id} style={{ borderLeft: `3px solid ${meta.color}`, paddingLeft: 10, borderRadius: 4 }}><button onClick={() => setExpanded(isOpen ? null : r.id)} style={{ width: '100%', background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18 }}>{meta.icon}</span><div><p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{r.title}</p><p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{r.subject}</p></div></div><span style={{ fontSize: 12, color: C.textMuted }}>{isOpen ? '▲' : '▼'}</span></button>{isOpen && <div style={{ paddingBottom: 10 }}>{r.content && <p style={{ fontSize: 13, color: C.textPrimary, whiteSpace: 'pre-wrap', margin: 0 }}>{r.content}</p>}{r.external_url && <a href={r.external_url} target="_blank" rel="noreferrer noopener" style={{ display: 'inline-block', marginTop: 8, padding: '7px 14px', borderRadius: 8, background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>Open Link</a>}</div>}</div> })}</div>}</Card>
}

function JourneyTab({ streaks, goals, skills }: { streaks: Streak[]; goals: Goal[]; skills: Skill[] }) {
  const SKILL_LEVEL_COLORS: Record<string, { bg: string; color: string }> = { beginner: { bg: '#fef3c7', color: '#92400e' }, developing: { bg: '#dbeafe', color: '#1d4ed8' }, proficient: { bg: '#d1fae5', color: '#065f46' }, advanced: { bg: '#ede9fe', color: '#6d28d9' }, expert: { bg: '#fce7f3', color: '#9d174d' } }
  const GOAL_STATUS_COLORS: Record<string, { bg: string; color: string }> = { active: { bg: '#dbeafe', color: '#1d4ed8' }, completed: { bg: '#d1fae5', color: '#065f46' }, paused: { bg: '#f3f4f6', color: '#374151' } }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><Card><SectionHead title="Learning Streaks" />{streaks.length === 0 ? <EmptyState icon="🔥" text="No streaks recorded yet" /> : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{streaks.map((s, i) => <div key={i} style={{ flex: 1, minWidth: 100, background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{s.current_count}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 2 }}>{s.type}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Best: {s.longest_count}</div></div>)}</div>}</Card><Card style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #064e3b 100%)' }}><SectionHead title="Talent Projection" />{skills.length === 0 ? <EmptyState icon="🌟" text="No skills recorded yet" /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{skills.map(sk => { const lc = SKILL_LEVEL_COLORS[sk.level.toLowerCase()] ?? { bg: '#f3f4f6', color: '#374151' }; return <div key={sk.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}><div><p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>{sk.name}</p><p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{sk.category}{sk.endorsed_by ? ' · Endorsed' : ''}</p></div>{pill(sk.level, lc.bg, lc.color)}</div> })}</div>}</Card><Card><SectionHead title="Goals" />{goals.length === 0 ? <EmptyState icon="🎯" text="No goals set yet" /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{goals.map(g => { const gc = GOAL_STATUS_COLORS[g.status] ?? GOAL_STATUS_COLORS.active; return <div key={g.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{g.title}</p>{pill(g.status, gc.bg, gc.color)}</div><p style={{ fontSize: 11, color: C.textMuted, margin: '3px 0 0' }}>{g.category}{g.target_date ? ' · ' + new Date(g.target_date).toLocaleDateString() : ''}</p>{g.description && <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0', fontStyle: 'italic' }}>{g.description}</p>}</div> })}</div>}</Card></div>
}

function BadgesTab({ badges }: { badges: Badge[] }) {
  const LEVEL_COLORS: Record<string, { bg: string; color: string }> = { bronze: { bg: '#fef3c7', color: '#92400e' }, silver: { bg: '#f3f4f6', color: '#374151' }, gold: { bg: '#fef9c3', color: '#854d0e' } }
  return <Card><SectionHead title={`Badges · ${badges.length} earned`} />{badges.length === 0 ? <EmptyState icon="🏅" text="No badges earned yet" /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>{badges.map(b => { const lc = LEVEL_COLORS[b.level?.toLowerCase()] ?? { bg: '#ede9fe', color: '#6d28d9' }; return <div key={b.id} style={{ background: lc.bg, borderRadius: 16, padding: '14px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 28 }}>{b.icon || '🏅'}</span><p style={{ fontSize: 11, fontWeight: 800, color: lc.color, margin: 0, lineHeight: 1.3 }}>{b.name}</p><p style={{ fontSize: 9, color: lc.color, margin: 0, opacity: 0.7 }}>{new Date(b.earned_at).toLocaleDateString()}</p></div> })}</div>}</Card>
}

function ResultsTab({ examResults, exams, subjects }: { examResults: ExamResult[]; exams: ExamItem[]; subjects: Subject[] }) {
  function getGrade(marks: number): string { if (marks >= 80) return 'A'; if (marks >= 75) return 'A-'; if (marks >= 70) return 'B+'; if (marks >= 65) return 'B'; if (marks >= 60) return 'B-'; if (marks >= 55) return 'C+'; if (marks >= 50) return 'C'; if (marks >= 45) return 'C-'; if (marks >= 40) return 'D+'; if (marks >= 35) return 'D'; if (marks >= 30) return 'D-'; return 'E' }
  function gradeColor(g: string): { bg: string; color: string } { if (g === 'A') return { bg: '#d1fae5', color: '#065f46' }; if (g === 'A-' || g === 'B+') return { bg: '#dbeafe', color: '#1e40af' }; if (['B','B-','C+'].includes(g)) return { bg: '#fef3c7', color: '#92400e' }; if (['C','C-','D+'].includes(g)) return { bg: '#fed7aa', color: '#9a3412' }; return { bg: '#fee2e2', color: '#991b1b' } }
  function subjectName(id: string | null): string { if (!id) return 'General'; return subjects.find(s => s.id === id)?.name ?? 'Unknown' }
  if (exams.length === 0 || examResults.length === 0) return <Card><EmptyState icon="📊" text="No exam results recorded yet" /></Card>
  const examAverages = exams.map(e => { const ers = examResults.filter(r => r.exam_id === e.id && !r.is_absent); if (!ers.length) return null; return { name: e.name, avg: Math.round(ers.reduce((a, r) => a + r.marks, 0) / ers.length), pass_mark: e.pass_mark } }).filter(Boolean) as { name: string; avg: number; pass_mark: number }[]
  const trend = examAverages.length >= 2 ? examAverages[examAverages.length - 1].avg - examAverages[0].avg : 0
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><div style={{ background: 'linear-gradient(135deg, #1c1917, #292524)', borderRadius: 20, padding: 16 }}><p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 800, color: '#C8A84B', letterSpacing: 2, textTransform: 'uppercase' }}>Performance Trend</p><div style={{ display: 'flex', gap: 8 }}>{examAverages.map((e, i) => <div key={i} style={{ flex: 1, textAlign: 'center' }}><strong style={{ color: '#fff', fontSize: 18 }}>{e.avg}</strong><div style={{ color: 'rgba(255,255,255,.5)', fontSize: 9 }}>{e.name}</div></div>)}</div>{examAverages.length >= 2 && <p style={{ margin: '12px 0 0', fontSize: 12, fontWeight: 700, color: trend >= 0 ? '#10b981' : '#ef4444' }}>{trend >= 0 ? `↑ Improved by ${trend} marks` : `↓ Dropped by ${Math.abs(trend)} marks`} since first exam</p>}</div>{exams.map(exam => { const ers = examResults.filter(r => r.exam_id === exam.id); if (!ers.length) return null; const present = ers.filter(r => !r.is_absent); const avg = present.length ? Math.round(present.reduce((a, r) => a + r.marks, 0) / present.length) : 0; return <Card key={exam.id}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><div><p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textPrimary }}>{exam.name}</p><p style={{ margin: '2px 0 0', fontSize: 11, color: C.textMuted }}>Term {exam.term} · {exam.academic_year} · {exam.exam_type}</p></div><strong style={{ fontSize: 22 }}>{avg}</strong></div>{ers.map(r => { const grade = r.is_absent ? null : getGrade(r.marks); const gc = grade ? gradeColor(grade) : null; return <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: '#f9f7f4', marginBottom: 6 }}><span>{subjectName(r.subject_id)}</span><span>{r.is_absent ? 'ABS' : r.marks} {grade && gc && <span style={{ padding: '2px 6px', borderRadius: 8, background: gc.bg, color: gc.color, fontWeight: 800 }}>{grade}</span>}</span></div> })}<p style={{ margin: '10px 0 0', fontSize: 11, color: C.textMuted }}>Pass mark: {exam.pass_mark}</p></Card> })}</div>
}

function StudentProfileInner() {
  const router = useRouter(); const params = useParams(); const classId = params.id as string; const studentId = params.studentId as string
  const [student, setStudent] = useState<Student | null>(null); const [claimCode, setClaimCode] = useState<ClaimCode | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]); const [assessments, setAssessments] = useState<Assessment[]>([]); const [homework, setHomework] = useState<Homework[]>([]); const [submissions, setSubmissions] = useState<Submission[]>([]); const [resources, setResources] = useState<Resource[]>([]); const [streaks, setStreaks] = useState<Streak[]>([]); const [goals, setGoals] = useState<Goal[]>([]); const [skills, setSkills] = useState<Skill[]>([]); const [badges, setBadges] = useState<Badge[]>([]); const [examResults, setExamResults] = useState<ExamResult[]>([]); const [exams, setExams] = useState<ExamItem[]>([]); const [subjects, setSubjects] = useState<Subject[]>([]); const [myGroups, setMyGroups] = useState<StudentGroup[]>([]); const [loading, setLoading] = useState(true); const [activeTab, setActiveTab] = useState<Tab>('overview')

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.push('/'); return }
    const [stuRes, codeRes, attRes, asmRes, hwRes, subjRes, resRes, strRes, goalRes, skillRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).eq('class_id', classId).single(),
      supabase.from('student_claim_codes').select('code, role, claimed, expires_at').eq('student_id', studentId).order('expires_at', { ascending: false }).limit(1),
      supabase.from('attendance').select('*').eq('student_id', studentId).eq('class_id', classId).order('date', { ascending: false }),
      supabase.from('cbc_assessments').select('*').eq('student_id', studentId).eq('class_id', classId).order('created_at', { ascending: false }),
      supabase.from('homework').select('*').eq('class_id', classId).order('due_date', { ascending: false }), supabase.from('subjects').select('id, name'),
      supabase.from('resources').select('*').eq('class_id', classId).order('created_at', { ascending: false }), supabase.from('child_streaks').select('*').eq('student_id', studentId),
      supabase.from('child_goals').select('*').eq('student_id', studentId).is('deleted_at', null).order('created_at', { ascending: false }), supabase.from('child_skills').select('*').eq('student_id', studentId).is('deleted_at', null).order('created_at', { ascending: false }),
    ])
    if (!stuRes.data) { router.push('/teacher/classhub/' + classId); return }
    const [erRes, grpRes, cbRes] = await Promise.all([supabase.from('exam_results').select('id, exam_id, subject_id, marks, is_absent').eq('student_id', studentId), supabase.from('class_groups').select('id, name, color, type').eq('class_id', classId), supabase.from('child_badges').select('id, badge_id, earned_at, awarded_by, created_at').eq('student_id', studentId)])
    const erRows = (erRes.data ?? []) as ExamResult[]; const grpData = grpRes.data ?? []; const cb = cbRes.data ?? []
    const [examData, mbrData, subsData, bdgsData] = await Promise.all([
      erRows.length ? supabase.from('exams').select('id, name, term, academic_year, exam_type, pass_mark').in('id', Array.from(new Set(erRows.map(r => r.exam_id)))).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      supabase.from('class_group_members').select('group_id').eq('student_id', studentId), hwRes.data?.length ? supabase.from('homework_submissions').select('*').eq('student_id', studentId).in('homework_id', hwRes.data.map((h: { id: string }) => h.id)) : Promise.resolve({ data: [] }),
      cb.length ? supabase.from('badges').select('*').in('id', cb.map(row => row.badge_id).filter((id): id is string => id !== null)) : Promise.resolve({ data: [] }),
    ])
    setExamResults(erRows); setExams((examData.data ?? []) as ExamItem[])
    const myGroupIds = new Set((mbrData.data ?? []).map(row => row.group_id).filter((id): id is string => id !== null)); const COLOR_BG: Record<string, string> = { '#065f46': '#d1fae5', '#92400e': '#fef3c7', '#991b1b': '#fee2e2', '#1d4ed8': '#dbeafe', '#6d28d9': '#ede9fe', '#0f766e': '#ccfbf1', '#9d174d': '#fce7f3' }
    setMyGroups(grpData.filter(group => myGroupIds.has(group.id)).map(group => { const color = group.color ?? '#64748b'; return { type: group.type ?? 'group', name: group.name ?? 'Unnamed group', color, bg: COLOR_BG[color] ?? '#f3f4f6' } }))
    const stu = stuRes.data; setStudent({ id: stu.id, name: stu.name, admission_number: stu.admission_number, profile_id: stu.profile_id, date_of_birth: stu.date_of_birth, parent_linked_at: stu.parent_linked_at, gender: stu.gender, autonomy_level: stu.autonomy_level, created_at: stu.created_at ?? '' })
    const codes = (codeRes.data ?? []) as ClaimCode[]; setClaimCode(codes[0] ?? null); setAttendance(attRes.data ?? [])
    setAssessments((asmRes.data ?? []).map((a: any): Assessment => ({ id: a.id, subject_id: a.subject_id, strand_id: a.strand_id, sub_strand: a.sub_strand, assessment_type: a.assessment_type, performance: a.performance, term: a.term, academic_year: a.academic_year, notes: a.notes, created_at: a.created_at })))
    setSubjects(subjRes.data ?? []); setHomework((hwRes.data ?? []).map((h: any): Homework => ({ id: h.id, title: h.title, subject: h.subject, due_date: h.due_date ?? '', type: h.type }))); setSubmissions((subsData.data ?? []).map((s: any): Submission => ({ homework_id: s.homework_id, status: s.status, mark: s.mark, feedback: s.feedback, submitted_at: s.submitted_at }))); setResources((resRes.data ?? []).map((r: any): Resource => ({ id: r.id, title: r.title, type: r.type, subject: r.subject, external_url: r.external_url, content: r.content, created_at: r.created_at ?? '' }))); setStreaks((strRes.data ?? []).map((s: any): Streak => ({ type: s.type, current_count: s.current_count, longest_count: s.longest_count, last_recorded: s.last_recorded ?? '' }))); setGoals((goalRes.data ?? []).map((g: any): Goal => ({ id: g.id, title: g.title, category: g.category, status: g.status, target_date: g.target_date, description: g.description }))); setSkills((skillRes.data ?? []).map((s: any): Skill => ({ id: s.id, name: s.name, category: s.category, level: s.level, notes: s.notes, endorsed_by: s.endorsed_by })))
    if (cb.length) setBadges((bdgsData.data ?? []).map(badge => ({ id: badge.id, name: badge.name ?? 'Unnamed badge', icon: badge.icon ?? '🏅', category: badge.category ?? 'general', level: badge.level?.toString() ?? '', description: badge.description ?? '', earned_at: cb.find(row => row.badge_id === badge.id)?.earned_at ?? '' }))); else setBadges([])
    setLoading(false)
  }
  useEffect(() => { void loadAll() }, [studentId, classId])
  async function generateClaimCode() { const { data, error } = await supabase.rpc('teacher_generate_shared_claim_code', { p_student_id: studentId }); if (error) { alert(error.message === 'unauthorized_teacher' ? 'You are not authorized to manage this learner.' : 'We could not create the claim code. Please try again.'); return } const result = data as { status?: string; code?: string; expires_at?: string | null } | null; if (result?.status === 'success' && result.code) setClaimCode({ code: result.code, claimed: false, expires_at: result.expires_at ?? null, role: 'shared' }); else alert('We could not create the claim code. Please try again.') }

  const attRate = attendance.length ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100) : 0; const hwDone = homework.length ? submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length : 0; const claimed = !!student?.profile_id
  if (loading || !student) return <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3,4].map(i => <div key={i} style={{ height: 56, borderRadius: 12, background: '#f0f0f0' }} />)}</div>
  return <div id="student-profile-page" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: '100%' }}><div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #10b981 150%)', padding: '20px 16px 28px' }}><button onClick={() => router.push('/teacher/classhub/' + classId)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', fontSize: 18, marginBottom: 20 }}>←</button><div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}><div style={{ width: 72, height: 72, borderRadius: '50%', background: claimed ? 'linear-gradient(135deg, #10b981, #065f46)' : 'linear-gradient(135deg, #6d28d9, #4c1d95)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#fff' }}>{student.name.charAt(0).toUpperCase()}</div><div><h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{student.name}</h1><p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '3px 0' }}>{student.admission_number ? 'Adm · ' + student.admission_number : 'No admission number'}</p><span style={{ fontSize: 10, color: claimed ? '#10b981' : '#fbbf24' }}>{claimed ? '● Active' : '○ Unclaimed'}</span></div></div><div style={{ display: 'flex', gap: 8 }}><StatBox label="Attendance" value={attRate + '%'} /><StatBox label="Assessments" value={assessments.length} /><StatBox label="HW Done" value={homework.length ? hwDone + '/' + homework.length : '—'} /><StatBox label="Badges" value={badges.length} /></div></div><div style={{ background: '#fff', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 56, zIndex: 100 }}><div style={{ display: 'flex', overflowX: 'auto', padding: '0 8px' }}>{TABS.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flexShrink: 0, padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: activeTab === t.id ? 800 : 600, color: activeTab === t.id ? C.accent : C.textMuted, borderBottom: activeTab === t.id ? '2.5px solid ' + C.accent : '2.5px solid transparent' }}>{t.icon} {t.label}</button>)}</div></div><div style={{ padding: 16 }}>{activeTab === 'overview' && <OverviewTab student={student} claimCode={claimCode} onGenerateCode={generateClaimCode} onRegenerateCode={generateClaimCode} myGroups={myGroups} />}{activeTab === 'results' && <ResultsTab examResults={examResults} exams={exams} subjects={subjects} />}{activeTab === 'attendance' && <AttendanceTab records={attendance} studentId={studentId} />}{activeTab === 'assessments' && <AssessmentsTab assessments={assessments} subjects={subjects} />}{activeTab === 'homework' && <HomeworkTab homework={homework} submissions={submissions} />}{activeTab === 'resources' && <ResourcesTab resources={resources} />}{activeTab === 'journey' && <JourneyTab streaks={streaks} goals={goals} skills={skills} />}{activeTab === 'badges' && <BadgesTab badges={badges} />}</div></div>
}

export default function StudentProfilePage() {
  return <Suspense fallback={<div style={{ padding: 20 }}>Loading learner profile…</div>}><StudentProfileInner /></Suspense>
}
