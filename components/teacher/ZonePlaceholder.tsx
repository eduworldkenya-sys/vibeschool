import styles from './ZonePlaceholder.module.css'

interface Props {
  zoneNumber: number
  note: string
}

export default function ZonePlaceholder({ zoneNumber, note }: Props) {
  return (
    <div className={styles.placeholder}>
      <div className={styles.label}>Zone {zoneNumber} · Placeholder</div>
      <div className={styles.note}>{note}</div>
    </div>
  )
}