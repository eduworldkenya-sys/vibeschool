'use client'

import { ChevronRight, UserRound, UsersRound } from 'lucide-react'
import styles from './SuccessCardPriceChoice.module.css'

type Props = {
  onChooseOne: () => void
  onChooseFour: () => void
}

export default function SuccessCardPriceChoice({ onChooseOne, onChooseFour }: Props) {
  return (
    <section className={styles.container} aria-label="Choose Success Card price">
      <div className={styles.grid} role="group" aria-label="Choose number of students">
        <button type="button" className={styles.single} onClick={onChooseOne} aria-label="Choose One: one student, KSh 50">
          <span className={styles.details}>
            <UserRound size={23} aria-hidden="true" strokeWidth={2} />
            <span className={styles.label}><small>Share</small><strong className={styles.instant}>INSTANT</strong><small>Success Cards</small><strong className={styles.price}>KSh 50</strong></span>
          </span>
          <span className={styles.action}>Choose One <ChevronRight aria-hidden="true" size={16} /></span>
        </button>
        <button type="button" className={styles.group} onClick={onChooseFour} aria-label="Choose Four: up to four students, KSh 100, Buy 2 Get 2 Free">
          <span className={styles.details}>
            <UsersRound size={25} aria-hidden="true" strokeWidth={2} />
            <span className={styles.label}><strong className={styles.freeOffer}>Buy 2 Get 2 Free</strong><small>2 FREE Success Cards</small><strong className={styles.price}>KSh 100</strong><small>Up to 4 students</small></span>
          </span>
          <span className={styles.action}>Choose Four <ChevronRight aria-hidden="true" size={16} /></span>
        </button>
      </div>
    </section>
  )
}
