'use client'

import Link from 'next/link'
import {
  ArrowRight, Bell, BookOpen, BookOpenCheck, BrainCircuit, CalendarDays,
  ChartNoAxesColumn, ChevronRight, ClipboardCheck, Eraser, FlaskConical,
  FolderOpen, House, Languages, LibraryBig, ListTodo, MessageCircle,
  NotebookPen, NotebookTabs, Palette, PencilLine, Ruler, School,
  Settings, UserRound, UsersRound, Video, Calculator, type LucideIcon,
} from 'lucide-react'
import { fallbackSubjectGroups, recogniseLearnerGrade } from '@/lib/learn/schoolCatalog'
import styles from './StudentHomeDesk.module.css'

type Reading = {
  title: string
  chapterTitle?: string | null
  actionUrl: string
  progressPercent: number
}
type Task = { title: string; subject?: string; actionLabel?: string }

type Props = {
  firstName?: string | null
  grade?: string | null
  isNewLearner: boolean
  reading: Reading | null
  nextTask: Task | null
  toDo: number
  schoolLinked: boolean
  openingTask: boolean
  onOpenTask: () => void
}

type Tool = { label: string; href: string; Icon: LucideIcon; unavailable?: boolean }
type Group = { name: string; tools: Tool[] }

const gradeHref = (grade: string | null, subject?: string) => {
  const params = new URLSearchParams()
  if (grade) params.set('grade', grade)
  if (subject) params.set('subject', subject)
  const query = params.toString()
  return '/learn' + (query ? '?' + query : '')
}
const safeReadingHref = (value: string): string | null =>
  value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null

function SubjectIcon({ name }: { name: string }) {
  if (/math/i.test(name)) return <Calculator size={23} aria-hidden="true" />
  if (/kiswahili|language|english/i.test(name)) return <Languages size={23} aria-hidden="true" />
  if (/science|environment/i.test(name)) return <FlaskConical size={23} aria-hidden="true" />
  if (/creative|art/i.test(name)) return <Palette size={23} aria-hidden="true" />
  return <BookOpen size={23} aria-hidden="true" />
}

export default function StudentHomeDesk({
  firstName, grade, isNewLearner, reading, nextTask, toDo, schoolLinked,
  openingTask, onOpenTask,
}: Props) {
  const learnerGrade = recogniseLearnerGrade(grade)
  // Discovery labels come from the existing school catalogue, not a second
  // content or curriculum authority. Released books are enforced at /learn.
  const subjects = learnerGrade
    ? fallbackSubjectGroups(learnerGrade).flatMap(group => group.subjects).slice(0, 4)
    : []
  const browseHref = gradeHref(learnerGrade)
  const resumeHref = reading ? safeReadingHref(reading.actionUrl) : null
  const liveEnabled = process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED === 'true'
  const groups: Group[] = [
    { name: 'Learning', tools: [
      { label: 'Learn', href: '/student/study', Icon: BookOpen },
      { label: 'Practice', href: '/student/vibelearn/topic-practice', Icon: PencilLine },
      { label: 'My Exams', href: '/student/vibelearn/exams', Icon: ClipboardCheck },
      { label: 'Revision', href: '/student/vibelearn/revision', Icon: BrainCircuit },
      { label: 'Mistakes', href: '/student/vibelearn/mistakes', Icon: Eraser },
      { label: 'Practice Sets', href: '/student/vibelearn/practice', Icon: BookOpenCheck },
      { label: 'Books & Stories', href: '/learn/stories', Icon: LibraryBig },
    ] },
    { name: 'My schoolwork', tools: [
      { label: 'Tasks', href: '/student/tasks', Icon: ListTodo },
      { label: 'Homework', href: '/student/homework', Icon: House },
      { label: 'Classwork', href: '/student/assessment', Icon: NotebookPen },
      { label: 'Exercises', href: '/student/exercises', Icon: Ruler },
      { label: 'Projects', href: schoolLinked ? '/student/projects' : '/student/projects/independent', Icon: FolderOpen },
      { label: 'My Day', href: '/student/timetable', Icon: CalendarDays },
    ] },
    { name: 'Live & communication', tools: [
      { label: 'Live', href: '/student/live', Icon: Video, unavailable: !liveEnabled },
      { label: 'My Tutors', href: '/student/tutoring', Icon: UsersRound },
      { label: 'VibeChat', href: '/vibechat', Icon: MessageCircle },
    ] },
    { name: 'My learning space', tools: [
      { label: 'Progress', href: '/student/marks', Icon: ChartNoAxesColumn },
      { label: 'Workspace', href: '/student/workspace', Icon: NotebookTabs },
      { label: 'School updates', href: '/schools/following', Icon: School },
      { label: 'Alerts', href: '/student/notifications', Icon: Bell },
      { label: 'Profile', href: '/student/profile', Icon: UserRound },
      { label: 'Settings', href: '/student/settings', Icon: Settings },
    ] },
  ]

  return <div className={styles.desk}>
    {isNewLearner ? (
      <section className={styles.hero} aria-label="Start learning">
        <div className={styles.heroTop}>
          <h1>What would you like to learn?</h1>
          <Link href={browseHref} className={styles.grade}>{learnerGrade ?? 'Choose grade'} <ChevronRight size={14} aria-hidden="true" /></Link>
        </div>
        {subjects.length > 0 && <nav className={styles.subjects} aria-label="Choose a subject">
          {subjects.map(subject => <Link href={gradeHref(learnerGrade, subject)} className={styles.subject} key={subject}>
            <span className={styles.subjectIcon}><SubjectIcon name={subject} /></span>
            <span>{subject}</span>
          </Link>)}
        </nav>}
        <Link href={browseHref} className={styles.primary}>Explore all subjects <ArrowRight size={18} aria-hidden="true" /></Link>
        <Link className={styles.joinClass} href="/student/profile">Have a teacher or class? <strong>View profile</strong></Link>
      </section>
    ) : (
      <section className={styles.hero} aria-label="Continue learning">
        <div className={styles.heroTop}>
          <h1>{firstName?.trim() ? 'Welcome back, ' + firstName.trim() : 'Welcome back'}</h1>
          {learnerGrade && <span className={styles.grade}>{learnerGrade}</span>}
        </div>
        <div className={styles.resume}>
          <span className={styles.eyebrow}>{resumeHref ? 'CONTINUE READING' : nextTask ? 'UP NEXT' : 'READY TO LEARN'}</span>
          <h2>{resumeHref ? reading?.title : nextTask ? nextTask.title : 'Choose your next lesson'}</h2>
          {resumeHref && reading && <>
            <p>{reading.chapterTitle || 'Your saved place'} · {Math.round(Math.max(0, Math.min(100, reading.progressPercent)))}% read</p>
            <div className={styles.track} role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(100, reading.progressPercent)))}>
              <div style={{ width: Math.max(0, Math.min(100, reading.progressPercent)) + '%' }} />
            </div>
          </>}
          {!resumeHref && nextTask && <p>{nextTask.subject || 'Assigned work'}</p>}
          {resumeHref ? <Link href={resumeHref} className={styles.primary}>Continue learning <ArrowRight size={18} aria-hidden="true" /></Link>
            : nextTask ? <button type="button" disabled={openingTask} className={styles.primary} onClick={onOpenTask}>{openingTask ? 'Opening…' : nextTask.actionLabel || 'Open task'} <ArrowRight size={18} aria-hidden="true" /></button>
            : <Link href={browseHref} className={styles.primary}>Explore subjects <ArrowRight size={18} aria-hidden="true" /></Link>}
        </div>
      </section>
    )}
    {nextTask && (isNewLearner || Boolean(resumeHref)) && <button type="button" className={styles.nextTask} onClick={onOpenTask} disabled={openingTask}>
      <span><strong>{nextTask.title}</strong><small>{nextTask.subject || 'Schoolwork'} · Next task</small></span>
      <ChevronRight size={19} aria-hidden="true" />
    </button>}
    {!isNewLearner && toDo > 0 && <Link href="/student/tasks" className={styles.taskCount}>{toDo} {toDo === 1 ? 'task' : 'tasks'} to do <ArrowRight size={15} aria-hidden="true" /></Link>}
    <section className={styles.toolSection} aria-labelledby="student-home-all-tools">
      <h2 id="student-home-all-tools">My tools</h2>
      {groups.map(group => <div key={group.name} className={styles.group}>
        <h3>{group.name}</h3>
        <nav className={styles.grid} aria-label={group.name}>
          {group.tools.map(({label,href,Icon,unavailable}) => unavailable
            ? <span key={label} className={styles.disabledTool} aria-label={label + ' unavailable'} title="Live classes are not enabled">
                <span className={styles.icon}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className={styles.toolName}>{label}</span>
                <span className={styles.unavailable}>Unavailable</span>
              </span>
            : <Link key={label} className={styles.tool} href={href}>
                <span className={styles.icon}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className={styles.toolName}>{label}</span>
              </Link>)}
        </nav>
      </div>)}
    </section>
  </div>
}
