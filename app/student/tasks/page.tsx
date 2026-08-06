'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Skel from '@/components/student/Skel'
import {
  getPersonalizedLearningPath,
  listMyTasks,
  type StudentPersonalizedPath,
  type StudentTask,
  type StudentTaskFeed,
} from '@/lib/student/tasks'

type Filter = 'focus' | 'all' | 'submitted' | 'results'

const TYPE_LABEL: Record<string, string> = { homework: 'Homework', exercise: 'Exercise', quiz: 'Quiz', cat: 'CAT', exam: 'Exam', project: 'Project', remedial: 'Practice' }
const RECOMMENDATION_LABEL: Record<string, string> = { revise: 'Revise', practice: 'Practice', learn_next: 'Learn next', intervention: 'Focused support', teacher_priority: 'Teacher priority' }

function dueLabel(task: StudentTask): string {
  if (task.status === 'released') return 'Result ready'
  if (task.status === 'awaiting_marking') return 'Submitted'
  if (task.status === 'in_progress') return 'Continue'
  if (task.status === 'returned') return 'Needs revision'
  if (task.status === 'overdue') return 'Overdue'
  if (task.status === 'upcoming' && task.opensAt) return `Opens ${new Date(task.opensAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`
  if (!task.dueAt) return 'No deadline'
  const due = new Date(task.dueAt); const today = new Date(); today.setHours(0, 0, 0, 0); const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0)
  const days = Math.round((dueDay.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days > 1) return `Due in ${days} days`
  return 'Overdue'
}
function taskTone(task: StudentTask) {
  if (task.status === 'overdue' || task.status === 'returned') return { accent: '#ef4444', soft: '#fef2f2', text: '#991b1b' }
  if (task.status === 'in_progress') return { accent: '#f59e0b', soft: '#fffbeb', text: '#92400e' }
  if (task.status === 'released') return { accent: '#10b981', soft: '#ecfdf5', text: '#065f46' }
  if (task.status === 'awaiting_marking') return { accent: '#14b8a6', soft: '#f0fdfa', text: '#115e59' }
  return { accent: 'var(--vs-accent)', soft: 'var(--vs-accent-soft)', text: 'var(--vs-accent)' }
}

export default function TasksPage() {
  const router = useRouter()
  const [feed, setFeed] = useState<StudentTaskFeed | null>(null)
  const [path, setPath] = useState<StudentPersonalizedPath | null>(null)
  const [filter, setFilter] = useState<Filter>('focus')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try { const [taskFeed, personalized] = await Promise.all([listMyTasks(), getPersonalizedLearningPath()]); setFeed(taskFeed); setPath(personalized) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Tasks could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const motivation = path?.motivation
  const tasks = feed?.tasks ?? []
  const focusTasks = useMemo(() => tasks.filter(task => ['overdue', 'returned', 'in_progress', 'ready'].includes(task.status)), [tasks])
  const filtered = useMemo(() => {
    if (filter === 'focus') return focusTasks
    if (filter === 'submitted') return tasks.filter(task => task.status === 'awaiting_marking')
    if (filter === 'results') return tasks.filter(task => task.status === 'released')
    return tasks
  }, [filter, focusTasks, tasks])
  const nextTask = path?.nextMission ?? motivation?.nextMission ?? focusTasks[0] ?? null
  const goal = motivation?.dailyGoal
  const goalRate = goal ? Math.min(100, Math.round((goal.completed / Math.max(1, goal.target)) * 100)) : 0

  if (loading) return <div style={{ display: 'grid', gap: 12 }}><Skel h={180} radius={20} /><Skel h={90} radius={14} /><Skel h={90} radius={14} /></div>

  return <div style={{ animation: 'slideIn 0.22s ease' }}>
    <section style={hero}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}><div><div style={eyebrow}>TODAY'S BEST NEXT STEP</div><h1 style={{ margin: '5px 0 6px', fontSize: 23, fontFamily: "'Bricolage Grotesque',sans-serif" }}>{nextTask ? nextTask.title : 'You are caught up'}</h1><p style={heroText}>{nextTask ? `${TYPE_LABEL[nextTask.taskType] ?? nextTask.taskType} · ${nextTask.subject} · ${dueLabel(nextTask)}` : 'Review your recommendations or recent learning journey.'}</p></div><div style={{ textAlign: 'right', flex: '0 0 auto' }}><div style={{ fontSize: 18, fontWeight: 900 }}>{motivation?.totalXp ?? 0}</div><div style={eyebrow}>VERIFIED XP</div></div></div>
      {nextTask && <button type="button" onClick={() => router.push(nextTask.actionUrl)} style={missionButton}>{nextTask.actionLabel}</button>}
      <div style={{ marginTop: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,.72)', marginBottom: 5 }}><span>Daily learning goal</span><strong>{goal?.completed ?? 0}/{goal?.target ?? 1}</strong></div><div style={heroTrack}><div style={{ width: `${goalRate}%`, height: '100%', background: '#fff', borderRadius: 999 }} /></div></div>
    </section>

    {error && <section style={{ ...card, color: '#b91c1c', borderColor: '#fecaca' }}>{error}<button type="button" onClick={() => void load()} style={{ ...smallButton, marginLeft: 10 }}>Retry</button></section>}

    <section style={statsGrid}><Stat label="To do" value={feed?.counts.toDo ?? 0} emphasis={(feed?.counts.toDo ?? 0) > 0} /><Stat label="In progress" value={feed?.counts.inProgress ?? 0} /><Stat label="Day streak" value={motivation?.streak.current ?? 0} /><Stat label="Path steps" value={path?.recommendations.length ?? 0} /></section>

    {(path?.recommendations.length ?? 0) > 0 && <section style={{ ...card, marginBottom: 14 }}><div style={sectionTitle}>Your learning path</div><div style={{ display: 'grid', gap: 9 }}>{path?.recommendations.slice(0, 5).map(item => <div key={item.id} style={recommendationRow}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 12 }}>{item.title}</strong><span style={recommendationBadge}>{RECOMMENDATION_LABEL[item.type] ?? item.type}</span></div><p style={{ margin: '5px 0 0', fontSize: 10, lineHeight: 1.45, color: 'var(--vs-muted)' }}>{item.reason}</p><div style={{ marginTop: 6, fontSize: 9, color: 'var(--vs-muted)' }}>{Math.round(item.confidence * 100)}% evidence confidence{item.nextReviewAt ? ` · Review ${new Date(item.nextReviewAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}` : ''}</div></div>)}</div></section>}

    {(motivation?.achievements.length ?? 0) > 0 && <section style={{ ...card, marginBottom: 14 }}><div style={sectionTitle}>Recent achievements</div><div style={{ display: 'grid', gap: 8 }}>{motivation?.achievements.slice(0, 3).map(item => <div key={item.slug} style={achievementRow}><span style={{ fontSize: 22 }}>{item.icon}</span><div><strong style={{ fontSize: 12 }}>{item.title}</strong><div style={{ fontSize: 10, color: 'var(--vs-muted)', marginTop: 2 }}>{item.description}</div></div></div>)}</div></section>}

    {(motivation?.subjectProgress.length ?? 0) > 0 && <section style={{ ...card, marginBottom: 14 }}><div style={sectionTitle}>Subject progress</div><div style={{ display: 'grid', gap: 10 }}>{motivation?.subjectProgress.slice(0, 4).map(item => { const progress = item.totalTasks > 0 ? Math.round((item.completedTasks / item.totalTasks) * 100) : 0; return <div key={item.subjectId}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11 }}><strong>{item.subjectName}</strong><span style={{ color: 'var(--vs-muted)' }}>{item.completedTasks}/{item.totalTasks} tasks</span></div><div style={track}><div style={{ width: `${Math.min(100, progress)}%`, height: '100%', background: 'var(--vs-accent)' }} /></div></div> })}</div></section>}

    {(path?.timeline.length ?? 0) > 0 && <section style={{ ...card, marginBottom: 14 }}><div style={sectionTitle}>Learning journey</div><div style={{ display: 'grid', gap: 10 }}>{path?.timeline.slice(0, 6).map(item => <div key={item.id} style={timelineRow}><div style={timelineDot} /><div><strong style={{ fontSize: 11 }}>{item.title}</strong>{item.summary && <div style={{ fontSize: 10, color: 'var(--vs-muted)', marginTop: 2 }}>{item.summary}</div>}<div style={{ fontSize: 9, color: 'var(--vs-muted)', marginTop: 3 }}>{item.occurredAt ? new Date(item.occurredAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div></div></div>)}</div></section>}

    <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>{([['focus', 'Focus'], ['all', 'All tasks'], ['submitted', 'Submitted'], ['results', 'Results']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} style={{ ...filterButton, ...(filter === id ? activeFilter : {}) }}>{label}</button>)}</div>

    {filtered.length === 0 ? <section style={{ ...card, textAlign: 'center', padding: '42px 20px' }}><div style={{ fontSize: 30, marginBottom: 8 }}>✓</div><strong>No tasks in this section</strong><p style={{ margin: '6px 0 0', color: 'var(--vs-muted)', fontSize: 12 }}>Your next assigned task will appear here.</p></section> : <div style={{ display: 'grid', gap: 10 }}>{filtered.map(task => { const tone = taskTone(task); return <article key={task.taskId} style={{ ...card, borderLeft: `4px solid ${tone.accent}` }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 800, color: tone.text, textTransform: 'uppercase', letterSpacing: .8 }}>{TYPE_LABEL[task.taskType] ?? task.taskType}</div><h2 style={{ fontSize: 14, margin: '4px 0', lineHeight: 1.35 }}>{task.title}</h2><div style={{ fontSize: 11, color: 'var(--vs-muted)' }}>{task.subject} · {dueLabel(task)}</div></div><span style={{ alignSelf: 'flex-start', padding: '4px 8px', borderRadius: 999, background: tone.soft, color: tone.text, fontSize: 9, fontWeight: 800, textTransform: 'capitalize' }}>{task.status.replaceAll('_', ' ')}</span></div>{task.progress > 0 && task.progress < 100 && <div style={{ marginTop: 10 }}><div style={track}><div style={{ width: `${task.progress}%`, height: '100%', background: tone.accent }} /></div></div>}{task.status === 'released' && task.score !== null && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: '#065f46' }}>{task.score}{task.maxScore !== null ? ` / ${task.maxScore}` : ''}</div>}{task.feedback && <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--vs-muted)', lineHeight: 1.5 }}>{task.feedback}</p>}<button type="button" disabled={task.status === 'awaiting_marking' || task.status === 'closed' || task.status === 'upcoming'} onClick={() => router.push(task.actionUrl)} style={{ ...taskButton, background: tone.accent, opacity: ['awaiting_marking', 'closed', 'upcoming'].includes(task.status) ? .55 : 1 }}>{task.actionLabel}</button></article> })}</div>}

    <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--vs-muted)', marginTop: 16 }}>Recommendations are generated from real learning evidence, teacher priorities and completed schoolwork.</p>
  </div>
}

function Stat({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) { return <div style={{ ...stat, background: emphasis ? '#fff7ed' : 'var(--vs-card)' }}><strong style={{ fontSize: 18, color: emphasis ? '#c2410c' : 'var(--vs-text)' }}>{value}</strong><span style={{ fontSize: 9, color: 'var(--vs-muted)', fontWeight: 700 }}>{label}</span></div> }
const hero: React.CSSProperties = { background: 'linear-gradient(135deg,#4338ca,#7c3aed)', color: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 10px 24px rgba(67,56,202,.2)' }
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.68)', letterSpacing: 1 }
const heroText: React.CSSProperties = { margin: 0, fontSize: 12, color: 'rgba(255,255,255,.78)' }
const heroTrack: React.CSSProperties = { height: 7, borderRadius: 999, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }
const card: React.CSSProperties = { background: 'var(--vs-card)', border: '1px solid var(--vs-border)', borderRadius: 14, padding: 14 }
const missionButton: React.CSSProperties = { marginTop: 14, width: '100%', border: 'none', borderRadius: 11, padding: '11px 14px', background: '#fff', color: '#4338ca', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' }
const statsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 7, marginBottom: 14 }
const stat: React.CSSProperties = { border: '1px solid var(--vs-border)', borderRadius: 12, padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10, color: 'var(--vs-muted)' }
const achievementRow: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 11, background: 'var(--vs-soft)' }
const recommendationRow: React.CSSProperties = { padding: 11, border: '1px solid var(--vs-border)', borderRadius: 11, background: 'var(--vs-soft)' }
const recommendationBadge: React.CSSProperties = { flex: '0 0 auto', padding: '3px 7px', borderRadius: 999, background: 'var(--vs-accent-soft)', color: 'var(--vs-accent)', fontSize: 9, fontWeight: 800 }
const timelineRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '12px 1fr', gap: 9, alignItems: 'start' }
const timelineDot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999, background: 'var(--vs-accent)', marginTop: 4 }
const track: React.CSSProperties = { height: 6, borderRadius: 999, background: 'var(--vs-border)', overflow: 'hidden', marginTop: 6 }
const filterButton: React.CSSProperties = { flex: '0 0 auto', border: '1px solid var(--vs-border)', borderRadius: 999, padding: '8px 12px', background: 'var(--vs-card)', color: 'var(--vs-muted)', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, cursor: 'pointer' }
const activeFilter: React.CSSProperties = { background: 'var(--vs-accent)', color: '#fff', borderColor: 'var(--vs-accent)' }
const taskButton: React.CSSProperties = { marginTop: 12, width: '100%', border: 'none', borderRadius: 10, padding: '10px 12px', color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: 12, cursor: 'pointer' }
const smallButton: React.CSSProperties = { border: '1px solid #fecaca', borderRadius: 8, padding: '5px 9px', background: '#fff', color: '#b91c1c', fontFamily: 'inherit', fontWeight: 700 }
