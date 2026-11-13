'use client'

import { type ReactNode } from 'react'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import { buildLearningToolContext, getLearningToolSectionBinding } from '@/lib/learn/teachingToolContentBridge.mjs'
import TeachingToolHost from '@/components/learn/TeachingToolHost'
import { learnSubjectMode, type TeachingToolSection } from '@/lib/learn/teachingToolRegistry'
import styles from './UniversalLearnReader.module.css'

/** Presentation-only contract. Canonical release/RLS checks stay with the caller. */
export type UniversalLearnSection = TeachingToolSection & {
  title: string
  hint?: string
}

export { learnSubjectMode } from '@/lib/learn/teachingToolRegistry'

type Props = {
  subject: string
  sections: readonly UniversalLearnSection[]
  title?: string
  goal?: string
  anchorPrefix?: string
  renderBody?: (section: UniversalLearnSection, index: number) => ReactNode
  afterSection?: (section: UniversalLearnSection, index: number) => ReactNode
  /** Read-only tool inputs from the existing published/certified source. */
  toolContext?: ReturnType<typeof buildLearningToolContext>
}

/**
 * Shared Learn section renderer for every subject and grade.
 * Content arrives from the existing certified/released source, never from a
 * hardcoded lesson or a new data store. Unknown sections remain readable.
 */
export default function UniversalLearnReader({
  subject, sections, title, goal, anchorPrefix = 'learn',
  renderBody, afterSection, toolContext,
}: Props) {
  const mode = learnSubjectMode(subject)
  // Full-reader pages have an h2 lesson title; outcome pages supply an h3 title.
  const SectionHeading = title ? 'h4' : 'h3'
  const anchor = (section: UniversalLearnSection, index: number) =>
    `${anchorPrefix}-${index}-${section.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`
  const validSections = sections.filter(section => typeof section.body === 'string' && !!section.body.trim())
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
        const toolBinding = toolContext ? getLearningToolSectionBinding(toolContext, section, index) : null
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
              ?? (toolContext && !toolBinding
                ? <VisualRichText body={section.body} />
                : <TeachingToolHost subject={subject} section={section} sourceBinding={toolBinding} />)}
          </div>
          {afterSection?.(section, index)}
        </section>
      })}
    </div>
  </div>
}
