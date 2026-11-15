'use client'

import { useEffect, useState } from 'react'
import { Bell, BellPlus, CalendarDays, Check, ClipboardList, Info, Megaphone, Share2, Shirt, Wallet } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import styles from './SchoolVisitorHome.module.css'

type Tab = 'home' | 'updates' | 'information'
type Detail = 'fees' | 'uniforms' | 'admissions' | 'calendar'
type Fact = readonly [string, string | null]

const essentials: { key: Detail; label: string; Icon: typeof Wallet }[] = [
  { key: 'fees', label: 'School fees', Icon: Wallet },
  { key: 'uniforms', label: 'Uniforms', Icon: Shirt },
  { key: 'admissions', label: 'Admissions', Icon: ClipboardList },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
]

function FollowSchool({ slug }: { slug: string }) {
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let active = true
    setLoaded(false)
    setFeedback('')
    void (async () => {
      const db = getSupabaseClient()
      const { data: auth, error: authError } = await db.auth.getUser()
      if (!active) return
      if (authError) { setFeedback('Sign in to follow this school.'); setLoaded(true); return }
      if (!auth.user) { setLoaded(true); return }
      const result = await db.from('school_follows').select('school_slug')
        .eq('school_slug', slug).eq('follower_id', auth.user.id).maybeSingle()
      if (!active) return
      if (result.error) setFeedback('Following is temporarily unavailable.')
      else setFollowing(Boolean(result.data))
      setLoaded(true)
    })()
    return () => { active = false }
  }, [slug])

  async function toggle() {
    if (busy || !loaded) return
    setBusy(true)
    setFeedback('')
    try {
      const db = getSupabaseClient()
      const { data: auth, error: authError } = await db.auth.getUser()
      if (authError) { setFeedback('Could not verify your account.'); return }
      if (!auth.user) {
        window.location.assign('/login/global?redirect=' + encodeURIComponent('/school/' + slug))
        return
      }
      const result = following
        ? await db.from('school_follows').delete().eq('school_slug', slug).eq('follower_id', auth.user.id)
        : await db.from('school_follows').insert({ school_slug: slug, follower_id: auth.user.id })
      if (result.error) { setFeedback('Could not update. Try again.'); return }
      setFollowing(value => !value)
    } finally {
      setBusy(false)
    }
  }
  return <div className={styles.followArea}>
    <button type="button" className={following ? styles.following : styles.follow} onClick={() => void toggle()}
      disabled={!loaded || busy} aria-pressed={following}>
      {following ? <Check size={17} /> : <BellPlus size={17} />}
      {busy ? 'Updating…' : following ? 'Following' : 'Follow School'}
    </button>
    {feedback && <span role="status" className={styles.feedback}>{feedback}</span>}
  </div>
}

export default function SchoolVisitorHome({ slug, facts, section }: {
  slug: string; facts: Fact[]; section?: string
}) {
  const [tab, setTab] = useState<Tab>(section === 'news' ? 'updates' : section ? 'information' : 'home')
  const [detail, setDetail] = useState<Detail>('fees')
  const [shareFeedback, setShareFeedback] = useState('')
  const visibleFacts = facts.filter(([, value]) => Boolean(value))
  const chosen = essentials.find(x => x.key === detail) ?? essentials[0]
  async function share() {
    setShareFeedback('')
    const url = window.location.origin + '/school/' + encodeURIComponent(slug)
    try {
      if (navigator.share) await navigator.share({ url })
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setShareFeedback('Link copied')
      } else setShareFeedback('Sharing unavailable in this browser')
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setShareFeedback('Could not share this school')
    }
  }

  return <section className={styles.root} aria-label="School home">
    <div className={styles.topActions}>
      <FollowSchool slug={slug}/>
      <button type="button" className={styles.share} onClick={() => void share()}><Share2 size={17}/> Share</button>
    </div>
    {shareFeedback && <p className={styles.feedback} role="status">{shareFeedback}</p>}
    <nav aria-label="School home sections" className={styles.nav}>
      {([['home', 'Home'], ['updates', 'Updates'], ['information', 'Information']] as const).map(([key, label]) =>
        <button type="button" key={key} className={tab === key ? styles.activeTab : styles.tab}
          aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button>
      )}
    </nav>
    <div className={styles.content}>
      {tab === 'home' && <>
        <h2 className={styles.heading}>School essentials</h2>
        <div className={styles.grid}>
          {essentials.map(({ key, label, Icon }) => <button type="button" className={styles.tile} key={key}
            onClick={() => { setDetail(key); setTab('information') }}>
            <Icon size={21} aria-hidden="true"/><strong>{label}</strong><span>View details <span aria-hidden="true">↗</span></span>
          </button>)}
        </div>
        <h2 className={styles.heading}>Latest updates</h2>
        <div className={styles.empty}><Megaphone size={20}/><div><strong>No announcements yet</strong><p>School updates will appear here when published.</p></div></div>
      </>}
      {tab === 'updates' && <>
        <h2 className={styles.heading}>School updates</h2>
        <div className={styles.empty}><Bell size={21}/><div><strong>No announcements yet</strong><p>Verified school and clearly attributed VibeSchool updates will appear here.</p></div></div>
      </>}
      {tab === 'information' && <>
        <h2 className={styles.heading}>School information</h2>
        <div className={styles.pills}>
          {essentials.map(({ key, label }) => <button type="button" key={key} aria-pressed={detail === key}
            className={detail === key ? styles.selectedPill : styles.pill}
            onClick={() => setDetail(key)}>{label}</button>)}
        </div>
        <div className={styles.infoPanel}><chosen.Icon size={19} aria-hidden="true"/>
          <div><strong>{chosen.label}</strong><p>Official information has not been published for this section.</p></div>
        </div>
        {visibleFacts.length > 0 && <div className={styles.facts}>
          <h3><Info size={18}/> School details</h3>
          <dl>{visibleFacts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </div>}
      </>}
    </div>
  </section>
}
