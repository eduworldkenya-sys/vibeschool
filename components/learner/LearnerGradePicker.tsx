'use client'

import { LEARNER_GRADES } from '@/lib/learner/independent-grade'
import styles from './LearnerGradePicker.module.css'

type Props = {
  value: string
  onChange: (grade: string) => void
  legend?: string
}

// All grades remain visible without invoking an OS-native select popup. This
// avoids dark-page text inheriting into a light Chrome/Windows dropdown menu.
export default function LearnerGradePicker({ value, onChange, legend = 'Your grade or form' }: Props) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.grid}>
        {LEARNER_GRADES.map(grade => (
          <button
            key={grade}
            type="button"
            className={styles.option}
            aria-pressed={value === grade}
            onClick={() => onChange(grade)}
          >
            {grade}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
