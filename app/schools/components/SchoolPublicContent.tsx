'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { schoolUrl } from '@/lib/school-urls'
import styles from './SchoolPublicContent.module.css'

type Kind = 'announcement' | 'fees' | 'uniform' | 'admissions' | 'contact'
type Filter = 'all' | Kind
type Post = {
  id: string; school_slug: string; kind: Kind; title: string; body: string;
  details: Record<string, unknown>; status: string; publisher_kind: 'school' | 'hq'; published_at: string
}
const kinds: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All updates' }, { key: 'announcement', label: 'News' },
  { key: 'fees', label: 'Fees' }, { key: 'uniform', label: 'Uniforms' },
  { key: 'admissions', label: 'Admissions' }, { key: 'contact', label: 'Contacts' },
]
const empty: Record<Filter, string> = {
  all: 'No verified public updates have been published for this school.',
  announcement: 'No public school announcements yet.',
  fees: 'No verified school fee structure has been published here.',
  uniform: 'No official uniform information has been published here.',
  admissions: 'No verified admissions information has been published here.',
  contact: 'No verified school contact notice has been published here.',
}
const displayDate = (value: string) => new Date(value).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
const detailsLine = (post: Post) => {
  if (post.kind === 'fees' && post.details) {
    const d = post.details
    return [d.year ? 'Year ' + String(d.year) : null, d.term ? 'Term ' + String(d.term) : null,
      d.amount ? 'KES ' + Number(d.amount).toLocaleString('en-KE') : null].filter(Boolean).join(' · ')
  }
  return ''
}

export default function SchoolPublicContent({ slug, initialFilter = 'all', compact = false }: {
  slug: string; initialFilter?: Filter; compact?: boolean
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canPublish, setCanPublish] = useState(false)
  const [kind, setKind] = useState<Kind>('announcement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [term, setTerm] = useState('1')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: readError } = await supabase.from('school_public_posts')
      .select('id,school_slug,kind,title,body,details,status,publisher_kind,published_at')
      .eq('school_slug', slug).eq('status', 'published')
      .order('published_at', { ascending: false }).limit(40)
    if (readError) setError('School information is temporarily unavailable.')
    else setPosts((data ?? []) as Post[])
    setLoading(false)
  }, [slug])

  useEffect(() => {
    let active = true
    void load()
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return
      const { data, error: permissionError } = await supabase.rpc('school_can_publish_public_v1', { p_slug: slug })
      if (active) setCanPublish(!permissionError && data === true)
    })()
    return () => { active = false }
  }, [slug, load])

  async function publish(event: FormEvent) {
    event.preventDefault()
    if (!canPublish || saving) return
    setSaving(true); setMessage('')
    const details = kind === 'fees' ? { year, term, amount, currency: 'KES' } : {}
    const { error: writeError } = await supabase.rpc('school_publish_public_post_v1', {
      p_slug: slug, p_kind: kind, p_title: title.trim(), p_body: body.trim(), p_details: details,
    })
    if (writeError) setMessage('Could not publish. Check the details and your school permission.')
    else {
      setTitle(''); setBody(''); setAmount(''); setMessage('Published to the public school page.')
      await load()
    }
    setSaving(false)
  }

  async function withdraw(postId: string) {
    if (!canPublish || saving || !window.confirm('Withdraw this public notice?')) return
    setSaving(true); setMessage('')
    const { error: revokeError } = await supabase.rpc('school_withdraw_public_post_v1', { p_post_id: postId })
    if (revokeError) setMessage('Could not withdraw this publication.')
    else { setMessage('Publication withdrawn.'); await load() }
    setSaving(false)
  }

  const shown = posts.filter(p => filter === 'all' || p.kind === filter)
  return <section className={styles.section} aria-label="School public information">
    <div className={styles.heading}>
      <div><span className={styles.eyebrow}>SCHOOL INFORMATION</span><h2>Updates & information</h2></div>
      <Link href="/schools/following" className={styles.following}>My followed schools</Link>
    </div>
    <nav className={styles.tabs} aria-label="School information categories">
      {kinds.map(item => <button type="button" key={item.key}
        className={filter === item.key ? styles.selected : styles.tab}
        aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>)}
    </nav>
    {loading ? <p role="status" className={styles.empty}>Loading school information…</p> :
      error ? <div role="alert" className={styles.empty}>{error} <button type="button" onClick={() => void load()}>Retry</button></div> :
        shown.length ? <div className={styles.cards}>
          {shown.slice(0, compact ? 6 : 40).map(post => <article className={styles.card} key={post.id}>
            <div className={styles.meta}><span>{kinds.find(k => k.key === post.kind)?.label}</span>
              <span>{post.publisher_kind === 'hq' ? 'VibeSchool HQ' : 'School administration'}</span>
              <time dateTime={post.published_at}>{displayDate(post.published_at)}</time></div>
            <h3>{post.title}</h3>
            {detailsLine(post) && <strong className={styles.detail}>{detailsLine(post)}</strong>}
            <p className={styles.body}>{post.body}</p>
            {canPublish && <button type="button" className={styles.withdraw} disabled={saving} onClick={() => void withdraw(post.id)}>Withdraw</button>}
          </article>)}
        </div> : <p className={styles.empty}>{empty[filter]}</p>}
    {compact && shown.length > 6 && <Link className={styles.following} href={schoolUrl(slug) + '/news'}>See more updates</Link>}
    {canPublish && <details className={styles.publish}>
      <summary>Publish school information</summary>
      <form onSubmit={e => void publish(e)} className={styles.form}>
        <label>Category<select value={kind} onChange={e => setKind(e.target.value as Kind)}>
          {kinds.filter(k => k.key !== 'all').map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select></label>
        <label>Title<input required maxLength={130} minLength={3} value={title} onChange={e => setTitle(e.target.value)}/></label>
        <label>Information<textarea required maxLength={4000} minLength={3} rows={4} value={body} onChange={e => setBody(e.target.value)}/></label>
        {kind === 'fees' && <div className={styles.feeFields}>
          <label>Year<input inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={year} onChange={e => setYear(e.target.value)} required/></label>
          <label>Term<select value={term} onChange={e => setTerm(e.target.value)}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label>
          <label>Amount (KES)<input type="number" min="1" max="99999999" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required/></label>
        </div>}
        <p className={styles.hint}>Public information only. Private circulars and learner details stay in VibeConnect.</p>
        <button disabled={saving} className={styles.submit}>{saving ? 'Publishing…' : 'Publish'}</button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>}
  </section>
}
