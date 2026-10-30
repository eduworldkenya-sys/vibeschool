'use client'
import {useState} from 'react'
import {giftWhatsAppUrl} from '@/lib/success-wishes/gift-sharing'
import styles from './SuccessCardStudio.module.css'

const WhatsAppIcon=()=> <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 .8A15.1 15.1 0 0 0 3 23.5L.9 31l7.7-2A15.2 15.2 0 1 0 16 .8Zm0 27.6c-2.5 0-4.9-.7-7-2l-.5-.3-4.5 1.2 1.2-4.4-.3-.5A12.5 12.5 0 1 1 16 28.4Zm6.8-9.3c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3.1-2-1.2-1-2-2.3-2.2-2.7-.2-.4 0-.6.2-.8l.6-.7.4-.6c.1-.2 0-.5 0-.7l-1.2-2.8c-.3-.7-.6-.6-.9-.6h-.8c-.3 0-.7.1-1 .5s-1.4 1.3-1.4 3.2 1.4 3.7c.1 2.4 1.4 4.7 3.5 6.5 2.1 1.8 4.2 2.5 5.6 2.8 1.4.3 2.7.3 3.7.2 1.1-.2 2.3-1 2.6-1.9.3-.9.3-1.7.2-1.9-.1-.2-.3-.3-.7-.5Z"/></svg>

export default function GiftShareActions({link,candidate,sender,compact=false,recipientPhone}:{link:string;candidate?:string;sender?:string;compact?:boolean;recipientPhone?:string}) {
  const [notice,setNotice]=useState('')
  const whatsapp=giftWhatsAppUrl(link,candidate,sender,recipientPhone)
  if(!whatsapp)return null
  if(compact)return <div className={styles.giftShare}><a className={styles.primary} href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'#25D366',color:'#092413'}}><WhatsAppIcon/> Send via WhatsApp</a></div>
  async function copy(){
    try{await navigator.clipboard.writeText(link);setNotice('Link copied ✓')}
    catch{setNotice('Couldn’t copy. Open “View link” to select and copy it.')}
  }
  return <div className={styles.giftShare}>
    <a className={styles.primary} href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><WhatsAppIcon/> Share on WhatsApp</a>
    <div className={styles.checkoutActions}><button type="button" className={styles.secondary} onClick={()=>void copy()}>{notice==='Link copied ✓'?notice:'Copy link'}</button><a className={styles.secondary} href={link} referrerPolicy="no-referrer">View card</a></div>
    <details className={styles.checkoutDetails}><summary>View link</summary><label className={styles.checkoutLabel}>Private card link<input readOnly value={link} onFocus={e=>e.target.select()}/></label></details>
    {notice&&<p role="status">{notice}</p>}
    <p>Share privately. Anyone with this link can open the card.</p>
  </div>
}
