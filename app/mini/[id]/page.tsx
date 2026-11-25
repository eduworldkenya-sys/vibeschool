import {MiniSlideReader} from '@/components/public/MiniSlideDeck'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { PublicHeader } from '@/components/public/PublicHeader'
import { readPublicMini } from '@/lib/minis/public-server'
import { miniExplorePath, miniPublicPath } from '@/lib/minis/public-url'
import styles from '@/components/public/MiniExplore.module.css'

export const dynamic = 'force-dynamic'
const getMini = cache(readPublicMini)
type Props = { params: Promise<{id:string}> }
const site = 'https://vibeschool.co.ke'
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {id} = await params
  const mini = await getMini(id)
  if (!mini) return {title:'Mini Lesson unavailable',robots:{index:false,follow:false}}
  const url = site + miniPublicPath(mini.id)
  const description = mini.body.replace(/\s+/g,' ').slice(0,160)
  const images = mini.cover_path ? [{url:url+'/cover',alt:mini.title}] : undefined
  return { title: mini.title+' | VibeSchool Mini Lessons', description,
    alternates:{canonical:url}, robots:{index:true,follow:true},
    openGraph:{type:'article',title:mini.title,description,url,images},
    twitter:{card:mini.cover_path?'summary_large_image':'summary',title:mini.title,description,images:images?.map(image=>image.url)} }
}
export default async function PublicMiniPage({params}:Props) {
  const {id} = await params
  const mini = await getMini(id)
  if (!mini) notFound()
  return <div><PublicHeader product="Explore"/>
    <main id="main-content" tabIndex={-1} className={styles.explorePage}>
      <div className={styles.container}><article className={styles.reader}>
        <div className={styles.readerHeader}><Link href="/explore" className={styles.back}>← Explore</Link></div>
        {mini.slide_deck!=null&&<MiniSlideReader key={mini.id} value={mini.slide_deck}/>}
        {mini.cover_path && <img src={miniPublicPath(mini.id)+'/cover'} alt={mini.title} className={styles.art} style={{width:'100%',objectFit:'contain'}}/>}
        <div className={styles.readerBody}>
          <h1 className={styles.readerTitle}>{mini.title}</h1>
          <p>@{mini.creator_label}</p>
          {mini.body.split(/\n\s*\n/).map((paragraph,index)=><p key={index} className={styles.paragraph}>{paragraph}</p>)}
          <div className={styles.tagRow}>{mini.tags.map(tag=><Link key={tag} href={'/explore?tag='+encodeURIComponent(tag)} className={styles.tagButton}>#{tag}</Link>)}</div>
          <div className={styles.actions}><Link className={styles.primary} href={miniExplorePath(mini.id)}>Open lesson &amp; interact</Link>
            <Link href="/learn" className={styles.secondary}>Explore textbooks</Link></div>
        </div>
      </article></div>
    </main></div>
}
