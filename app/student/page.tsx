'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, ClipboardCheck, ChartNoAxesColumn, Sparkles, ArrowUpRight } from 'lucide-react'
import './student-home.css'
import { nairobiDateStr, nairobiDayOfWeek } from '@/lib/time'
import { loadActiveClassTimetable, timetableSlotsForDay } from '@/lib/timetable/engine'
import { useStudent } from '@/lib/student-context'
import Skel from '@/components/student/Skel'
import { acknowledgeStudentHomeChanges, getStudentHomeOsBrief, markStudentHomeOpened, resolveTaskLaunch, updateStudentHomePreferences, type PreferredStudyTime, type StudentHomeOsBrief, type StudentTask } from '@/lib/student/tasks'
import { getLearnerTwinState, type LearnerTwinState } from '@/lib/student/twin'
import { supabase } from '@/lib/supabase'

type TodaySlot = { id: string; subject: string; start: string; end: string; room: string }
type HomeData = { brief: StudentHomeOsBrief; twin: LearnerTwinState; todaySlots: TodaySlot[]; attendancePct: number | null }
const TYPE_LABEL: Record<string, string> = { homework: 'Homework', exercise: 'Exercise', quiz: 'Quiz', cat: 'CAT', exam: 'Exam', project: 'Project', remedial: 'Practice' }
const GRADES = ['', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E']
const STUDY_TIMES: PreferredStudyTime[] = ['morning', 'afternoon', 'evening', 'flexible']

function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening' }
function taskMeta(task: StudentTask) { if (task.status === 'released') return 'Result and feedback ready'; if (task.status === 'returned') return 'Teacher returned this for revision'; if (task.status === 'overdue') return 'Past the due date — complete it now'; if (task.status === 'in_progress') return `${task.progress}% complete`; if (task.dueAt) return `Due ${new Date(task.dueAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`; return 'Ready when you are' }
function minutes(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
function nairobiNowMinutes() { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()); return Number(parts.find(part => part.type === 'hour')?.value ?? 0) * 60 + Number(parts.find(part => part.type === 'minute')?.value ?? 0) }
function relativeTime(value: string) { const time = new Date(value).getTime(); if (!Number.isFinite(time)) return ''; const mins = Math.max(0, Math.floor((Date.now() - time) / 60000)); if (mins < 1) return 'Just now'; if (mins < 60) return `${mins}m ago`; if (mins < 1440) return `${Math.floor(mins / 60)}h ago`; return `${Math.floor(mins / 1440)}d ago` }

export default function StudentHomePage() {
  const router = useRouter()
  const { identity, loading: identityLoading } = useStudent()
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [launchingTaskId, setLaunchingTaskId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [targetGrade, setTargetGrade] = useState('')
  const [weeklyMinutes, setWeeklyMinutes] = useState(300)
  const [sessionMinutes, setSessionMinutes] = useState(25)
  const [studyTime, setStudyTime] = useState<PreferredStudyTime>('evening')

  async function load() {
    if (!identity) return
    setLoading(true); setError('')
    try {
      const [brief, twin] = await Promise.all([getStudentHomeOsBrief(), getLearnerTwinState()])
      const day = nairobiDayOfWeek()
      const slots = identity.classId && identity.schoolId ? await loadActiveClassTimetable({ classId: identity.classId, schoolId: identity.schoolId, activeOn: nairobiDateStr() }).then(all => timetableSlotsForDay(all, day)) : []
      const subjectIds = Array.from(new Set(slots.map(slot => slot.subject_id).filter((id): id is string => Boolean(id))))
      let subjectNames: Record<string, string> = {}
      if (subjectIds.length > 0) { const { data: rows } = await supabase.from('subjects').select('id,name').in('id', subjectIds); subjectNames = Object.fromEntries((rows ?? []).map(row => [row.id, row.name])) }
      const todaySlots = slots.map(slot => ({ id: slot.id, subject: slot.subject_id ? subjectNames[slot.subject_id] ?? 'Lesson' : 'Lesson', start: slot.start_time.slice(0, 5), end: slot.end_time.slice(0, 5), room: slot.room ?? '' }))
      const { data: attendance } = await supabase.from('attendance').select('status').eq('student_id', identity.studentId)
      const marked = attendance ?? []; const present = marked.filter(row => row.status === 'present').length; const attendancePct = marked.length > 0 ? Math.round((present / marked.length) * 100) : null
      setData({ brief, twin, todaySlots, attendancePct })
      setTargetGrade(brief.progress.targets.kcseTargetGrade ?? ''); setWeeklyMinutes(brief.progress.targets.weeklyStudyMinutes); setSessionMinutes(brief.progress.targets.preferredSessionMinutes); setStudyTime(brief.progress.targets.preferredStudyTime)
      void markStudentHomeOpened().catch(() => undefined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your learner home could not be loaded.') } finally { setLoading(false) }
  }

  useEffect(() => { if (!identityLoading && identity) void load() }, [identityLoading, identity])

  async function openTask(task: StudentTask) { if (launchingTaskId) return; setLaunchingTaskId(task.taskId); setError(''); try { const launch = await resolveTaskLaunch(task.taskId); router.push(launch.actionUrl) } catch (cause) { setError(cause instanceof Error ? cause.message : 'This task could not be opened.'); await load() } finally { setLaunchingTaskId(null) } }
  async function acknowledgeChanges() { setSaving(true); try { await acknowledgeStudentHomeChanges(); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Updates could not be acknowledged.') } finally { setSaving(false) } }
  async function savePreferences() { setSaving(true); setError(''); try { const brief = await updateStudentHomePreferences({ kcseTargetGrade: targetGrade || null, weeklyStudyMinutes: weeklyMinutes, preferredSessionMinutes: sessionMinutes, preferredStudyTime: studyTime, subjectTargets: data?.brief.progress.targets.subjectTargets ?? {} }); setData(current => current ? { ...current, brief } : current); setSettingsOpen(false) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your study preferences could not be saved.') } finally { setSaving(false) } }

  const brief = data?.brief; const feed = brief?.taskFeed; const progress = brief?.progress
  const focusTasks = useMemo(() => feed?.tasks.filter(task => ['overdue', 'returned', 'in_progress', 'ready'].includes(task.status)) ?? [], [feed])
  const twinTaskId = data?.twin.decision.now?.decisionType === 'task' ? data.twin.decision.now.taskId : null
  const nextTask = (twinTaskId ? feed?.tasks.find(task => task.taskId === twinTaskId) : null) ?? brief?.nextAction ?? focusTasks[0] ?? null
  const nextQueue = focusTasks.filter(task => task.taskId !== nextTask?.taskId).filter((task, index, items) => items.findIndex(other => other.taskId === task.taskId) === index).slice(0, 3)
  const recentChanges = useMemo(() => {
    const changes = brief?.recentChanges ?? []
    const grouped = new Map<string, typeof changes[number]>()
    for (const change of changes) {
      // Only collapse records that identify the SAME assessment attempt.
      const assessment = change.kind === 'result' && change.sourceId && /assessment|attempt/i.test(change.sourceType)
      const key = assessment ? `attempt:${change.sourceId}` : `event:${change.id}`
      const previous = grouped.get(key)
      if (!previous || (assessment && /score\s*:/i.test(change.summary) && !/score\s*:/i.test(previous.summary))) grouped.set(key, change)
      else if (previous && change.isUnread && !previous.isUnread) grouped.set(key, { ...previous, isUnread: true })
    }
    return [...grouped.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 6)
  }, [brief?.recentChanges])
  const goal = progress?.dailyGoal; const goalRate = goal ? Math.min(100, Math.round((goal.completed / Math.max(1, goal.target)) * 100)) : 0
  const nowMinutes = nairobiNowMinutes(); const firstUpcomingId = data?.todaySlots.find(slot => minutes(slot.start) > nowMinutes)?.id ?? null
  const isKcseLearner = /^form\\s*4$/i.test(identity?.className.trim() ?? '')
  const hasSchoolEnrollment = Boolean(identity?.schoolId && identity?.classId)
  const hasLearningEvidence = Boolean(
    (data?.twin.evidence.learningEventCount ?? 0) > 0 ||
    (data?.twin.evidence.competencyEvidenceCount ?? 0) > 0 ||
    (data?.twin.evidence.taskReceiptCount ?? 0) > 0 ||
    (feed?.counts.results ?? 0) > 0 ||
    (brief?.recentChanges.length ?? 0) > 0
  )

  if (identityLoading || (loading && !data)) return <div style={{ display: 'grid', gap: 12 }}><Skel h={220} radius={22} /><Skel h={120} radius={16} /><Skel h={220} radius={16} /></div>
  if (!identity) return null

  return <div className="student-home" style={{ animation: 'slideIn .22s ease' }}>
    <section className="student-home-hero" style={hero} aria-label="Your learning overview">
      <div className="student-home-hero-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><div style={{minWidth:0, flex:'1 1 210px'}}><div style={eyebrow}>My learning · {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1 className="student-home-title" style={{ margin: '8px 0 5px', fontSize: 28 }}>{greeting()}, {identity.firstName}</h1><p style={heroSub}>{identity.className}{identity.schoolName ? ` · ${identity.schoolName}` : ''}</p></div><div className="student-home-xp"><strong>{progress?.totalXp ?? 0}</strong><span>Verified XP</span></div></div>
      <div style={heroPanel}><div style={eyebrow}>YOUR NEXT STEP</div><h2 style={{ margin: '5px 0', fontSize: 19 }}>{nextTask?.title ?? data?.twin.decision.now?.title ?? (hasLearningEvidence ? 'Choose your next learning activity' : 'Ready to start learning?')}</h2><p style={{ ...heroSub, lineHeight: 1.5 }}>{nextTask ? `${TYPE_LABEL[nextTask.taskType] ?? nextTask.taskType} · Assigned subject: ${nextTask.subject} · ${taskMeta(nextTask)}` : (data?.twin.decision.now?.reason ?? (hasLearningEvidence ? 'Explore learning activities and build on your progress.' : 'Start with reading, practice or an available exam. Your progress will appear as you learn.'))}</p>{nextTask ? <button disabled={launchingTaskId === nextTask.taskId} onClick={() => void openTask(nextTask)} style={heroButton}>{launchingTaskId === nextTask.taskId ? 'Opening…' : nextTask.actionLabel}</button> : <button onClick={() => router.push(data?.twin.decision.now?.actionUrl ?? '/student/study')} style={heroButton}>Open Learn</button>}</div>
      <div style={{ marginTop: 14 }}><div style={{ ...splitSmall, fontSize: 13, fontWeight: 700 }}><span>{goal && goal.completed >= goal.target ? 'Daily goal reached' : 'Daily learning goal'}</span><strong>{goal && goal.completed >= goal.target ? `${goal.completed} activities completed` : `${goal?.completed ?? 0} of ${goal?.target ?? 1} activities`}</strong></div><div style={heroTrack}><div style={{ width: `${goalRate}%`, height: '100%', background: '#168153', borderRadius: 999 }} /></div></div>
    </section>

    <section className="student-home-pulse" style={pulseGrid}><Metric label="To do" value={feed?.counts.toDo ?? 0} /><Metric label="In progress" value={feed?.counts.inProgress ?? 0} /><Metric label="Streak" value={data?.twin.streak.current ?? progress?.streak.current ?? 0} />{hasSchoolEnrollment && <Metric label="Attendance" value={data?.attendancePct == null ? '—' : `${data.attendancePct}%`} />}</section>

    {error && <section style={{ ...card, color: '#991b1b', borderColor: '#fecaca' }}>{error}<button onClick={() => void load()} style={linkButton}>Retry</button></section>}
    <div className="student-home-feature-grid">
    <section style={card} aria-label="Next learning tasks">
      <SectionHeader title="What's next?" action="See all tasks" onClick={() => router.push('/student/tasks')} />
      {nextQueue.length === 0 ? <p style={body}>No other tasks need attention right now.</p> : <div style={{ display: 'grid', gap: 9 }}>{nextQueue.map(task => <button key={task.taskId} disabled={launchingTaskId !== null} onClick={() => void openTask(task)} style={recoveryRow}><span style={rank}>{TYPE_LABEL[task.taskType]?.slice(0, 1) ?? 'T'}</span><span style={{ textAlign: 'left', minWidth: 0 }}><strong style={{ display: 'block', fontSize: 13 }}>{task.title}</strong><span style={{ ...muted, fontSize: 11 }}>{task.subject} · {taskMeta(task)}</span></span><span aria-hidden="true">›</span></button>)}</div>}
    </section>

    <section style={card} aria-label="Learning destinations"><SectionHeader title="Explore learning" /><div className="student-home-quick-grid"><Quick title="Learn" note="Lessons and reading" onClick={() => router.push('/student/study')} /><Quick title="Exams" note="Tests and assessments" onClick={() => router.push('/student/vibelearn/exams')} /><Quick title="Results" note="Marks and feedback" onClick={() => router.push('/student/marks')} /><Quick title="VibeTwin" note="Personal learning insights" onClick={() => router.push('/student/twin')} /></div></section>
    </div>

    <section style={card}><SectionHeader title="My academic target" action={settingsOpen ? 'Close' : 'Set goals'} onClick={() => setSettingsOpen(value => !value)} /><div className="student-home-goals" style={goalGrid}>{isKcseLearner ? <Metric label="KCSE target" value={progress?.targets.kcseTargetGrade ?? 'Not set'} /> : <Metric label="Learning level" value={identity.className || 'Not set'} />}<Metric label="Weekly study" value={`${progress?.targets.weeklyStudyMinutes ?? 300} min`} /><Metric label="Focus session" value={`${progress?.targets.preferredSessionMinutes ?? 25} min`} /></div>{settingsOpen && <div style={formGrid}>{isKcseLearner && <label style={field}>KCSE target<select value={targetGrade} onChange={event => setTargetGrade(event.target.value)} style={input}>{GRADES.map(grade => <option key={grade || 'none'} value={grade}>{grade || 'Not set'}</option>)}</select></label>}<label style={field}>Weekly minutes<input type="number" min={30} max={4200} value={weeklyMinutes} onChange={event => setWeeklyMinutes(Number(event.target.value))} style={input} /></label><label style={field}>Session minutes<input type="number" min={10} max={180} value={sessionMinutes} onChange={event => setSessionMinutes(Number(event.target.value))} style={input} /></label><label style={field}>Preferred time<select value={studyTime} onChange={event => setStudyTime(event.target.value as PreferredStudyTime)} style={input}>{STUDY_TIMES.map(item => <option key={item} value={item}>{item}</option>)}</select></label><button disabled={saving} onClick={() => void savePreferences()} style={primaryButton}>{saving ? 'Saving…' : 'Save my goals'}</button></div>}</section>

    <section style={card}><SectionHeader title={`What changed?${brief?.unreadChangeCount ? ` · ${brief.unreadChangeCount} new` : ''}`} action={brief?.unreadChangeCount ? 'Mark seen' : 'Results'} onClick={() => brief?.unreadChangeCount ? void acknowledgeChanges() : router.push('/student/marks')} />{recentChanges.length === 0 ? <Empty title={hasLearningEvidence ? 'No recent updates' : 'No learning activity yet'} body="Completed learning, marks and feedback will appear here as they become available." /> : <div style={{ display: 'grid', gap: 8 }}>{recentChanges.map(change => <div key={`${change.kind}:${change.id}:${change.occurredAt}`} className="student-home-change" style={{ ...changeRow, borderColor: change.isUnread ? '#a5b4fc' : 'var(--vs-border)' }}><div><div style={label}>{change.isUnread ? 'NEW · ' : ''}{change.kind.replaceAll('_', ' ')}</div><strong style={{ fontSize: 12 }}>{change.kind === 'result' ? (change.title === 'Assessment result released' ? 'Assessment result' : change.title) : change.title}</strong>{change.summary && <div style={muted}>{change.summary}</div>}{change.kind === 'result' && <button style={{ ...linkButton, marginTop: 5, fontSize: 12 }} onClick={() => router.push('/student/marks')}>Review result →</button>}</div><span style={muted}>{relativeTime(change.occurredAt)}</span></div>)}</div>}</section>



    <section style={card}><SectionHeader title="How am I progressing?" action="Results" onClick={() => router.push('/student/marks')} />{(data?.twin.mastery.subjects.length ?? 0) === 0 ? <Empty title="Progress is building" body="Subject mastery appears after marked and verified work." /> : <div style={{ display: 'grid', gap: 11 }}>{data?.twin.mastery.subjects.slice(0, 5).map(subject => { const mastery = subject.masteryPercentage ?? subject.averageScore ?? 0; return <div key={subject.subjectId}><div style={splitSmall}><strong>{subject.subjectName}</strong><span>{Math.round(mastery)}% · {Math.round(subject.confidence * 100)}% confidence</span></div><div style={track}><div style={{ width: `${Math.min(100, Math.max(0, mastery))}%`, height: '100%', background: 'var(--vs-accent)' }} /></div></div> })}</div>}</section>

    {hasSchoolEnrollment && <section style={card}><SectionHeader title="What is happening today?" action="Full timetable" onClick={() => router.push('/student/timetable')} />{(data?.todaySlots.length ?? 0) === 0 ? <Empty title="No lessons scheduled today" body="Use the time for your study session or learning queue." /> : <div style={{ display: 'grid', gap: 8 }}>{data?.todaySlots.map(slot => { const start = minutes(slot.start); const end = minutes(slot.end); const labelText = nowMinutes >= start && nowMinutes < end ? 'NOW' : slot.id === firstUpcomingId ? 'NEXT' : ''; return <div key={slot.id} style={{ ...slotRow, opacity: end <= nowMinutes ? .55 : 1 }}><strong>{slot.start}</strong><span><strong style={{ fontSize: 12 }}>{slot.subject}</strong><div style={muted}>{slot.end}{slot.room ? ` · ${slot.room}` : ''}</div></span>{labelText && <span style={badge}>{labelText}</span>}</div> })}</div>}</section>}


  </div>
}

function SectionHeader({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 11 }}><h2 style={sectionTitle}>{title}</h2>{action && <button onClick={onClick} style={linkButton}>{action} →</button>}</div> }
function Metric({ label: text, value }: { label: string; value: string | number }) { return <div style={metric}><span style={muted}>{text}</span><strong style={{ display: 'block', marginTop: 4, fontSize: 17 }}>{value}</strong></div> }
function Empty({ title, body: text }: { title: string; body: string }) { return <div style={{ padding: 14, textAlign: 'center' }}><strong style={{ fontSize: 12 }}>{title}</strong><p style={body}>{text}</p></div> }
function Quick({ title, note, onClick }: { title: string; note: string; onClick: () => void }) {
  const Icon = title === 'Learn' ? BookOpen : title === 'Exams' ? ClipboardCheck : title === 'Results' ? ChartNoAxesColumn : Sparkles
  return <button onClick={onClick} style={quick} aria-label={title + ': ' + note}>
    <span className="student-home-quick-icon"><Icon size={20} aria-hidden="true" /></span>
    <span className="student-home-quick-copy"><strong>{title}</strong><small>{note}</small></span>
    <ArrowUpRight size={16} aria-hidden="true" className="student-home-quick-arrow" />
  </button>
}

const hero: React.CSSProperties = { padding: 20, borderRadius: 22, color: '#fff', background: 'linear-gradient(145deg,#111827,#312e81 70%,#4f46e5)', boxShadow: '0 16px 45px rgba(49,46,129,.24)', marginBottom: 13 }
const heroPanel: React.CSSProperties = { marginTop: 20, padding: 15, borderRadius: 15, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.14)' }
const eyebrow: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,255,255,.68)', textTransform: 'uppercase' }
const heroSub: React.CSSProperties = { margin: 0, fontSize: 13, color: 'rgba(255,255,255,.72)' }
const heroButton: React.CSSProperties = { marginTop: 11, width: '100%', border: 0, borderRadius: 11, padding: '11px 14px', color: '#312e81', background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 900, cursor: 'pointer', minHeight: 44 }
const heroTrack: React.CSSProperties = { height: 6, background: 'rgba(255,255,255,.18)', borderRadius: 999, overflow: 'hidden' }
const splitSmall: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11 }
const card: React.CSSProperties = { padding: 15, borderRadius: 16, border: '1px solid var(--vs-border)', background: 'var(--vs-card)', marginTop: 12 }
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 14 }
const body: React.CSSProperties = { margin: '5px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--vs-muted)' }
const muted: React.CSSProperties = { display: 'block', marginTop: 3, fontSize: 11, color: 'var(--vs-muted)', lineHeight: 1.4 }
const label: React.CSSProperties = { fontSize: 8.5, fontWeight: 900, letterSpacing: .7, color: '#4f46e5', textTransform: 'uppercase' }
const goalGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7 }
const pulseGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 7, marginTop: 12 }
const metric: React.CSSProperties = { minWidth: 0, overflowWrap: 'anywhere', padding: 10, borderRadius: 12, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)' }
const formGrid: React.CSSProperties = { display: 'grid', gap: 9, marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--vs-border)' }
const field: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 10, fontWeight: 800 }
const input: React.CSSProperties = { width: '100%', border: '1px solid var(--vs-border)', borderRadius: 9, padding: '9px 10px', background: 'var(--vs-card)', color: 'var(--vs-text)', fontFamily: 'inherit' }
const primaryButton: React.CSSProperties = { width: '100%', marginTop: 9, border: 0, borderRadius: 10, padding: '10px 12px', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' }
const studyHero: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, background: '#eef2ff', color: '#3730a3' }
const recoveryRow: React.CSSProperties = { width: '100%', display: 'grid', gridTemplateColumns: '30px 1fr auto', alignItems: 'center', gap: 10, padding: 10, borderRadius: 11, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)', color: 'var(--vs-text)', fontFamily: 'inherit', cursor: 'pointer' }
const rank: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 999, background: '#eef2ff', color: '#4338ca', fontSize: 11, fontWeight: 900 }
const changeRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 11, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)' }
const track: React.CSSProperties = { height: 5, marginTop: 6, overflow: 'hidden', borderRadius: 999, background: 'var(--vs-border)' }
const slotRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '48px 1fr auto', alignItems: 'center', gap: 10, padding: 9, borderRadius: 11, border: '1px solid var(--vs-border)' }
const badge: React.CSSProperties = { padding: '3px 6px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 8, fontWeight: 900 }
const quickGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }
const quick: React.CSSProperties = { display: 'grid', gap: 4, textAlign: 'left', minHeight: 65, padding: 11, borderRadius: 12, border: '1px solid var(--vs-border)', background: 'var(--vs-soft)', color: 'var(--vs-text)', fontFamily: 'inherit', cursor: 'pointer' }
const linkButton: React.CSSProperties = { border: 0, background: 'transparent', color: '#4f46e5', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
