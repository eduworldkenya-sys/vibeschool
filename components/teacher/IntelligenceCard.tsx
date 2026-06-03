"use client";
'use client'

import { useState } from 'react'
import styles from './IntelligenceCard.module.css'

export interface Insight {
  id: string
  type: 'lesson_plan' | 'attendance' | 'gradebook' | 'parent'
  message: string
  ctaLabel: string
  ctaAction: () => void
  updatedAt: string
}

interface Props {
  insights: Insight[]
}

const TYPE_ACCENT: Record<Insight['type'], string> = {
  lesson_plan: '#F59E0B',
  attendance:  '#EF4444',
  gradebook:   '#3B82F6',
  parent:      '#8B5CF6',
}

const TYPE_ICON: Record<Insight['type'], string> = {
  lesson_plan: '✎',
  attendance:  '⚠',
  gradebook:   '▐',
  parent:      '✉',
}

export default function IntelligenceCard({ insights }: Props) {
  const [active, setActive] = useState(0)

  if (!insights.length) return null

  const insight = insights[active]
  const accent  = TYPE_ACCENT[insight.type]
  const icon    = TYPE_ICON[insight.type]

  return (
    <div className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>INTELLIGENCE</span>
        <div className={styles.dots}>
          {insights.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`${styles.dot} ${i === active ? styles.dotActive : ''}`}
              style={i === active ? { background: accent } : {}}
            />
          ))}
        </div>
      </div>

      <div className={styles.card} style={{ borderLeftColor: accent }}>
        <div className={styles.cardTop}>
          <span className={styles.cardIcon} style={{ color: accent }}>{icon}</span>
          <p className={styles.cardMessage}>{insight.message}</p>
        </div>
        <button
          className={styles.cta}
          style={{ color: accent, borderColor: `${accent}33`, background: `${accent}0D` }}
          onClick={insight.ctaAction}
        >
          {insight.ctaLabel}
        </button>
        <div className={styles.updatedAt}>Last updated {insight.updatedAt}</div>
      </div>
    </div>
  )
}