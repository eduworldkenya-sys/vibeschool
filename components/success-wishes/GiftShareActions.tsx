'use client'
import { giftWhatsAppUrl } from '@/lib/success-wishes/gift-sharing'
import styles from './SuccessCardStudio.module.css'

export default function GiftShareActions({link}:{link:string}) {
  const whatsapp = giftWhatsAppUrl(link)
  if (!whatsapp) return null
  return <div className={styles.giftShare}>
    <a className={styles.primary} href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Share via WhatsApp</a>
    <p>Share privately. Anyone with this link can open the card.</p>
  </div>
}
