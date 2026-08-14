"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/student/StudentUiContext'
import { useStudent } from '@/lib/student-context'
import { getLearnerCoreIdentity } from '@/lib/learner/profile-core'
import { summarizeAttendance } from '@/lib/attendance/summary'
import type { AttendanceRecord } from '@/lib/types'
import { getLearnerTwinState, type LearnerTwinState } from '@/lib/student/twin'
import { getPersonalizedLearningPath, getStudentHomeOsBrief, type StudentHomeOsBrief, type StudentPersonalizedPath } from '@/lib/student/tasks'

const C = {
  bg: '#f0f2f5', surface: '#ffffff', border: '#e5e7eb', textPrimary: '#111827',
  textMuted: '#6b7280', dark: '#1e1b4b', accent: '#6366f1', accentLight: '#eef2ff', error: '#ef4444',
}

interface SchoolIdentityDetails { date_of_birth: string; gender: string }
interface GuardianData { full_name: string; relationship: string }
interface Learner360Data {
  avatarUrl: string
  schoolIdentity: SchoolIdentityDetails
  guardian: GuardianData | null
  attendancePct: number | null
  home: StudentHomeOsBrief
  path: StudentPersonalizedPath
  twin: LearnerTwinState
}

function Skeleton({ h = 44 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 14, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
}
function Card({ children }: { children: React.ReactNode }) {
  return <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>{children}</section>
}
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return <div style={{ marginBottom: 13 }}><h2 style={{ margin: 0, color: C.textPrimary, fontSize: 15, fontWeight: 850 }}>{title}</h2>{sub && <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 11, lineHeight: 1.45 }}>{sub}</p>}</div>
}
function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div style={{ background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, minWidth: 0 }}><div style={{ fontSize: 18, color: C.textPrimary, fontWeight: 900 }}>{value}</div><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 750, marginTop: 2 }}>{label}</div>{hint && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 3 }}>{hint}</div>}</div>
}
function percent(value: number | null) { return value == null ? '—' : `${Math.round(value)}%` }
function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

export default function StudentProfilePage() {
  const router = useRouter()
  const { identity, loading: identityLoading, error: identityError } = useStudent()
  const { theme, setTheme } = useTheme()
  const [data, setData] = useState<Learner360Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    if (identityLoading) return
    if (!identity) { setLoading(false); return }
    const activeIdentity = identity
    let cancelled = false

    async function load() {
      setLoading(true); setPageError(null)
      try {
        const [learner, home, path, twin, attendanceRes, linkRes] = await Promise.all([
          getLearnerCoreIdentity(activeIdentity.studentId),
          getStudentHomeOsBrief(),
          getPersonalizedLearningPath(),
          getLearnerTwinState(),
          supabase.from('attendance').select('id,student_id,class_id,date,status,is_late,notes').eq('student_id', activeIdentity.studentId),
          supabase.from('parent_student_links').select('parent_id,relationship,is_primary').eq('student_id', activeIdentity.studentId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
        ])

        const attendanceSummary = summarizeAttendance((attendanceRes.data ?? []) as AttendanceRecord[])
        const attendancePct = attendanceSummary.total > 0 ? attendanceSummary.rate : null

        let guardian: GuardianData | null = null
        if (linkRes.data?.parent_id) {
          const { data: parentProfile } = await supabase.from('profiles').select('full_name').eq('id', linkRes.data.parent_id).maybeSingle()
          guardian = { full_name: parentProfile?.full_name ?? 'Connected guardian', relationship: linkRes.data.relationship ?? 'Guardian' }
        }

        if (!cancelled) setData({
          avatarUrl: learner.avatarUrl,
          schoolIdentity: { date_of_birth: learner.dateOfBirth ?? '', gender: learner.gender ?? '' },
          guardian, attendancePct, home, path, twin,
        })
      } catch (cause) {
        if (!cancelled) setPageError(cause instanceof Error ? cause.message : 'Your learner profile could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [identity, identityLoading])

  const strengths = useMemo(() => [...(data?.twin.mastery.subjects ?? [])].filter(s => s.masteryPercentage != null).sort((a, b) => (b.masteryPercentage ?? 0) - (a.masteryPercentage ?? 0)).slice(0, 3), [data])
  const focus = useMemo(() => [...(data?.twin.mastery.subjects ?? [])].filter(s => s.masteryPercentage != null).sort((a, b) => (a.masteryPercentage ?? 0) - (b.masteryPercentage ?? 0)).slice(0, 3), [data])

  async function signOut() {
    await supabase.auth.signOut(); document.cookie = 'vibe_role=; path=/; max-age=0'; router.replace('/')
  }

  if (identityLoading || loading) return <div style={{ display: 'grid', gap: 12, padding: 16 }}><style>{`@keyframes shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style><Skeleton h={190} /><Skeleton h={112} /><Skeleton h={180} /><Skeleton h={180} /></div>
  if (!identity) return <div style={{ padding: 16, color: C.error }}>{identityError || 'Student identity is unavailable.'}</div>

  const progress = data?.home.progress
  const achievements = data?.path.motivation.achievements ?? []
  const timeline = data?.path.timeline ?? []
  const recommendations = progress?.recommendations ?? []

  return <div style={{ background: C.bg, minHeight: '100%', padding: '14px 14px 30px' }}>
    <style>{`@keyframes shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    <button onClick={() => router.push('/student')} style={{ border: 'none', background: 'none', color: C.textMuted, fontSize: 12, fontWeight: 700, padding: '2px 0 12px', cursor: 'pointer' }}>← Home</button>

    <section style={{ background: C.dark, color: '#fff', borderRadius: 22, padding: 18, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><div style={{ width: 78, height: 78, borderRadius: '50%', overflow: 'hidden', background: '#312e81', border: '3px solid rgba(255,255,255,.3)', display: 'grid', placeItems: 'center', fontSize: 30, flexShrink: 0 }}>{data?.avatarUrl ? <img src={data.avatarUrl} alt="Profile photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 10, letterSpacing: 1.2, opacity: .65, fontWeight: 800 }}>MY LEARNER PROFILE</div><h1 style={{ margin: '4px 0', fontSize: 22, lineHeight: 1.15 }}>{identity.name}</h1><p style={{ margin: 0, fontSize: 12, opacity: .75 }}>{identity.className || 'Class not assigned'}{identity.schoolName ? ` · ${identity.schoolName}` : ''}</p></div></div>
      <p style={{ margin: '14px 0 0', fontSize: 11, opacity: .72, lineHeight: 1.55 }}>One learner record: school identity, progress, achievements, journey and Twin evidence. Parent and teacher views use the same identity with role-appropriate information.</p>
    </section>

    {(pageError || identityError) && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, color: '#991b1b', padding: 12, fontSize: 12, marginBottom: 12 }}>{pageError || identityError}</div>}

    {data && <div style={{ display: 'grid', gap: 12 }}>
      <Card><SectionHead title="Learning pulse" sub="A quick view of your current learning state." /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}><Metric label="Twin confidence" value={percent(data.twin.confidence * 100)} hint="Verified evidence behind your Twin" /><Metric label="Attendance" value={percent(data.attendancePct)} /><Metric label="Learning streak" value={data.twin.streak.current} hint={`Best ${data.twin.streak.longest}`} /><Metric label="Verified XP" value={progress?.totalXp ?? 0} /></div></Card>

      <Card><SectionHead title="My goals" sub="Learning targets belong to your learner profile." /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}><Metric label="Target grade" value={progress?.targets.kcseTargetGrade ?? 'Not set'} /><Metric label="Weekly study" value={`${progress?.targets.weeklyStudyMinutes ?? 300}m`} /><Metric label="Focus session" value={`${progress?.targets.preferredSessionMinutes ?? 25}m`} /></div><button onClick={() => router.push('/student/profile/goals')} style={{ marginTop: 12, width: '100%', padding: 11, borderRadius: 12, border: `1px solid ${C.border}`, background: '#fff', fontWeight: 800, color: C.accent, cursor: 'pointer' }}>Manage learning goals</button></Card>

      <Card><SectionHead title="My strengths" sub="Built from marked and verified learning evidence." />{strengths.length === 0 ? <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>Strengths appear after enough verified learning evidence is available.</p> : strengths.map(subject => <div key={subject.subjectId} style={{ marginBottom: 11 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}><strong>{subject.subjectName}</strong><span>{percent(subject.masteryPercentage)}</span></div><div style={{ height: 7, borderRadius: 99, background: '#eef2ff', marginTop: 5, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(0, Math.min(100, subject.masteryPercentage ?? 0))}%`, background: C.accent, borderRadius: 99 }} /></div></div>)}</Card>

      <Card><SectionHead title="What I am working on" sub="Focus areas are learning opportunities, not labels." />{focus.length === 0 ? <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>Focus areas appear after enough learning evidence is available.</p> : focus.map(subject => <div key={subject.subjectId} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f3f4f6', gap: 12 }}><div><strong style={{ fontSize: 12 }}>{subject.subjectName}</strong><div style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>{subject.completedTasks} verified tasks completed</div></div><span style={{ fontSize: 12, fontWeight: 850, color: C.accent }}>{percent(subject.masteryPercentage)}</span></div>)}{recommendations[0] && <div style={{ marginTop: 12, padding: 12, background: C.accentLight, borderRadius: 12 }}><div style={{ fontSize: 10, color: C.accent, fontWeight: 850 }}>RECOMMENDED NEXT</div><strong style={{ display: 'block', fontSize: 12, marginTop: 3 }}>{recommendations[0].title}</strong><p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 10, lineHeight: 1.45 }}>{recommendations[0].reason}</p></div>}</Card>

      <Card><SectionHead title="My achievements" sub="Milestones earned from real learning activity." />{achievements.length === 0 ? <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>Your first achievement will appear here when it is earned.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>{achievements.slice(0, 6).map(item => <div key={item.slug} style={{ border: `1px solid ${C.border}`, borderRadius: 13, padding: 11 }}><div style={{ fontSize: 20 }}>{item.icon}</div><strong style={{ display: 'block', fontSize: 11, marginTop: 4 }}>{item.title}</strong><span style={{ display: 'block', color: C.textMuted, fontSize: 9, marginTop: 2 }}>{item.description}</span></div>)}</div>}</Card>

      <Card><SectionHead title="My learning journey" sub="One timeline shared by your learning system." />{timeline.length === 0 ? <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>Learning events will build your journey here.</p> : timeline.slice(0, 6).map(event => <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: 10, padding: '8px 0' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, marginTop: 4 }} /><div><strong style={{ fontSize: 11 }}>{event.title}</strong>{event.summary && <p style={{ margin: '2px 0', color: C.textMuted, fontSize: 10, lineHeight: 1.4 }}>{event.summary}</p>}<span style={{ color: '#9ca3af', fontSize: 9 }}>{formatDate(event.occurredAt)}</span></div></div>)}</Card>

      <Card><SectionHead title="My Twin" sub="Your Twin consumes the same learner evidence shown across VibeSchool." /><div style={{ background: '#f8fafc', borderRadius: 14, padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: C.textMuted, fontSize: 11 }}>Evidence confidence</span><strong style={{ fontSize: 12 }}>{percent(data.twin.evidence.stateConfidence * 100)}</strong></div><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}><span style={{ color: C.textMuted, fontSize: 11 }}>Learning events</span><strong style={{ fontSize: 12 }}>{data.twin.evidence.learningEventCount}</strong></div><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 }}><span style={{ color: C.textMuted, fontSize: 11 }}>Verified task receipts</span><strong style={{ fontSize: 12 }}>{data.twin.evidence.taskReceiptCount}</strong></div></div>{data.twin.decision.now && <div style={{ marginTop: 10, padding: 12, borderRadius: 13, background: C.accentLight }}><div style={{ fontSize: 10, color: C.accent, fontWeight: 850 }}>TWIN SAYS DO THIS NOW</div><strong style={{ display: 'block', fontSize: 12, marginTop: 3 }}>{data.twin.decision.now.title}</strong>{data.twin.decision.now.reason && <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textMuted }}>{data.twin.decision.now.reason}</p>}</div>}</Card>

      <Card><SectionHead title="My school identity" sub="These school-controlled facts are the same facts parent and teacher views use." />{[['Admission number', identity.admissionNo || '—'], ['Class', identity.className || '—'], ['School', identity.schoolName || '—'], ['Date of birth', formatDate(data.schoolIdentity.date_of_birth)], ['Gender', data.schoolIdentity.gender || '—']].map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}><span style={{ color: C.textMuted, fontSize: 11 }}>{label}</span><strong style={{ color: C.textPrimary, fontSize: 11, textAlign: 'right' }}>{value}</strong></div>)}<p style={{ margin: '12px 0 0', color: C.textMuted, fontSize: 10, lineHeight: 1.45 }}>Ask your school to correct identity facts so every authorized view changes together.</p></Card>

      <Card><SectionHead title="My support network" />{data.guardian ? <div style={{ padding: 12, borderRadius: 13, background: '#ecfdf5' }}><strong style={{ fontSize: 12 }}>{data.guardian.full_name}</strong><div style={{ color: '#047857', fontSize: 10, marginTop: 2 }}>{data.guardian.relationship}</div></div> : <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>No guardian is connected to your learner profile yet.</p>}</Card>

      <Card><SectionHead title="Display" /><div style={{ display: 'flex', gap: 8 }}>{(['light', 'dark', 'auto'] as const).map(option => <button key={option} onClick={() => setTheme(option)} style={{ flex: 1, padding: '10px 4px', borderRadius: 12, border: `1px solid ${theme === option ? C.accent : C.border}`, background: theme === option ? C.accent : '#fff', color: theme === option ? '#fff' : C.textMuted, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{option === 'light' ? '☀️ Light' : option === 'dark' ? '🌙 Dark' : '⚙️ Auto'}</button>)}</div></Card>
      <button onClick={() => router.push('/student/workspace')} style={{ width: '100%', padding: 14, borderRadius: 14, border: `1px solid ${C.border}`, background: '#fff', color: C.textPrimary, fontSize: 13, fontWeight: 850, cursor: 'pointer' }}>📚 My Study Workspace</button>
      <button onClick={() => void signOut()} style={{ width: '100%', padding: 13, borderRadius: 14, border: `1.5px solid ${C.error}`, background: 'transparent', color: C.error, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Sign Out</button>
    </div>}
  </div>
}
