'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookOpen, Grid2X2, Map, NotebookPen, Route } from 'lucide-react'
import styles from './ApprovedWorkspace.module.css'

export default function TeachingWorkspaceNav({ classId, subjectId, current, lessonPlanId, occurrenceId, termId }: { classId: string; subjectId: string; current: 'Lesson' | 'Curriculum' | 'Subject' | 'Scheme'; lessonPlanId?: string | null; occurrenceId?: string | null; termId?: string | null }) {
  const [more, setMore] = useState(false)
  const context = new URLSearchParams({ classId, subjectId })
  if (lessonPlanId) context.set('lessonPlanId', lessonPlanId)
  if (occurrenceId) context.set('occurrenceId', occurrenceId)
  if (termId) context.set('termId', termId)
  const query = context.toString()
  const links = [
    ['Lesson', '/teacher/lessonplan', NotebookPen], ['Curriculum', '/teacher/curriculum', Map],
    ['Subject', '/teacher/subjecthub', BookOpen], ['Scheme', '/teacher/scheme', Route],
  ] as const
  return <div className={styles.workspace}>
    <nav className="studio-workspace-nav" aria-label="Teaching workspace">{links.map(([label, path, Icon]) => <Link key={label} href={`${path}?${query}`} aria-current={current === label ? 'page' : undefined}><Icon size={18}/><span>{label}</span></Link>)}<button type="button" aria-expanded={more} aria-controls="studio-teaching-more" onClick={() => setMore(!more)}><Grid2X2 size={18}/><span>More</span></button></nav>
    {more && <div id="studio-teaching-more" className={styles.toolGrid}>{[['Lesson notes', '/teacher/lesson-notes'], ['Resources', '/teacher/resources'], ['Timetable', '/teacher/timetable'], ['Assessment', '/teacher/assessment'], ['Progress', `/teacher/classhub/${encodeURIComponent(classId)}/progress`], ['Teacher guide', '/teacher/teacher-guide']].map(([label, path]) => <Link className={styles.secondary} key={label} href={`${path}?${query}`}>{label} ↗</Link>)}</div>}
  </div>
}
