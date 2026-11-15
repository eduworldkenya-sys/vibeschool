'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './SchoolPublicBoard.module.css'

type Kind = 'announcement' | 'fees' | 'uniform' | 'admissions'
type Tab = 'overview' | 'updates' | 'fees' | 'uniform' | 'admissions'
type Role = 'visitor' | 'school' | 'hq'
type Entry = {
  id: string; school_slug: string; content_kind: Kind; publisher_kind: 'school' | 'hq'
  title: string; body: string; status: 'draft' | 'published' | 'withdrawn'
  academic_year: number | null; term: string | null; amount_kes: number | null
  source_note: string | null; created_at: string; published_at: string | null; revision: number
}
const sections: { tab: Tab; label: string; kind?: Kind }[] = [
  { tab: 'overview', label: 'Overview' }, { tab: 'updates', label: 'Updates', kind: 'announcement' },
  { tab: 'fees', label: 'Fees', kind: 'fees' }, { tab: 'uniform', label: 'Uniform', kind: 'uniform' },
  { tab: 'admissions', label: 'Admissions', kind: 'admissions' },
]
const blank = { title: '', body: '', academic_year: String(new Date().getFullYear()), term: 'Term 1', amount_kes: '', source_note: '' }

function humanDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

export default function SchoolPublicBoard({ slug, schoolId, initialTab = 'overview' }: {
  slug: string; schoolId?: string; initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [role, setRole] = useState<Role>('visitor')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [edit, setEdit] = useState<Entry | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('announcement')
  const [form, setForm] = useState(blank)

  const reload = useCallback(async () => {
    setError('')
    const result = await supabase.from('school_public_content')
      .select('id,school_slug,content_kind,publisher_kind,title,body,status,academic_year,term,amount_kes,source_note,created_at,published_at,revision')
      .eq('school_slug', slug).order('created_at', { ascending: false }).limit(100)
    if (result.error) { setError('School information is unavailable.'); setEntries([]) }
    else setEntries((result.data ?? []) as Entry[])
    setLoading(false)
  }, [slug])

  useEffect(() => {
    let current = true
    setLoading(true)
    setTab(initialTab)
    setRole('visitor')
    setEntries([])
    setFormOpen(false)
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const owner = await supabase.rpc('is_platform_owner')
          if (current && !owner.error && owner.data === true) setRole('hq')
          else if (schoolId) {
            const admin = await supabase.rpc('is_school_admin', { p_school_id: schoolId })
            if (current && !admin.error && admin.data === true) setRole('school')
          }
        }
      } catch { /* Public school information remains available to visitors. */ }
      if (current) await reload()
    })()
    return () => { current = false }
  }, [slug, schoolId, initialTab, reload])

  function startCreate(newKind: Kind) {
    setEdit(null); setKind(newKind); setForm(blank); setFormOpen(true); setError(''); setNotice('')
  }
  function startEdit(item: Entry) {
    setEdit(item); setKind(item.content_kind); setTab(item.content_kind === 'announcement' ? 'updates' : item.content_kind)
    setForm({ title: item.title, body: item.body, academic_year: String(item.academic_year ?? new Date().getFullYear()),
      term: item.term ?? 'Term 1', amount_kes: String(item.amount_kes ?? ''), source_note: item.source_note ?? '' })
    setFormOpen(true); setError(''); setNotice('')
  }

  async function save(status: 'draft' | 'published' | 'withdrawn') {
    if (busy) return
    const title = form.title.trim(), body = form.body.trim(), source_note = form.source_note.trim()
    if (title.length < 3 || body.length < 10) { setError('Add a title and meaningful details.'); return }
    if (status === 'published' && kind === 'fees' && (
      role !== 'hq' || !/^\d{4}$/.test(form.academic_year)
      || form.amount_kes.trim() === '' || !Number.isFinite(Number(form.amount_kes)) || Number(form.amount_kes) < 0
      || source_note.length < 12
    )) { setError('Verified fee publication requires HQ approval, amount, year and source.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Sign in to manage this school.'); return }
      const payload = {
        title, body, status,
        academic_year: kind === 'fees' ? Number(form.academic_year) : null,
        term: kind === 'fees' ? form.term : null,
        amount_kes: kind === 'fees' && form.amount_kes.trim() !== '' ? Number(form.amount_kes) : null,
        source_note: source_note || null,
      }
      const response = edit
        ? await supabase.from('school_public_content').update(payload).eq('id', edit.id).eq('school_slug', slug)
        : await supabase.from('school_public_content').insert({
          ...payload, school_slug: slug, author_id: user.id,
          publisher_kind: role === 'hq' ? 'hq' : 'school', content_kind: kind,
        })
      if (response.error) { setError('Could not save. Check your permissions and try again.'); return }
      setNotice(status === 'published' ? 'Published' : status === 'withdrawn' ? 'Withdrawn' : 'Draft saved')
      setFormOpen(false); setEdit(null)
      await reload()
    } catch { setError('Could not save. Try again.') }
    finally { setBusy(false) }
  }

  const visible = entries.filter(x => x.status === 'published')
  const isEditor = role !== 'visitor'
  function itemsFor(k: Kind) { return visible.filter(e => e.content_kind === k) }
  const focused = sections.find(s => s.tab === tab)
  const displayed = focused?.kind ? entries.filter(e => e.content_kind === focused.kind && (isEditor || e.status === 'published')) : []
  const publishingAllowed = !(role === 'school' && kind === 'fees')

  return <section className={styles.board} aria-label="School information and updates">
    <div className={styles.heading}>
      <div><h2>School information</h2><p>Updates and practical details from authorised publishers</p></div>
      {isEditor && <button type="button" className={styles.manage} onClick={() => startCreate(tab === 'fees' ? 'fees' : tab === 'uniform' ? 'uniform' : tab === 'admissions' ? 'admissions' : 'announcement')}>+ Add update</button>}
    </div>
    <div className={styles.tabs} role="group" aria-label="School information sections">
      {sections.map(x => <button key={x.tab} type="button" aria-pressed={tab === x.tab} className={tab === x.tab ? styles.selected : styles.tab} onClick={() => { setTab(x.tab); setFormOpen(false); setError('') }}>{x.label}</button>)}
    </div>
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void reload()}>Retry</button></p>}
    {loading ? <p role="status" className={styles.empty}>Loading school information…</p>
      : tab === 'overview' ? <>
        <div className={styles.essentials}>
          {sections.filter(x => x.tab === 'fees' || x.tab === 'uniform' || x.tab === 'admissions').map(s => {
            const latest = itemsFor(s.kind!)[0]
            return <button type="button" key={s.tab} className={styles.essential} onClick={() => setTab(s.tab)}>
              <span>{s.label}</span>
              <strong>{latest?.title ?? 'Not yet published'}</strong>
              <small>{latest ? latest.body.slice(0, 95) + (latest.body.length > 95 ? '…' : '') : 'View school details'}</small>
            </button>
          })}
        </div>
        <div className={styles.latest}><h3>Latest updates</h3>
          {itemsFor('announcement').length === 0 ? <p className={styles.empty}>No public announcements yet.</p>
            : itemsFor('announcement').slice(0, 3).map(item => <article key={item.id} className={styles.post}>
              <div className={styles.meta}><span>{item.publisher_kind === 'hq' ? 'VibeSchool HQ' : 'School'}</span><time>{humanDate(item.published_at)}</time></div>
              <h4>{item.title}</h4><p>{item.body}</p>
            </article>)}
          {itemsFor('announcement').length > 3 && <button className={styles.textLink} type="button" onClick={() => setTab('updates')}>All updates</button>}
        </div>
      </> : <>
        <div className={styles.posts}>
          {displayed.length === 0 && <p className={styles.empty}>No {focused?.label.toLowerCase()} information has been published yet.</p>}
          {displayed.map(item => <article className={styles.post} key={item.id}>
            <div className={styles.meta}>
              <span>{item.publisher_kind === 'hq' ? 'VibeSchool HQ' : 'School'}</span>
              <span>{item.status === 'published' ? humanDate(item.published_at) : item.status === 'draft' ? 'Draft' : 'Withdrawn'}</span>
            </div>
            <h3>{item.title}</h3>
            {item.content_kind === 'fees' && <div className={styles.fee}>
              {item.amount_kes !== null && <strong>KSh {Number(item.amount_kes).toLocaleString('en-KE')}</strong>}
              {item.academic_year && <span>{item.academic_year} {item.term ?? ''}</span>}
            </div>}
            <p className={styles.body}>{item.body}</p>
            {item.source_note && item.status === 'published' && <small className={styles.source}>Source: {item.source_note}</small>}
            {isEditor && (role === 'hq' || item.publisher_kind === 'school') &&
              <button className={styles.textLink} onClick={() => startEdit(item)}>Edit</button>}
          </article>)}
        </div>
        {tab === 'fees' && <p className={styles.note}>Verify fee amounts and payment instructions directly with the school before paying.</p>}
      </>}
    {isEditor && formOpen && <form className={styles.form} onSubmit={(event: FormEvent) => { event.preventDefault(); void save('draft') }}>
      <div className={styles.formHeading}><h3>{edit ? 'Edit information' : 'Add school information'}</h3><button type="button" className={styles.textLink} onClick={() => setFormOpen(false)}>Close</button></div>
      {!edit && <label>Type<select value={kind} onChange={e => setKind(e.target.value as Kind)}>
        <option value="announcement">Announcement</option><option value="uniform">Uniform</option>
        <option value="fees">Fee item</option><option value="admissions">Admissions</option>
      </select></label>}
      <label>Title<input required minLength={3} maxLength={160} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="What should people know?"/></label>
      <label>Details<textarea required rows={4} minLength={10} maxLength={8000} value={form.body} onChange={e => setForm(v => ({ ...v, body: e.target.value }))} placeholder="Add confirmed school information"/></label>
      {kind === 'fees' && <div className={styles.fields}>
        <label>Year<input type="number" min="2020" max="2100" value={form.academic_year} onChange={e => setForm(v => ({ ...v, academic_year: e.target.value }))}/></label>
        <label>Period<select value={form.term} onChange={e => setForm(v => ({ ...v, term: e.target.value }))}>{['Term 1','Term 2','Term 3','Annual','One-off'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Amount (KSh)<input type="number" min="0" step="0.01" value={form.amount_kes} onChange={e => setForm(v => ({ ...v, amount_kes: e.target.value }))}/></label>
      </div>}
      <label>Source / evidence<input maxLength={600} value={form.source_note} onChange={e => setForm(v => ({ ...v, source_note: e.target.value }))} placeholder="School-approved notice or verified source"/></label>
      {kind === 'fees' && role === 'school' && <p className={styles.note}>Fee drafts require VibeSchool HQ verification before they become public.</p>}
      <div className={styles.actions}>
        <button disabled={busy} type="submit" className={styles.draft}>{busy ? 'Saving…' : 'Save draft'}</button>
        {publishingAllowed && <button disabled={busy} type="button" className={styles.publish} onClick={() => void save('published')}>Publish</button>}
        {edit && edit.status === 'published' && <button disabled={busy} type="button" className={styles.withdraw} onClick={() => void save('withdrawn')}>Withdraw</button>}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>}
  </section>
}
