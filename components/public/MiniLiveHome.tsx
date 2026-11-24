'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { fetchApprovedMinis, loadMiniCovers, type MiniPost } from '@/lib/minis/data'
import { rankMiniLessons } from '@/lib/minis/recommendation'
import styles from './MiniExplore.module.css'

export function MiniLiveHome() {
  const [items,setItems] = useState<MiniPost[]>([])
  const [covers,setCovers] = useState<Record<string,string>>({})
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const posts = rankMiniLessons(await fetchApprovedMinis(60)).slice(0,3)
        const signed = await loadMiniCovers(posts)
        if (active) {setItems(posts);setCovers(signed)}
      } catch {if(active)setError(true)}
      finally {if(active)setLoading(false)}
    }
    void load()
    return () => { active=false }
  }, [])

  return <section className={styles.homeSection} aria-labelledby="mini-home-title">
    <div className={styles.sectionHeader}>
      <div><span className={styles.eyebrow}>SHARE WHAT YOU KNOW</span>
        <h2 id="mini-home-title">Discover something new.</h2>
        <p>Mini Lessons from VibeSchool educational creators.</p></div>
      <Link href="/explore" className={styles.sectionLink}>Explore Minis ↗</Link>
    </div>
    {loading ? <p role="status">Loading Mini Lessons…</p>
      : items.length ? <div className={styles.homeGrid}>
        {items.map(post=><Link key={post.id} href={'/explore?mini='+encodeURIComponent(post.id)}
          className={styles.miniCard}>
          {covers[post.id] ? <img className={styles.art} style={{width:'100%',objectFit:'cover'}}
            src={covers[post.id]} alt={'Photo for '+post.title}/>
          : <div className={styles.art+' '+styles.literatureArt} aria-hidden="true"/>}
          <div className={styles.miniCardBody}>
            <span className={styles.subject}>{(post.tags ?? []).map(tag=>'#'+tag).join(' ')}</span>
            <h3>{post.title}</h3>
            <p>{post.body.slice(0,120)}{post.body.length>120?'…':''}</p>
            <span className={styles.creatorLine}>@{post.creator_label} · Read ↗</span>
          </div>
        </Link>)}
      </div> : <p className={styles.subline}>
        {error ? 'Mini Lessons are temporarily unavailable.' : 'New Mini Lessons will appear here after publication.'}
      </p>}
  </section>
}
