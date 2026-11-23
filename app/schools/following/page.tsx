'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { supabase } from '@/lib/supabase'
import { schoolUrl } from '@/lib/school-urls'
import styles from '@/app/schools/components/SchoolPublicContent.module.css'
import schoolStyles from '@/app/schools/schools.module.css'

type FeedPost = {
  id:string;school_slug:string;school_name:string;kind:string;title:string;body:string;
  details:Record<string,unknown>;publisher_kind:'hq'|'school';published_at:string
}
export default function FollowedSchoolsPage() {
  const [rows,setRows]=useState<FeedPost[]>([])
  const [status,setStatus]=useState<'loading'|'login'|'ready'|'error'>('loading')
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    let active=true
    void (async()=>{
      setStatus('loading')
      const {data:{user},error:authError}=await supabase.auth.getUser()
      if(!active)return
      if(!user){setStatus(authError&&authError.name!=='AuthSessionMissingError'?'error':'login');return}
      const {data,error}=await supabase.rpc('school_followed_public_feed_v1',{p_limit:60})
      if(!active)return
      if(error){setStatus('error');return}
      setRows((data??[]) as FeedPost[]);setStatus('ready')
    })()
    return()=>{active=false}
  },[retry])
  return <div className={`${schoolStyles.page} ${schoolStyles.directoryPage}`}>
    <PublicHeader product="Schools"/>
    <main id="main-content" style={{maxWidth:850,margin:'auto',padding:'28px 14px 70px'}}>
      <nav aria-label="Breadcrumb"><Link href="/schools">Schools</Link> / Following</nav>
      <h1 style={{fontSize:'clamp(26px,5vw,36px)',margin:'18px 0 4px'}}>Updates from followed schools</h1>
      <p style={{color:'var(--school-muted)',margin:'0 0 22px'}}>Public information from the schools you follow.</p>
      {status==='loading'&&<p role="status">Loading updates…</p>}
      {status==='login'&&<p><Link href={'/login?redirect='+encodeURIComponent('/schools/following')}>Sign in</Link> to see updates from schools you follow.</p>}
      {status==='error'&&<p role="alert">Could not load followed schools. <button onClick={()=>setRetry(x=>x+1)}>Retry</button></p>}
      {status==='ready'&&(!rows.length?<p className={styles.empty}>No new updates from your followed schools. <Link href="/schools">Find schools</Link></p>:
      <div className={styles.cards} style={{gridTemplateColumns:'1fr'}}>
        {rows.map(post=><article className={styles.card} key={post.id}>
          <div className={styles.meta}><Link href={schoolUrl(post.school_slug)}>{post.school_name}</Link>
            <span>{post.kind==='announcement'?'News':post.kind.charAt(0).toUpperCase()+post.kind.slice(1)}</span>
            <time dateTime={post.published_at}>{new Date(post.published_at).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})}</time></div>
          <h2 style={{fontSize:18,margin:'12px 0 8px'}}>{post.title}</h2>
          {post.kind==='fees'&&post.details?.amount!=null&&<strong>{'KES '+Number(post.details.amount).toLocaleString('en-KE')}</strong>}
          <p className={styles.body}>{post.body}</p>
          <small>{post.publisher_kind==='hq'?'Published by VibeSchool HQ':'Published by school administration'}</small>
        </article>)}
      </div>)}
    </main><PublicFooter/>
  </div>
}
