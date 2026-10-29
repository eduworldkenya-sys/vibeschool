'use client'
import {useEffect,useState} from 'react'
import {giftWhatsAppUrl,giftShareMessage} from '@/lib/success-wishes/gift-sharing'
import styles from './SuccessCardStudio.module.css'

export default function GiftShareActions({link,candidate}:{link:string;candidate?:string}) {
  const [notice,setNotice]=useState(''),[canShare,setCanShare]=useState(false),[sharing,setSharing]=useState(false)
  useEffect(()=>setCanShare(typeof navigator.share==='function'),[])
  const whatsapp=giftWhatsAppUrl(link,candidate)
  if(!whatsapp)return null
  async function copy(){
    try{await navigator.clipboard.writeText(link);setNotice('Link copied ✓')}
    catch{setNotice('Couldn’t copy. Open “View link” to select and copy it.')}
  }
  async function share(){
    setSharing(true);setNotice('')
    try{await navigator.share({title:'A success wish for you',text:giftShareMessage(link,candidate)});setNotice('Sharing finished. You can share this card again anytime.')}
    catch(error){if(!(error instanceof Error&&error.name==='AbortError'))setNotice('Sharing unavailable. Use WhatsApp or copy the link.')}
    finally{setSharing(false)}
  }
  return <div className={styles.giftShare}>
    <a className={styles.primary} href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Share on WhatsApp</a>
    {canShare&&<button type="button" className={styles.secondary} disabled={sharing} onClick={()=>void share()}>{sharing?'Opening sharing…':'More sharing options'}</button>}
    <div className={styles.checkoutActions}><button type="button" className={styles.secondary} onClick={()=>void copy()}>{notice==='Link copied ✓'?notice:'Copy link'}</button><a className={styles.secondary} href={link} referrerPolicy="no-referrer">View card</a></div>
    <details className={styles.checkoutDetails}><summary>View link</summary><label className={styles.checkoutLabel}>Private card link<input readOnly value={link} onFocus={e=>e.target.select()}/></label></details>
    {notice&&<p role="status">{notice}</p>}
    <p>Share privately. Anyone with this link can open the card.</p>
  </div>
}
