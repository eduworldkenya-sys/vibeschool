'use client'
import Link from 'next/link'
import type {CSSProperties, ReactNode} from 'react'
import {ArrowRight, Check, Heart} from 'lucide-react'
import {palette, templates, type Template} from './card-themes'
import styles from './WishTile.module.css'

type Props = {
  recipient:string
  theme?:string
  sender:string|null
  opened:boolean
  date?:string
  ariaLabel:string
  busy?:boolean
  disabled?:boolean
  href?:string
  onOpen?:()=>void
}
export default function WishTile({recipient,theme,sender,opened,date,ariaLabel,busy=false,disabled=false,href,onOpen}:Props){
 const design=templates.find(item=>item.id===theme)||templates[0]
 const colors=palette[design.id as Template]
 const coverStyle={'--cover-top':colors.top,'--cover-bottom':colors.bottom,'--cover-ink':colors.ink,'--cover-accent':colors.accent} as CSSProperties
 const inner:ReactNode=<>
  <span className={styles.cover} style={coverStyle} aria-hidden="true">
   <span className={styles.frame}/>
   <span className={styles.brand}>SUCCESS WISHES</span>
   <span className={styles.ornament}>{design.id==='botanical'?'✿':design.id==='nightfall'?'✦':design.id==='sunrise'?'☀':'✧'}</span>
   <span className={styles.headline}>{design.headline}</span>
   <span className={styles.recipient}>For {recipient}</span>
   <span className={styles.seal}>{opened?<Check size={15}/>:<Heart size={15}/>}</span>
  </span>
  <span className={styles.body}>
   <span className={styles.meta}><span className={opened?styles.opened:styles.unopened}>{opened?'Opened':'New wish'}</span>{date&&<time>{date}</time>}</span>
   <strong>{opened?sender||'Someone special':'A wish for you'}</strong>
   <span className={styles.action}>{busy?'Opening…':opened?'Read again':'Open your wish'}<ArrowRight size={17} aria-hidden="true"/></span>
  </span>
 </>
 const common={className:styles.tile,'aria-label':ariaLabel,'aria-busy':busy} as const
 if(href) return <Link href={href} {...common}>{inner}</Link>
 return <button type="button" {...common} disabled={disabled||busy} onClick={onOpen}>{inner}</button>
}
