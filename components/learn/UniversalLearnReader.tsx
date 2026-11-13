'use client'

import { type ReactNode } from 'react'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import styles from './UniversalLearnReader.module.css'
import TeachingToolShelf from '@/components/learn/tools/TeachingToolShelf'
import type { TeachingToolSpec } from '@/lib/learn/teachingToolCatalog'
import TeachingToolHost from '@/components/learn/TeachingToolHost'
import { learnSubjectMode, type TeachingToolSection } from '@/lib/learn/teachingToolRegistry'

/** Presentation-only contract. Canonical release/RLS checks stay with the caller. */
export type UniversalLearnSection = TeachingToolSection & {
  title: string
  hint?: string
  tools?: readonly TeachingToolSpec[]
}

export { learnSubjectMode } from '@/lib/learn/teachingToolRegistry'

type Props = {
  subject: string
  sections: readonly UniversalLearnSection[]
  title?: string
  goal?: string
  anchorPrefix?: string
  topic?: string
  tools?: readonly TeachingToolSpec[]
  showTeachingTools?: boolean
  renderBody?: (section: UniversalLearnSection, index: number) => ReactNode
  afterSection?: (section: UniversalLearnSection, index: number) => ReactNode
}

/**
 * Shared Learn section renderer for every subject and grade.
 * Content arrives from the existing certified/released source, never from a
 * hardcoded lesson or a new data store. Unknown sections remain readable.
 */
export default function UniversalLearnReader({
  subject, sections, title, goal, anchorPrefix = 'learn',
  topic = '', tools, showTeachingTools = true,
  renderBody, afterSection,
}: Props) {
  const mode = learnSubjectMode(subject)
  // Full-reader pages have an h2 lesson title; outcome pages supply an h3 title.
  const SectionHeading = title ? 'h4' : 'h3'
  const anchor = (section: UniversalLearnSection, index: number) =>
    `${anchorPrefix}-${index}-${section.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`
  const validSections = sections.filter(section => typeof section.body === 'string' && !!section.body.trim())
  const sectionTools = validSections.flatMap(section => section.tools ?? [])
  if (!validSections.length) return <p role="status">No released lesson sections are available.</p>

  return <div className={styles.reader} data-subject-mode={mode}>
    {(title || goal) && <header className={styles.heading}>
      {title && <h3>{title}</h3>}
      {goal && <p><strong>What you will learn:</strong> {goal}</p>}
    </header>}
    {validSections.length > 1 && <nav className={styles.navigation} aria-label="Lesson sections">
      {validSections.map((section, index) =>
        <a key={anchor(section, index)} href={`#${anchor(section, index)}`}>{section.title || 'Section ' + (index + 1)}</a>)}
    </nav>}
    <div className={styles.sections}>
      {validSections.map((section, index) => {
        const id = anchor(section, index)
        const tone = ['learn', 'example', 'explore', 'practice', 'feedback', 'support', 'challenge', 'reflect'].includes(section.tone ?? '')
          ? section.tone : 'learn'
        if (section.id === 'feedback') return <details id={id} key={id} className={styles.feedback}>
          <summary>Review all explanations</summary>
          <div className={styles.feedbackBody}>
            {renderBody?.(section, index) ?? <VisualRichText body={section.body} />}
          </div>
        </details>
        return <section id={id} key={id} data-tone={tone} className={styles.section} aria-labelledby={`${id}-heading`}>
          <header className={styles.sectionHeading}>
            <SectionHeading id={`${id}-heading`}>{section.title || 'Read and learn'}</SectionHeading>
            {section.hint && <p>{section.hint}</p>}
          </header>
          <div className={styles.body}>
            {renderBody?.(section, index)
              ?? <TeachingToolHost subject={subject} section={section} />}
          </div>
          {afterSection?.(section, index)}
        </section>
      })}
    </div>
    {showTeachingTools && <TeachingToolShelf subject={subject} topic={topic || title || ''}
      tools={tools ?? (sectionTools.length ? sectionTools : undefined)} />}
  </div>
}
