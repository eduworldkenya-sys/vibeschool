'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { nairobiDateStr, nairobiDayOfWeek } from '@/lib/time'
import { loadActiveClassTimetable, timetableSlotsForDay } from '@/lib/timetable/engine'
import { useStudent } from '@/lib/student-context'
import Skel from '@/components/student/Skel'
import {
  getStudentHomeOsBrief,
  resolveTaskLaunch,
  type StudentHomeOsBrief,
  type StudentTask,
} from '@/lib/student/tasks'
import { supabase } from '@/lib/supabase'

type TodaySlot = { id: string; subject: string; start: string; end: string; room: string }

type HomeData = {
  brief: StudentHomeOsBrief
  todaySlots: TodaySlot[]
  attendancePct: number | null
}

const TYPE_LABEL: Record<string, string> = {
  homework: 'Homework',
  exercise: 'Exercise',
  quiz: 'Quiz',
  cat: 'CAT',
  exam: 'Exam',
  project: 'Project',
  remedial: 'Practice',
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function taskMeta(task: StudentTask) {
  if (task.status === 'released') return 'Result and feedback ready'
  if (task.status === 'returned') return 'Teacher returned this for revision'
  if (task.status === 'overdue') return 'Past the due date — complete it now'
  if (task.status === 'in_progress') return `${task.progress}% complete`
  if (task.dueAt) return `Due ${new Date(task.dueAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`
  return 'Ready when you are'
}

function tone(task: StudentTask) {
  if (task.status === 'overdue' || task.status === 'returned') return { accent: '#dc2626', soft: '#fef2f2', text: '#991b1b' }
  if (task.status === 'released') return { accent: '#059669', soft: '#ecfdf5', text: '#065f46' }
  if (task.status === 'in_progress') return { accent: '#d97706', soft: '#fffbeb', text: '#92400e' }
  return { accent: '#4f46e5', soft: '#eef2ff', text: '#3730a3' }
}

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function nairobiNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

function slotState(slot: TodaySlot, now: number): 'now' | 'next' | 'later' | 'done' {
  const start = minutes(slot.start)
  const end = minutes(slot.end)
  if (now >= start && now < end) return 'now'
  if (start > now) return 'next'
  if (end <= now) return 'done'
  return 'later'
}

function urgencyStyle(level: StudentHomeOsBrief['urgency']['level']) {
  if (level === 'urgent') return { border: '#fecaca', background: '#fef2f2', color: '#991b1b', label: 'ACT NOW' }
  if (level === 'attention') return { border: '#fde68a', background: '#fffbeb', color: '#92400e', label: 'PAY ATTENTION' }
  return { border: '#a7f3d0', background: '#ecfdf5', color: '#065f46', label: 'ON TRACK' }
}

function relativeTime(value: string) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return ''
  const minutesAgo = Math.max(0, Math.floor((Date.now() - time) / 60000))
  if (minutesAgo < 1) return 'Just now'
  if (minutesAgo < 60) return `${minutesAgo}m ago`
  const hours = Math.floor(minutesAgo / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function StudentHomePage() {
  const router = useRouter()
  const { identity, loading: identityLoading } = useStudent()
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [launchingTaskId, setLaunchingTaskId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    if (!identity) return
    setLoading(true)
    setError('')
    try {
      const brief = await getStudentHomeOsBrief()

      const day = nairobiDayOfWeek()
      const slots = identity.classId && identity.schoolId
        ? await loadActiveClassTimetable({
            classId: identity.classId,
            schoolId: identity.schoolId,
            activeOn: nairobiDateStr(),
          }).then(all => timetableSlotsForDay(all, day))
        : []

      const subjectIds = Array.from(new Set(slots.map(slot => slot.subject_id).filter((id): id is string => Boolean(id))))
      let subjectNames: Record<string, string> = {}
      if (subjectIds.length > 0) {
        const { data: rows } = await supabase.from('subjects').select('id,name').in('id', subjectIds)
        subjectNames = Object.fromEntries((rows ?? []).map(row => [row.id, row.name]))
      }

      const todaySlots = slots.map(slot => ({
        id: slot.id,
        subject: slot.subject_id ? subjectNames[slot.subject_id] ?? 'Lesson' : 'Lesson',
        start: slot.start_time.slice(0, 5),
        end: slot.end_time.slice(0, 5),
        room: slot.room ?? '',
      }))

      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', identity.studentId)

      const marked = attendance ?? []
      const present = marked.filter(row => row.status === 'present').length
      const attendancePct = marked.length > 0 ? Math.round((present / marked.length) * 100) : null

      setData({ brief, todaySlots, attendancePct })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your learner home could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!identityLoading && identity) void load()
  }, [identityLoading, identity])

  async function openTask(task: StudentTask) {
    if (launchingTaskId) return
    setLaunchingTaskId(task.taskId)
    setError('')
    try {
      const launch = await resolveTaskLaunch(task.taskId)
      router.push(launch.actionUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This task could not be opened.')
      await load()
    } finally {
      setLaunchingTaskId(null)
    }
  }

  const feed = data?.brief.taskFeed
  const progress = data?.brief.progress
  const focusTasks = useMemo(
    () => feed?.tasks.filter(task => ['overdue', 'returned', 'in_progress', 'ready'].includes(task.status)).slice(0, 4) ?? [],
    [feed],
  )
  const feedbackTasks = useMemo(
    () => feed?.tasks.filter(task => task.status === 'released' || task.status === 'returned').slice(0, 3) ?? [],
    [feed],
  )
  const nextTask = data?.brief.nextAction ?? focusTasks[0] ?? null
  const goal = progress?.dailyGoal
  const goalRate = goal ? Math.min(100, Math.round((goal.completed / Math.max(1, goal.target)) * 100)) : 0
  const nowMinutes = nairobiNowMinutes()
  const firstUpcomingId = data?.todaySlots.find(slot => minutes(slot.start) > nowMinutes)?.id ?? null
  const urgency = data?.brief.urgency
  const urgencyTone = urgencyStyle(urgency?.level ?? 'clear')

  if (identityLoading || (loading && !data)) {
    return <div style={{ display: 'grid', gap: 12 }}><Skel h={220} radius={22} /><Skel h={100} radius={16} /><Skel h={220} radius={16} /><Skel h={160} radius={16} /></div>
  }
  if (!identity) return null

  return <div style={{ animation: 'slideIn .22s ease' }}>
    <section style={hero}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <div style={heroDate}>{new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 23 }}>{greeting()}, {identity.firstName}</h1>
          <p style={heroSub}>{identity.className}{identity.schoolName ? ` · ${identity.schoolName}` : ''}</p>
        </div>
        <div style={{ textAlign: 'right' }}><strong style={{ fontSize: 19 }}>{progress?.totalXp ?? 0}</strong><div style={heroDate}>VERIFIED XP</div></div>
      </div>

      <div style={{ marginTop: 20, padding: 15, borderRadius: 15, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.14)' }}>
        <div style={heroDate}>WHAT SHOULD I DO NOW?</div>
        <h2 style={{ margin: '5px 0', fontSize: 19 }}>{nextTask?.title ?? 'You are caught up'}</h2>
        <p style={{ ...heroSub, lineHeight: 1.5 }}>{nextTask ? `${TYPE_LABEL[nextTask.taskType] ?? nextTask.taskType} · ${nextTask.subject} · ${taskMeta(nextTask)}` : 'Use the time to revise, read, or explore your learning path.'}</p>
        {nextTask
          ? <button type="button" disabled={launchingTaskId === nextTask.taskId} onClick={() => void openTask(nextTask)} style={{ ...heroButton, opacity: launchingTaskId === nextTask.taskId ? .7 : 1 }}>{launchingTaskId === nextTask.taskId ? 'Opening…' : nextTask.actionLabel}</button>
          : <button type="button" onClick={() => router.push('/student/vibelearn')} style={heroButton}>Open Learn</button>}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.75)', marginBottom: 6 }}><span>Daily learning goal</span><strong>{goal?.completed ?? 0}/{goal?.target ?? 1}</strong></div>
        <div style={heroTrack}><div style={{ width: `${goalRate}%`, height: '100%', background: '#fff', borderRadius: 999 }} /></div>
      </div>
    </section>

    {error && <section style={{ ...card, borderColor: '#fecaca', color: '#991b1b' }}>{error}<button type="button" onClick={() => void load()} style={retryButton}>Retry</button></section>}

    <section style={{ ...card, borderColor: urgencyTone.border, background: urgencyTone.background, color: urgencyTone.color }}>
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: .9 }}>{urgencyTone.label}</div>
      <h2 style={{ margin: '5px 0 3px', fontSize: 16 }}>{urgency?.headline ?? 'You are on track'}</h2>
      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55 }}>{urgency?.message ?? 'No urgent work is waiting.'}</p>
    </section>

    <section style={pulseGrid}>
      <Pulse label="To do" value={feed?.counts.toDo ?? 0} note={(feed?.counts.overdue ?? 0) > 0 ? `${feed?.counts.overdue} overdue` : 'Current queue'} tone={(feed?.counts.overdue ?? 0) > 0 ? '#dc2626' : '#4f46e5'} />
      <Pulse label="In progress" value={feed?.counts.inProgress ?? 0} note="Resume work" tone="#d97706" />
      <Pulse label="Day streak" value={progress?.streak.current ?? 0} note={`Best ${progress?.streak.longest ?? 0}`} tone="#059669" />
      <Pulse label="Attendance" value={data?.attendancePct === null || data?.attendancePct === undefined ? '—' : `${data.attendancePct}%`} note="School record" tone="#0f766e" />
    </section>

    <section style={card}>
      <SectionHeader title="What changed?" action="View all results" onClick={() => router.push('/student/marks')} />
      {(data?.brief.recentChanges.length ?? 0) === 0
        ? <Empty title="No new learning changes" body="New marks, teacher feedback, completed milestones and other learning updates will appear here." />
        : <div style={{ display: 'grid', gap: 9 }}>{data?.brief.recentChanges.slice(0, 5).map(change => <div key={`${change.kind}:${change.id}:${change.occurredAt}`} style={changeRow}>
            <div style={{ minWidth: 0 }}><div style={changeKind}>{change.kind.replaceAll('_', ' ')}</div><strong style={{ display: 'block', fontSize: 12 }}>{change.title}</strong>{change.summary && <div style={{ fontSize: 10, color: 'var(--vs-muted)', marginTop: 3 }}>{change.summary}</div>}</div>
            <span style={{ fontSize: 9, color: 'var(--vs-muted)', whiteSpace: 'nowrap' }}>{relativeTime(change.occurredAt)}</span>
          </div>)}</div>}
    </section>

    <section style={card}>
      <SectionHeader title="Learning queue" action="See all tasks" onClick={() => router.push('/student/tasks')} />
      {focusTasks.length === 0
        ? <Empty title="No urgent work" body="New assigned work and returned revisions will appear here." />
        : <div style={{ display: 'grid', gap: 10 }}>{focusTasks.map(task => {
            const taskTone = tone(task)
            return <article key={task.taskId} style={{ border: '1px solid var(--vs-border)', borderLeft: `4px solid ${taskTone.accent}`, borderRadius: 13, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div><div style={{ fontSize: 9, fontWeight: 900, color: taskTone.text, textTransform: 'uppercase', letterSpacing: .8 }}>{TYPE_LABEL[task.taskType] ?? task.taskType}</div><strong style={{ display: 'block', fontSize: 13, marginTop: 3 }}>{task.title}</strong><div style={{ fontSize: 10, color: 'var(--vs-muted)', marginTop: 3 }}>{task.subject} · {taskMeta(task)}</div></div>
                <span style={{ alignSelf: 'flex-start', padding: '4px 7px', borderRadius: 999, background: taskTone.soft, color: taskTone.text, fontSize: 9, fontWeight: 800 }}>{task.status.replaceAll('_', ' ')}</span>
              </div>
              {task.progress > 0 && task.progress < 100 && <div style={track}><div style={{ width: `${task.progress}%`, height: '100%', background: taskTone.accent }} /></div>}
              <button type="button" disabled={launchingTaskId !== null} onClick={() => void openTask(task)} style={{ ...taskButton, background: taskTone.accent, opacity: launchingTaskId ? .65 : 1 }}>{launchingTaskId === task.taskId ? 'Opening…' : task.actionLabel}</button>
            </article>
          })}</div>}
    </section>

    <section style={card}>
      <SectionHeader title="Feedback and revision" action="View results" onClick={() => router.push('/student/marks')} />
      {feedbackTasks.length === 0
        ? <Empty title="Nothing waiting" body="Released results, teacher feedback and revision requests will appear here." />
        : <div style={{ display: 'grid', gap: 9 }}>{feedbackTasks.map(task => <button key={task.taskId} type="button" onClick={() => void openTask(task)} style={feedbackRow}><div><strong style={{ fontSize: 12 }}>{task.title}</strong><div style={{ fontSize: 10, color: 'var(--vs-muted)', marginTop: 3 }}>{task.feedback || taskMeta(task)}</div></div><span style={{ color: task.status === 'returned' ? '#dc2626' : '#059669', fontWeight: 900 }}>›</span></button>)}</div>}
    </section>

    <section style={card}>
      <SectionHeader title="How am I progressing?" action="My progress" onClick={() => router.push('/student/marks')} />
      {(progress?.subjectProgress.length ?? 0) === 0
        ? <Empty title="Progress is building" body="Subject mastery will appear after marked and verified learning work." />
        : <div style={{ display: 'grid', gap: 12 }}>{progress?.subjectProgress.slice(0, 4).map(subject => {
            const mastery = subject.masteryPercentage ?? subject.averageScore ?? 0
            return <div key={subject.subjectId}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><strong>{subject.subjectName}</strong><span style={{ color: 'var(--vs-muted)' }}>{Math.round(mastery)}%</span></div><div style={track}><div style={{ width: `${Math.min(100, Math.max(0, mastery))}%`, height: '100%', background: '#4f46e5' }} /></div><div style={{ fontSize: 9, color: 'var(--vs-muted)', marginTop: 3 }}>{subject.completedTasks}/{subject.totalTasks} verified tasks</div></div>
          })}</div>}
    </section>

    <section style={card}>
      <SectionHeader title="What should I learn next?" action="Open Learn" onClick={() => router.push('/student/vibelearn')} />
      {(progress?.recommendations.length ?? 0) === 0
        ? <Empty title="No recommendation yet" body="Your path will adapt as teachers release feedback and your mastery evidence grows." />
        : <div style={{ display: 'grid', gap: 9 }}>{progress?.recommendations.slice(0, 3).map(item => <div key={item.id} style={recommendation}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 12 }}>{item.title}</strong><span style={recommendationBadge}>{item.type.replaceAll('_', ' ')}</span></div><p style={{ margin: '5px 0 0', fontSize: 10, lineHeight: 1.5, color: 'var(--vs-muted)' }}>{item.reason}</p></div>)}</div>}
    </section>

    <section style={card}>
      <SectionHeader title="What is happening today?" action="Full timetable" onClick={() => router.push('/student/timetable')} />
      {(data?.todaySlots.length ?? 0) === 0
        ? <Empty title="No lessons scheduled today" body="Use the time for your learning queue or revision." />
        : <div style={{ display: 'grid', gap: 8 }}>{data?.todaySlots.map(slot => {
            const state = slotState(slot, nowMinutes)
            const isNext = state === 'next' && slot.id === firstUpcomingId
            const label = state === 'now' ? 'NOW' : isNext ? 'NEXT' : null
            return <div key={slot.id} style={{ ...slotRow, opacity: state === 'done' ? .55 : 1 }}><div style={slotTime}>{slot.start}</div><div><strong style={{ fontSize: 12 }}>{slot.subject}</strong><div style={{ fontSize: 10, color: 'var(--vs-muted)', marginTop: 2 }}>{slot.end}{slot.room ? ` · ${slot.room}` : ''}</div></div>{label && <span style={nowBadge}>{label}</span>}</div>
          })}</div>}
    </section>

    <section style={card}>
      <SectionHeader title="Where do I need to go?" />
      <div style={quickGrid}>
        <Quick title="Learn" note="Books, notes and revision" onClick={() => router.push('/student/vibelearn')} />
        <Quick title="Tasks" note={`${feed?.counts.toDo ?? 0} need action`} onClick={() => router.push('/student/tasks')} />
        <Quick title="Results" note={`${feed?.counts.results ?? 0} released`} onClick={() => router.push('/student/marks')} />
        <Quick title="School" note="Timetable, fees and records" onClick={() => router.push('/student/timetable')} />
      </div>
    </section>
  </div>
}

function SectionHeader({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 14 }}>{title}</h2>{action && <button type="button" onClick={onClick} style={linkButton}>{action} →</button>}</div>
}
function Empty({ title, body }: { title: string; body: string }) { return <div style={{ padding: '17px 8px', textAlign: 'center' }}><strong style={{ fontSize: 12 }}>{title}</strong><p style={{ margin: '5px auto 0', maxWidth: 280, fontSize: 10, lineHeight: 1.5, color: 'var(--vs-muted)' }}>{body}</p></div> }
function Pulse({ label, value, note, tone }: { label: string; value: string | number; note: string; tone: string }) { return <div style={pulse}><div style={{ fontSize: 9, color: 'var(--vs-muted)', fontWeight: 700 }}>{label}</div><strong style={{ display: 'block', margin: '4px 0 1px', fontSize: 19, color: tone }}>{value}</strong><div style={{ fontSize: 8.5, color: 'var(--vs-muted)' }}>{note}</div></div> }
function Quick({ title, note, onClick }: { title: string; note: string; onClick: () => void }) { return <button type="button" onClick={onClick} style={quick}><strong style={{ fontSize: 12 }}>{title}</strong><span style={{ fontSize: 9, lineHeight: 1.4, color: 'var(--vs-muted)' }}>{note}</span></button> }

const hero: React.CSSProperties = { padding: 20, borderRadius: 22, color: '#fff', background: 'linear-gradient(145deg,#111827,#312e81 70%,#4f46e5)', boxShadow: '0 16px 45px rgba(49,46,129,.24)', marginBottom: 13 }
const heroDate: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,255,255,.68)', textTransform: 'uppercase' }
const heroSub: React.CSSProperties = { margin: 0, fontSize: 11, color: 'rgba(255,255,255,.72)' }
const heroButton: React.CSSProperties = { marginTop: 11, width: '100%', border: 0, borderRadius: 11, padding: '11px 14px', color: '#312e81', background: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 900, cursor: 'pointer' }
const heroTrack: React.CSSProperties = { height: 6, background: 'rgba(255,255,255,.18)', borderRadius: 999, overflow: 'hidden' }
const card: React.CSSProperties = { padding: 15, borderRadius: 16, border: '1px solid var(--vs-border)', background: 'var(--vs-card)', marginTop: 12 }
const pulseGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 7, marginTop: 12 }
const pulse: React.CSSProperties = { minWidth: 0, padding: '11px 8px', borderRadius: 13, border: '1px solid var(--vs-border)', background: 'var(--vs-card)' }
const track: React.CSSProperties = { height: 5, marginTop: 8, overflow: 'hidden', borderRadius: 999, background: 'var(--vs-border)' }
const taskButton: React.CSSProperties = { marginTop: 10, width: '100%', border: 0, borderRadius: 9, padding: '9px 11px', color: '#fff', fontFamily: 'inherit', fontSize: 10, fontWeight: 900, cursor: 'pointer' }
const feedbackRow: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 11px', textAlign: 'left', borderRadius: 11, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)', color: 'var(--vs-text)', fontFamily: 'inherit', cursor: 'pointer' }
const changeRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 11px', borderRadius: 11, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)' }
const changeKind: React.CSSProperties = { marginBottom: 3, fontSize: 8.5, fontWeight: 900, letterSpacing: .7, color: '#4f46e5', textTransform: 'uppercase' }
const recommendation: React.CSSProperties = { padding: '11px 12px', borderRadius: 11, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)' }
const recommendationBadge: React.CSSProperties = { alignSelf: 'flex-start', whiteSpace: 'nowrap', padding: '3px 6px', borderRadius: 999, background: '#eef2ff', color: '#4338ca', fontSize: 8, fontWeight: 800, textTransform: 'uppercase' }
const slotRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '46px 1fr auto', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 11, border: '1px solid var(--vs-border)' }
const slotTime: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#4f46e5' }
const nowBadge: React.CSSProperties = { padding: '3px 6px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 8, fontWeight: 900 }
const quickGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }
const quick: React.CSSProperties = { display: 'grid', gap: 4, textAlign: 'left', minHeight: 67, padding: 11, borderRadius: 12, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)', color: 'var(--vs-text)', fontFamily: 'inherit', cursor: 'pointer' }
const linkButton: React.CSSProperties = { padding: 0, border: 0, background: 'transparent', color: '#4f46e5', fontFamily: 'inherit', fontSize: 9.5, fontWeight: 800, cursor: 'pointer' }
const retryButton: React.CSSProperties = { float: 'right', border: 0, background: 'transparent', color: 'inherit', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' }
