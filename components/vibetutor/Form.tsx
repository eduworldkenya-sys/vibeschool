import type { ReactNode } from 'react'
import styles from './VibeTutor.module.css'

export function FormStep({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={styles.step} aria-labelledby={`step-${n}`}>
      <header className={styles.stepHead}>
        <span className={styles.stepNum} aria-hidden="true">{n}</span>
        <div>
          <h2 id={`step-${n}`} className={styles.stepTitle}>{title}</h2>
          {hint && <p className={styles.muted}>{hint}</p>}
        </div>
      </header>
      <div className={styles.stepBody}>{children}</div>
    </section>
  )
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        {label}
        {required && <span className={styles.req} aria-hidden="true"> *</span>}
      </span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className={styles.segment} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" className={`${styles.segmentBtn} ${value === o.value ? styles.segmentOn : ''}`} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ToggleChips({ label, options, selected, onToggle }: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className={styles.chipRowWrap} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o} type="button" className={`${styles.chip} ${selected.includes(o) ? styles.chipOn : ''}`} aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}
