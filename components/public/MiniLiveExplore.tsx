'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MINI_SUBJECTS, fetchApprovedMinis, fetchOwnMiniStatus, loadApprovedComments, loadMiniCovers,
  type MiniPost, type ApprovedComment } from '@/lib/minis/data'
import { rankMiniLessons } from '@/lib/minis/recommendation'
import { currentMiniUser, miniIsVerifiedAdult, changeMiniFollow, changeMiniInteraction, submitMini,
  addMiniComment, reportMini, recordMiniLearningSignal } from '@/lib/minis/actions'
import styles from './MiniExplore.module.css'

type Section = 'feed' | 'read' | 'compose' | 'creator' | 'mine' | 'profile'
type Tab = 'For You' | 'Following' | 'New'
type Submission = { id: string; title: string; subject: string; status: string; created_at: string }

const ensureSignIn = (user: string | null) => {
  if (user) return true
  window.location.assign('/login?redirect=%2Fexplore')
  return false
}

function Cover({ url, subject, title }: { url?: string; subject: string; title: string }) {
  if (url) return <img className={styles.art} style={{ width: '100%', objectFit: 'cover' }} src={url}
    alt={'Cover photo for ' + title}/>
  return <div className={styles.art + ' ' + styles.literatureArt} role="img" aria-label={subject + ' Mini Lesson'}>
    <span style={{ fontSize: 54, color: '#5a4730' }} aria-hidden="true">✦</span>
  </div>
}

export function MiniLiveExplore() {
  const [posts, setPosts] = useState<MiniPost[]>([])
  const [covers, setCovers] = useState<Record<string,string>>({})
  const [viewer, setViewer] = useState<string | null>(null)
  const [adult, setAdult] = useState(false)
  const [likes, setLikes] = useState<Set<string>>(new Set())
  const [saves, setSaves] = useState<Set<string>>(new Set())
  const [follows, setFollows] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [section, setSection] = useState<Section>('feed')
  const [tab, setTab] = useState<Tab>('For You')
  const [subject, setSubject] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatorId, setCreatorId] = useState<string | null>(null)
  const [comments, setComments] = useState<ApprovedComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [reportReason, setReportReason] = useState('incorrect')
  const [mine, setMine] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftSubject, setDraftSubject] = useState<string>(MINI_SUBJECTS[0])
  const [photo, setPhoto] = useState<File | null>(null)
  const [profileName,setProfileName] = useState('')
  const [profileUsername,setProfileUsername] = useState('')

  const open = useCallback((post: MiniPost) => {
    setSelectedId(post.id)
    setComments([])
    setCommentText('')
    setSection('read')
    setError('')
    window.history.replaceState(null, '', '/explore?mini=' + encodeURIComponent(post.id))
    void loadApprovedComments(post.id).then(setComments).catch(() => setComments([]))
  }, [])

  const back = () => {
    setSection('feed')
    setCreatorId(null)
    setSelectedId(null)
    setError('')
    window.history.replaceState(null, '', '/explore')
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [list, userId] = await Promise.all([fetchApprovedMinis(120), currentMiniUser()])
        const [signed, adultEligible] = await Promise.all([
          loadMiniCovers(list),
          userId ? miniIsVerifiedAdult(userId) : Promise.resolve(false),
        ])
        if (!mounted) return
        setPosts(list)
        setCovers(signed)
        setViewer(userId)
        setAdult(adultEligible)
        if (userId) {
          const [interactions, following, learning] = await Promise.all([
            supabase.from('mini_interactions').select('mini_id,kind').eq('user_id',userId).limit(1000),
            supabase.from('global_profile_follows').select('followed_id').eq('follower_id',userId).limit(1000),
            adultEligible
              ? supabase.from('mini_learning_signals').select('mini_id,signal').eq('user_id',userId).limit(1000)
              : Promise.resolve({ data: [] }),
          ])
          if (!mounted) return
          setLikes(new Set((interactions.data ?? []).filter((row: {kind:string}) => row.kind === 'like').map((row: {mini_id:string}) => row.mini_id)))
          setSaves(new Set((interactions.data ?? []).filter((row: {kind:string}) => row.kind === 'save').map((row: {mini_id:string}) => row.mini_id)))
          setFollows(new Set((following.data ?? []).map((row: {followed_id:string}) => row.followed_id)))
          setDismissed(new Set((learning.data ?? []).filter((row: {signal:string}) => row.signal === 'not_interested').map((row: {mini_id:string}) => row.mini_id)))
        }
        const id = new URLSearchParams(window.location.search).get('mini')
        if (id) {
          const item = list.find(post => post.id === id)
          if (item) open(item)
          else {
            const { data } = await supabase.from('mini_lessons')
              .select('id,creator_id,creator_label,title,body,subject,cover_path,status,quality_score,like_count,save_count,learned_count,published_at,created_at')
              .eq('id',id).eq('status','approved').maybeSingle()
            if (data && mounted) {
              const newPost = data as MiniPost
              setPosts(existing => [...existing,newPost])
              setCovers(existing => existing)
              void loadMiniCovers([newPost]).then(extra => {
                if (mounted) setCovers(existing => ({ ...existing, ...extra }))
              })
              open(newPost)
            }
          }
        }
      } catch {
        if (mounted) setError('Unable to load Mini Lessons. The service may not be enabled yet.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [open])

  const current = posts.find(post => post.id === selectedId)
  const creator = posts.find(post => post.creator_id === creatorId)
  const interests = useMemo(() => {
    if (!adult) return new Set<string>()
    return new Set(posts.filter(post => saves.has(post.id)).map(post => post.subject))
  }, [adult,posts,saves])
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const matches = posts.filter(post =>
      (subject === 'All' || post.subject === subject) &&
      (tab !== 'Following' || follows.has(post.creator_id)) &&
      !dismissed.has(post.id) &&
      (!q || (post.title + ' ' + post.body + ' ' + post.subject + ' ' + post.creator_label).toLocaleLowerCase().includes(q))
    )
    return tab === 'New'
      ? [...matches].sort((a,b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
      : rankMiniLessons(matches, { interests, following: adult ? follows : new Set<string>(), dismissed })
  }, [posts,tab,subject,query,interests,follows,dismissed])

  async function interact(kind: 'like' | 'save') {
    if (!current || !ensureSignIn(viewer) || !viewer || busy) return
    const oldSet = kind === 'like' ? likes : saves
    const setter = kind === 'like' ? setLikes : setSaves
    const adding = !oldSet.has(current.id)
    setBusy(true);setError('')
    try {
      await changeMiniInteraction(current.id,viewer,kind,adding)
      setter(old => {
        const next = new Set(old)
        if (adding) next.add(current.id)
        else next.delete(current.id)
        return next
      })
      setPosts(old => old.map(post => post.id === current.id ?
        { ...post, [kind === 'like' ? 'like_count' : 'save_count']:
            Math.max(0,(kind === 'like' ? post.like_count : post.save_count) + (adding ? 1 : -1)) }
        : post))
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to update Mini.')}
    finally {setBusy(false)}
  }

  async function follow() {
    if (!current || !ensureSignIn(viewer) || !viewer || busy) return
    const adding = !follows.has(current.creator_id)
    setBusy(true);setError('')
    try {
      await changeMiniFollow(current.creator_id,viewer,adding)
      setFollows(old => { const next = new Set(old); if(adding)next.add(current.creator_id);else next.delete(current.creator_id);return next })
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to follow.')}
    finally {setBusy(false)}
  }

  async function sendComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!current || !ensureSignIn(viewer) || !viewer || busy) return
    setBusy(true);setError('')
    try {
      await addMiniComment(current.id,viewer,commentText)
      setCommentText('')
      setNotice('Your comment was submitted for moderation. It is not public yet.')
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to submit comment.')}
    finally {setBusy(false)}
  }

  async function sendReport() {
    if (!current || !ensureSignIn(viewer) || !viewer || busy) return
    setBusy(true);setError('')
    try {
      await reportMini(current.id,viewer,reportReason)
      setNotice('Report submitted for review.')
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to submit report.')}
    finally {setBusy(false)}
  }

  async function learning(signal: 'understood' | 'not_interested') {
    if (!current || !ensureSignIn(viewer) || !viewer || busy || !adult) return
    setBusy(true);setError('')
    try {
      await recordMiniLearningSignal(current,viewer,signal)
      if (signal === 'not_interested') {
        setDismissed(old => new Set([...old,current.id]))
        back()
      } else setNotice('Understanding recorded. You can keep learning.')
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to save feedback.')}
    finally {setBusy(false)}
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ensureSignIn(viewer) || !viewer || busy) return
    if (!photo) {setError('Add a cover photo to publish a Mini Lesson.');return}
    setBusy(true);setError('');setNotice('')
    try {
      await submitMini({ title:draftTitle,body:draftBody,subject:draftSubject,photo,userId:viewer })
      setDraftTitle('');setDraftBody('');setPhoto(null)
      setNotice('Mini submitted! It will appear in Explore only after moderation.')
      back()
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to submit Mini.')}
    finally {setBusy(false)}
  }

  async function openMine() {
    if (!ensureSignIn(viewer) || busy) return
    setBusy(true);setError('')
    try {setMine(await fetchOwnMiniStatus(viewer));setSection('mine')}
    catch(e) {setError(e instanceof Error ? e.message : 'Unable to load submissions.')}
    finally {setBusy(false)}
  }

  async function editProfile() {
    if (!ensureSignIn(viewer) || !viewer || busy) return
    setError('');setNotice('')
    if (!adult) {
      setError('Public creator profiles require an adult account with a verified date of birth.')
      return
    }
    setBusy(true)
    try {
      const {data,error:readError} = await supabase.from('global_public_profiles')
        .select('username,display_name').eq('profile_id',viewer).maybeSingle()
      if (readError) throw readError
      setProfileName(data?.display_name ?? '')
      setProfileUsername(data?.username ?? '')
      setSection('profile')
    } catch {setError('Unable to load your VibeSchool public profile.')}
    finally {setBusy(false)}
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!viewer || !adult || busy) return
    const username = profileUsername.trim().toLowerCase().replace(/^@/,'')
    const displayName = profileName.trim()
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(username) ||
        displayName.length < 2 || displayName.length > 80) {
      setError('Choose a 3–24-character username beginning with a letter, and a public name of 2–80 characters.')
      return
    }
    setBusy(true);setError('');setNotice('')
    try {
      const {error:saveError} = await supabase.from('global_public_profiles')
        .upsert({profile_id:viewer,username,display_name:displayName,is_public:true},{onConflict:'profile_id'})
      if (saveError) throw saveError
      setNotice('Your existing VibeSchool profile is now public. You can submit Mini Lessons for review.')
      setSection('compose')
    } catch {setError('Could not save your profile. Check whether that username is already taken.')}
    finally {setBusy(false)}
  }

  const card = (post: MiniPost) => <button type="button" key={post.id} className={styles.miniCard}
    onClick={() => open(post)} style={{ textAlign: 'left' }}>
    <Cover url={covers[post.id]} subject={post.subject} title={post.title}/>
    <span className={styles.miniCardBody} style={{ display:'block' }}>
      <span className={styles.subject}>{post.subject} · Mini Lesson</span>
      <h3>{post.title}</h3>
      <p>{post.body.slice(0,130)}{post.body.length>130?'…':''}</p>
      <span className={styles.creatorLine}>@{post.creator_label} · Read Mini ↗</span>
    </span>
  </button>

  return <div className={styles.explorePage}><div className={styles.container}>
    {section === 'feed' && <>
      <div className={styles.exploreTop}>
        <div><span className={styles.eyebrow}>VIBESCHOOL MINI LESSONS</span>
          <h1 className={styles.exploreTitle}>Explore</h1>
          <p className={styles.subline}>Discover short, useful explanations shared by educators.</p></div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => void editProfile()}>My Profile</button>
          <button type="button" className={styles.secondary} onClick={() => void openMine()}>My Minis</button>
          <button type="button" className={styles.primary} onClick={() => {setError('');setSection('compose')}}>+ Create Mini</button>
        </div>
      </div>
      <div className={styles.controls}>
        <label className={styles.search}><span aria-hidden="true">⌕</span><span className="sr-only">Search Mini Lessons</span>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a Mini, topic or educator"/>
        </label>
        <div className={styles.tabs} role="group" aria-label="Choose Explore feed">
          {(['For You','Following','New'] as const).map(t=><button type="button" key={t}
            className={styles.tab + (tab===t?' '+styles.tabActive:'')} aria-pressed={tab===t}
            onClick={()=>setTab(t)}>{t}</button>)}
        </div>
        <div className={styles.filters} role="group" aria-label="Filter by subject">
          {['All',...MINI_SUBJECTS].map(s=><button type="button" key={s}
            className={styles.pill+(subject===s?' '+styles.pillActive:'')} aria-pressed={subject===s}
            onClick={()=>setSubject(s)}>{s}</button>)}
        </div>
      </div>
      <div className={styles.resultsLabel}><strong>{tab==='Following'?'Creators you follow':'Mini Lessons'}</strong>
        <span>{visible.length} results</span></div>
      {loading ? <p role="status">Loading Mini Lessons…</p> : visible.length
        ? <div className={styles.grid}>{visible.map(card)}</div>
        : <div className={styles.empty}>
          <p>{error || (tab==='Following'?'Follow an educator to see their Minis here.':'No published Minis found.')}</p>
          <button type="button" className={styles.secondary} onClick={()=>{setSubject('All');setQuery('');setTab('For You')}}>Explore all</button>
        </div>}
      <p className={styles.previewNote}>Recommendations prioritize educational usefulness and give new creators a fair chance. No watch-time targeting.</p>
    </>}

    {section === 'read' && current && <article className={styles.reader}>
      <div className={styles.readerHeader}><button className={styles.back} type="button" onClick={back}>← Explore</button></div>
      <Cover url={covers[current.id]} subject={current.subject} title={current.title}/>
      <div className={styles.readerBody}>
        <span className={styles.subject}>MINI LESSON · {current.subject}</span>
        <h1 className={styles.readerTitle}>{current.title}</h1>
        <div className={styles.creatorRow}>
          <div className={styles.creatorLeft}>
            <span className={styles.avatar} aria-hidden="true">{current.creator_label.slice(0,1).toUpperCase()}</span>
            <div><button type="button" className={styles.linkButton} onClick={() => {
                setCreatorId(current.creator_id);setSection('creator')
              }}>@{current.creator_label}</button><p className={styles.previewNote}>VibeSchool creator · View Minis</p></div>
          </div>
          <button type="button" className={styles.smallButton} disabled={busy || current.creator_id===viewer}
            aria-pressed={follows.has(current.creator_id)} onClick={()=>void follow()}>
            {follows.has(current.creator_id)?'Following':'+ Follow'}</button>
        </div>
        {current.body.split(/\n\s*\n/).map((paragraph,index)=><p key={index} className={styles.paragraph}>{paragraph}</p>)}
        <div className={styles.actions}>
          <button type="button" aria-pressed={likes.has(current.id)} disabled={busy} onClick={()=>void interact('like')}>
            {likes.has(current.id)?'♥ Liked':'♡ Like'} ({current.like_count})</button>
          <button type="button" aria-pressed={saves.has(current.id)} disabled={busy} onClick={()=>void interact('save')}>
            {saves.has(current.id)?'▣ Saved':'▢ Save'}</button>
          <button type="button" onClick={()=>document.getElementById('mini-discussion')?.scrollIntoView({behavior:'smooth'})}>Comments</button>
          <button type="button" onClick={()=>void (navigator.share
            ? navigator.share({title:current.title,url:window.location.href}).catch(()=>{})
            : navigator.clipboard?.writeText(window.location.href).catch(()=>{}))}>↗ Share</button>
        </div>
        {adult && <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={()=>void learning('understood')}>I understood this</button>
          <button type="button" disabled={busy} onClick={()=>void learning('not_interested')}>Not interested</button>
        </div>}
        <section className={styles.comments} id="mini-discussion">
          <h2>Discussion</h2>
          <p className={styles.subline}>Comments appear only after moderation. Learner identities remain private.</p>
          {comments.map(comment=><div key={comment.id} className={styles.comment}>
            <strong>{comment.author_label}</strong>{comment.body}</div>)}
          <form className={styles.commentEntry} onSubmit={event=>void sendComment(event)}>
            <label htmlFor="mini-comment" className={styles.label}>Ask a question or share an idea</label>
            <textarea id="mini-comment" className={styles.field} maxLength={500} rows={3}
              value={commentText} onChange={e=>setCommentText(e.target.value)}/>
            <button type="submit" className={styles.primary} disabled={busy || !commentText.trim()}>Submit comment for review</button>
          </form>
          <div className={styles.actions} style={{ justifyContent:'flex-start' }}>
            <label htmlFor="mini-report" className={styles.label}>Report content</label>
            <select id="mini-report" className={styles.field} style={{width:170}} value={reportReason}
              onChange={e=>setReportReason(e.target.value)}>
              <option value="incorrect">Incorrect</option><option value="unsafe">Unsafe</option>
              <option value="spam">Spam</option><option value="copyright">Copyright</option><option value="other">Other</option>
            </select>
            <button type="button" disabled={busy} className={styles.secondary} onClick={()=>void sendReport()}>Report</button>
          </div>
        </section>
      </div>
    </article>}

    {section === 'compose' && <section className={styles.form}>
      <button className={styles.back} type="button" onClick={back}>← Explore</button>
      <span className={styles.eyebrow}>CREATE MINI LESSON</span>
      <h1>Share what you know.</h1>
      <p className={styles.subline}>One photo and a short educational explanation.</p>
      {!viewer && <p className={styles.formNote}>Sign in before publishing. <Link href="/login?redirect=%2Fexplore">Sign in</Link></p>}
      {viewer && <p className={styles.formNote}>Minis use your existing VibeSchool public username. <button type="button" className={styles.linkButton} onClick={() => void editProfile()}>Set up your creator profile</button>.</p>}
      <form onSubmit={event=>void publish(event)}>
        <label htmlFor="mini-title" className={styles.label}>Title</label>
        <input id="mini-title" required maxLength={100} minLength={5} className={styles.field}
          value={draftTitle} onChange={e=>setDraftTitle(e.target.value)} placeholder="What can someone learn?"/>
        <label htmlFor="mini-body" className={styles.label}>Explanation</label>
        <textarea id="mini-body" required minLength={40} maxLength={3000} className={styles.editor}
          value={draftBody} onChange={e=>setDraftBody(e.target.value)} placeholder="Explain one useful thing clearly…"/>
        <label htmlFor="mini-subject" className={styles.label}>Subject</label>
        <select id="mini-subject" className={styles.field} value={draftSubject} onChange={e=>setDraftSubject(e.target.value)}>
          {MINI_SUBJECTS.map(s=><option key={s}>{s}</option>)}
        </select>
        <label htmlFor="mini-photo" className={styles.label}>Cover photo</label>
        <input type="file" id="mini-photo" required accept="image/jpeg,image/png,image/webp"
          onChange={e=>setPhoto(e.target.files?.[0]??null)}/>
        {photo && <p className={styles.previewNote}>{photo.name} · {(photo.size/1024/1024).toFixed(2)} MB</p>}
        <p className={styles.formNote}>Photos stay private while the Mini is pending. Submission does not make it public.</p>
        <button type="submit" className={styles.primary} disabled={!viewer || busy || !draftTitle.trim() || !draftBody.trim() || !photo}>
          {busy?'Submitting…':'Submit Mini for review'}</button>
      </form>
    </section>}

    {section === 'mine' && <section className={styles.profile}>
      <button type="button" className={styles.back} onClick={back}>← Explore</button>
      <h1>My Mini Lessons</h1>
      <p className={styles.subline}>Check whether your submitted Minis are pending or approved.</p>
      {mine.length ? mine.map(p=><div key={p.id} className={styles.comment}><strong>{p.title}</strong>
        {p.subject} · {p.status==='approved'?'Published':p.status==='pending'?'Awaiting review':p.status}</div>)
        : <p>No Mini Lessons submitted yet.</p>}
    </section>}

    {section === 'profile' && <section className={styles.profile}>
      <button type="button" className={styles.back} onClick={back}>← Explore</button>
      <h1>My VibeSchool public profile</h1>
      <p className={styles.subline}>Your existing account and username will appear on published Minis. Only eligible adults can make a creator profile public.</p>
      <form onSubmit={event => void saveProfile(event)}>
        <label className={styles.label} htmlFor="mini-profile-username">Username</label>
        <input className={styles.field} id="mini-profile-username" autoComplete="off"
          value={profileUsername} maxLength={24} required
          onChange={event => setProfileUsername(event.target.value)} placeholder="your_username" />
        <label className={styles.label} htmlFor="mini-profile-name">Public display name</label>
        <input className={styles.field} id="mini-profile-name" value={profileName}
          required maxLength={80} onChange={event => setProfileName(event.target.value)}
          placeholder="How people should know you" />
        <p className={styles.formNote}>Publishing this profile makes your username and display name public. You can still submit a Mini only after account and ownership checks.</p>
        <button type="submit" className={styles.primary} disabled={busy || !adult}>Save public profile</button>
      </form>
    </section>}

    {section === 'creator' && creator && <section className={styles.profile}>
      <button type="button" className={styles.back} onClick={back}>← Explore</button>
      <h1>@{creator.creator_label}</h1>
      <div className={styles.grid}>{posts.filter(post=>post.creator_id===creatorId).map(card)}</div>
    </section>}
    {(error || notice) && <p role={error?'alert':'status'} className={styles.formNote}>{error || notice}</p>}
    <div style={{textAlign:'center',marginTop:26}}><Link href="/" className={styles.sectionLink}>VibeSchool Home</Link></div>
  </div></div>
}
