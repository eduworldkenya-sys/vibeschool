'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpenCheck, CalendarDays, ChartNoAxesCombined, ClipboardCheck, LayoutDashboard, LockKeyhole } from 'lucide-react'
import styles from './Institutions.module.css'

const roleViews = {
  leadership: {
    label: 'School leader',
    heading: 'See the whole school without losing the detail.',
    description: 'A single starting point for managing people, classes, teaching activity and learning evidence.',
    modules: [
      ['School & classes', 'School setup, staff and class organisation'],
      ['Teaching activity', 'Lesson plans, schedules and delivery'],
      ['Results & progress', 'Assessment evidence and support needs'],
      ['School operations', 'Attendance and authorised records'],
    ],
    href: '/contact?support=school',
    action: 'Request school setup',
  },
  teacher: {
    label: 'Teacher',
    heading: 'Move from curriculum to the next lesson.',
    description: 'Bring planning, teaching resources, classroom activity and learner feedback together.',
    modules: [
      ['Curriculum & schemes', 'What to teach and when'],
      ['Lesson preparation', 'Notes, resources and worked examples'],
      ['Teaching', 'Classroom and lesson delivery'],
      ['Assessment', 'Marking, feedback and next steps'],
    ],
    href: '/teacher',
    action: 'Explore teacher tools',
  },
  learner: {
    label: 'Learner',
    heading: 'Keep learning and improving.',
    description: 'Learners use their own workspace for lessons, practice, exams and progress.',
    modules: [
      ['My Learning', 'Lessons and learning resources'],
      ['Practice', 'Topic questions with feedback'],
      ['Exams', 'Assessment and results'],
      ['My Progress', 'Review strengths and next steps'],
    ],
    href: '/learn',
    action: 'Explore learning',
  },
  parent: {
    label: 'Parent',
    heading: 'Understand how your child is learning.',
    description: 'Parent access is limited to the information authorised for their linked learners.',
    modules: [
      ['Linked learners', 'Verified family relationships'],
      ['Learning updates', 'Appropriate activity and task information'],
      ['Results', 'Available assessment outcomes'],
      ['School updates', 'Approved school communications'],
    ],
    href: '/families',
    action: 'Explore parent experience',
  },
} as const

type RoleKey = keyof typeof roleViews
const roleKeys: RoleKey[] = ['leadership', 'teacher', 'learner', 'parent']
const icons = [LayoutDashboard, CalendarDays, ClipboardCheck, ChartNoAxesCombined]

export function InstitutionsRolePreview() {
  const [activeRole, setActiveRole] = useState<RoleKey>('leadership')
  const current = roleViews[activeRole]

  return (
    <div className={styles.rolesExperience}>
      <div className={styles.roleSelector} role="group" aria-label="Choose a workspace preview">
        {roleKeys.map((key) => (
          <button
            type="button"
            key={key}
            aria-pressed={key === activeRole}
            onClick={() => setActiveRole(key)}
            className={key === activeRole ? styles.roleSelected : styles.roleOption}
          >
            {roleViews[key].label}
          </button>
        ))}
      </div>
      <div className={styles.rolePreview} aria-live="polite">
        <div className={styles.rolePreviewHeader}>
          <span><LayoutDashboard size={18} aria-hidden="true" /> {current.label} workspace</span>
          <span className={styles.conceptLabel}>Guided preview</span>
        </div>
        <div className={styles.rolePreviewInner}>
          <div className={styles.rolePreviewIntro}>
            <h3>{current.heading}</h3>
            <p>{current.description}</p>
          </div>
          <div className={styles.moduleGrid}>
            {current.modules.map(([title, detail], index) => {
              const Icon = icons[index]
              return (
                <div className={styles.moduleCard} key={title}>
                  <Icon size={19} aria-hidden="true" />
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </div>
              )
            })}
          </div>
          <div className={styles.rolePreviewFooter}>
            <span><LockKeyhole size={15} aria-hidden="true" /> No private school or learner records in this preview</span>
            <Link href={current.href}>{current.action} <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
      <p className={styles.previewDisclaimer}><BookOpenCheck size={16} aria-hidden="true" /> Conceptual workspace preview. Actual features and access depend on verified school setup and the user’s permissions.</p>
    </div>
  )
}
