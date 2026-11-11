'use client'

import { useMemo, useState } from 'react'
import { TrackedLink } from '@/components/public/TrackedLink'
import { focusAreas } from './careerContent'
import styles from './careers.module.css'

type FocusId = (typeof focusAreas)[number]['id']

export function CareerInterest() {
  const [focusId, setFocusId] = useState<FocusId>('curriculum')
  const area = focusAreas.find(item => item.id === focusId) ?? focusAreas[0]
  const whatsappHref = useMemo(
    () => 'https://wa.me/254728232157?text=' + encodeURIComponent(
      `Hello VibeSchool. I'd like to introduce myself. My work is in ${area.name}.\n\nA little about my experience and a relevant example of my work:\n`
    ),
    [area.name]
  )

  return (
    <section className={styles.interestSection} id="talent-interest" aria-labelledby="interest-heading">
      <div className={[styles.container, styles.interestGrid].join(' ')}>
        <div>
          <p className={styles.eyebrow}>GET IN TOUCH</p>
          <h2 id="interest-heading">Have work worth showing us?</h2>
          <p>If your experience connects with VibeSchool, send us a short introduction. You don't need a formal vacancy to start a conversation.</p>
          <p className={styles.interestClarification}>This is an enquiry, not an application for a listed position.</p>
        </div>
        <div className={styles.interestForm}>
          <label htmlFor="career-focus">Your area of work</label>
          <select id="career-focus" value={focusId} onChange={event => setFocusId(event.target.value as FocusId)}>
            {focusAreas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <TrackedLink href={whatsappHref} event="public_careers_interest" external target="_blank" rel="noopener noreferrer" className={styles.whatsappAction}>
            Continue to WhatsApp <span aria-hidden="true">↗</span>
          </TrackedLink>
          <p className={styles.interestHint}>WhatsApp opens with a draft. Add a relevant example of your work and press Send there. Nothing is submitted on this page.</p>
          <p className={styles.interestPrivacy}>Please don't send ID documents, certificates, passwords or private learner information in an initial message.</p>
        </div>
      </div>
    </section>
  )
}
