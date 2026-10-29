'use client'
import {giftWhatsAppUrl} from '@/lib/success-wishes/gift-sharing'
import styles from './SuccessCardStudio.module.css'

// Keep the finished gift screen focused on its one essential action.
export default function GiftShareActions({link,candidate}:{link:string;candidate?:string}) {
 const whatsapp=giftWhatsAppUrl(link,candidate)
 if(!whatsapp)return null
 return <div className={styles.giftShare}>
  <a className={styles.primary} href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Share on WhatsApp</a>
 </div>
}
