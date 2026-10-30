'use client'

import { ChevronRight, UserRound } from 'lucide-react'
import styles from './SuccessCardPriceChoice.module.css'

type Props = {
  onChooseOne: () => void
  onChooseFour: () => void
}

export default function SuccessCardPriceChoice({ onChooseOne, onChooseFour }: Props) {
  return (
    <section className={styles.container} aria-label="Choose free Success Card">
      <div className={styles.grid} role="group" aria-label="Choose number of students">
        <button type="button" className={styles.single} onClick={onChooseOne} aria-label="Create one free Success Card">
          <span className={styles.details}>
            <UserRound size={23} aria-hidden="true" strokeWidth={2} />
            <span className={styles.label}><small>Share</small><strong className={styles.instant}>INSTANT</strong><small>Success Cards</small><strong className={styles.price}>FREE</strong></span>
          </span>
          <span className={styles.action}>Create Free Card <ChevronRight aria-hidden="true" size={16} /></span>
        </button>
      </div>
    </section>
  )
}
