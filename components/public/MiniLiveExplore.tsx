'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchMiniPage, fetchOwnMiniStatus, loadApprovedComments, loadMiniCovers,
  type MiniPost, type ApprovedComment } from '@/lib/minis/data'
import { rankMiniLessons } from '@/lib/minis/recommendation'
import { currentMiniUser, miniIsVerifiedAdult, changeMiniFollow, changeMiniInteraction, submitMini,
  addMiniComment, reportMini, recordMiniLearningSignal, publishMiniSafely } from '@/lib/minis/actions'
import { miniTagLabel, parseMiniHashtags } from '@/lib/minis/tags'
import { prepareMiniPhoto } from '@/lib/minis/photo'
import { MiniLiveRequests } from './MiniLiveRequests'
import type { MiniPublicRequest } from '@/lib/minis/requests'
import styles from './MiniExplore.module.css'

type Section = 'feed' | 'read' | 'compose' | 'creator' | 'mine' | 'profile' | 'request'
type Tab = 'For You' | 'Following' | 'New'
type Submission = { id: string; title: string; tags: string[]; status: string; created_at: string }

const ensureSignIn = (user: string | null) => {
  if (user) return true
  window.location.assign('/login?redirect=%2Fexplore')
  return false
}

function Cover({ url, subject, title }: { url?: string; subject: string; title: string }) {
  if (url) return <img className={styles.art} style={{ width: '100%', objectFit: 'cover' }} src={url}
    alt={'Cover photo for ' + title} loading="lazy" decoding="async"/>
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
  const [tag, setTag] = useState('All')
  const [query, setQuery] = useState('')
  const [nextOffset, setNextOffset] = useState<number|null>(null)
  const [pageBusy, setPageBusy] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const feedSequence = useRef(0)
  const feedReady = useRef(false)
  const [identityReady,setIdentityReady] = useState(false)
  const [feedIds,setFeedIds] = useState<string[]>([])
  const [knownTags,setKnownTags] = useState<string[]>([])
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
  const [answerRequest, setAnswerRequest] = useState<MiniPublicRequest | null>(null)
  const [createMenu, setCreateMenu] = useState(false)
  const [draftBody, setDraftBody] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview,setPhotoPreview] = useState('')
  const [photoRotation,setPhotoRotation] = useState(0)
  const [photoZoom,setPhotoZoom] = useState(1)
  const [quizEnabled, setQuizEnabled] = useState(false)
  const [quizQuestion, setQuizQuestion] = useState('')
  const [quizOptions, setQuizOptions] = useState(['','',''])
  const [quizCorrect, setQuizCorrect] = useState(0)
  const [quizExplanation, setQuizExplanation] = useState('')
  const [answers, setAnswers] = useState<Record<string,number>>({})
  const [profileName,setProfileName] = useState('')
  const [profileUsername,setProfileUsername] = useState('')

  useEffect(() => {
    if (!photo) { setPhotoPreview(''); return }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

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
    setAnswerRequest(null)
    setCreateMenu(false)
    setError('')
    window.history.replaceState(null, '', '/explore')
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const userId = await currentMiniUser()
        const adultEligible = userId ? await miniIsVerifiedAdult(userId) : false
        if (!mounted) return
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
          {
            const { data } = await supabase.from('mini_lessons')
              .select('id,creator_id,creator_label,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status,request_id,quality_score,like_count,save_count,learned_count,published_at,created_at')
              .eq('id',id).eq('status','approved').maybeSingle()
            if (data && mounted) {
              const newPost = data as MiniPost
              setPosts(existing => [...existing,newPost])
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
        if (mounted) {setIdentityReady(true);feedReady.current=true}
      }
    }
    void load()
    return () => { mounted = false }
  }, [open])

  const mergePage = useCallback((items: MiniPost[], append: boolean) => {
    setPosts(old => {
      const map = new Map(old.map(post=>[post.id,post]))
      for (const post of items) map.set(post.id,post)
      return [...map.values()]
    })
    setFeedIds(old=>[...new Set([...(append?old:[]),...items.map(post=>post.id)])])
    setKnownTags(old=>[...new Set([...old,...items.flatMap(post=>post.tags)])].slice(0,80))
  }, [])

  useEffect(()=>{
    if (!identityReady || section !== 'feed') return
    const sequence = ++feedSequence.current
    setLoading(true);setPageBusy(false);setFeedError('');setNextOffset(null)
    const timer = window.setTimeout(()=>{
      void fetchMiniPage({search:query,tag,creators:tab==='Following'?[...follows]:undefined})
        .then(page=>{
          if(sequence!==feedSequence.current)return
          mergePage(page.posts,false);setNextOffset(page.nextOffset)
          void loadMiniCovers(page.posts).then(urls=>{
            if(sequence===feedSequence.current)setCovers(old=>({...old,...urls}))
          }).catch(()=>{})
        })
        .catch(e=>{if(sequence===feedSequence.current){setFeedIds([]);setFeedError(e instanceof Error?e.message:'Unable to load feed.')}})
        .finally(()=>{if(sequence===feedSequence.current)setLoading(false)})
    },query.trim()?250:0)
    return ()=>{window.clearTimeout(timer);++feedSequence.current}
  },[identityReady,section,query,tag,tab,follows,refreshKey,mergePage])

  async function loadMore() {
    if(pageBusy||loading||nextOffset===null||!feedReady.current)return
    const sequence=feedSequence.current
    setPageBusy(true);setFeedError('')
    try {
      const page=await fetchMiniPage({search:query,tag,offset:nextOffset,creators:tab==='Following'?[...follows]:undefined})
      if(sequence!==feedSequence.current)return
      mergePage(page.posts,true);setNextOffset(page.nextOffset)
      const urls=await loadMiniCovers(page.posts)
      if(sequence===feedSequence.current)setCovers(old=>({...old,...urls}))
    }catch(e){if(sequence===feedSequence.current)setFeedError(e instanceof Error?e.message:'Unable to load more.')}
    finally{if(sequence===feedSequence.current)setPageBusy(false)}
  }

  const current = posts.find(post => post.id === selectedId)
  const creator = posts.find(post => post.creator_id === creatorId)
  const interests = useMemo(() => {
    if (!adult) return new Set<string>()
    return new Set(posts.filter(post => saves.has(post.id)).map(post => post.subject))
  }, [adult,posts,saves])
  const popularTags = useMemo(() => {
    const counts = new Map<string,number>()
    for (const post of posts) for (const item of post.tags) counts.set(item,(counts.get(item)??0)+1)
    return [...new Set([...(tag==='All'?[]:[tag]),...knownTags])].sort((a,b)=>a===tag?-1:b===tag?1:(counts.get(b)??0)-(counts.get(a)??0)).slice(0,16)
  }, [posts,knownTags,tag])
  const chooseTag = (name: string) => { setTag(name);setQuery('');setSection('feed');window.history.replaceState(null,'','/explore') }
  const visible = useMemo(() => {
    const ids=new Set(feedIds)
    const matches=posts.filter(post=>ids.has(post.id)&&!dismissed.has(post.id))
    return tab === 'New'
      ? [...matches].sort((a,b) => (b.published_at ?? '').localeCompare(a.published_at ?? '')||b.id.localeCompare(a.id))
      : rankMiniLessons(matches, { interests, following: adult ? follows : new Set<string>(), dismissed })
  }, [posts,feedIds,tab,interests,follows,dismissed,adult])

  async function interact(kind: 'like' | 'save', post?: MiniPost) {
    const target = post ?? current
    if (!target || !ensureSignIn(viewer) || !viewer || busy) return
    const oldSet = kind === 'like' ? likes : saves
    const setter = kind === 'like' ? setLikes : setSaves
    const adding = !oldSet.has(target.id)
    setBusy(true);setError('')
    try {
      await changeMiniInteraction(target.id,viewer,kind,adding)
      setter(old => {
        const next = new Set(old)
        if (adding) next.add(target.id)
        else next.delete(target.id)
        return next
      })
      setPosts(old => old.map(post => post.id === target.id ?
        { ...post, [kind === 'like' ? 'like_count' : 'save_count']:
            Math.max(0,(kind === 'like' ? post.like_count : post.save_count) + (adding ? 1 : -1)) }
        : post))
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to update Mini.')}
    finally {setBusy(false)}
  }

  async function follow(post?: MiniPost) {
    const target = post ?? current
    if (!target || !ensureSignIn(viewer) || !viewer || busy || target.creator_id===viewer) return
    const adding = !follows.has(target.creator_id)
    setBusy(true);setError('')
    try {
      await changeMiniFollow(target.creator_id,viewer,adding)
      setFollows(old => { const next = new Set(old); if(adding)next.add(target.creator_id);else next.delete(target.creator_id);return next })
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
      setNotice('Comment published after the automatic safety check.')
      setComments(await loadApprovedComments(current.id))
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to submit comment.')}
    finally {setBusy(false)}
  }

  async function sendReport() {
    if (!current || !ensureSignIn(viewer) || !viewer || busy) return
    setBusy(true);setError('')
    try {
      await reportMini(current.id,viewer,reportReason)
      setNotice('Report received. Multiple safety reports can automatically hide unsafe content.')
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

  const explainRequest = (request: MiniPublicRequest) => {
    if (!viewer || !adult) {
      setError('Verified adult creators may submit explanations. Sign in and verify your public profile first.')
      return
    }
    setAnswerRequest(request)
    setDraftTags(request.tags.map(name=>'#'+name).join(' '))
    setDraftTitle('')
    setDraftBody('')
    setPhoto(null)
    setSection('compose')
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ensureSignIn(viewer) || !viewer || busy) return
    if (!photo) {setError('Add a cover photo to publish a Mini Lesson.');return}
    setBusy(true);setError('');setNotice('')
    try {
      parseMiniHashtags(draftTags)
      const editedPhoto = await prepareMiniPhoto(photo,photoRotation,photoZoom)
      await submitMini({ title:draftTitle,body:draftBody,hashtags:draftTags,photo:editedPhoto,userId:viewer,
        challenge:quizEnabled ? { question:quizQuestion, options:quizOptions, correct:quizCorrect, explanation:quizExplanation } : null,
        requestId: answerRequest?.id ?? null })
      setDraftTitle('');setDraftBody('');setDraftTags('');setPhoto(null);setPhotoRotation(0);setPhotoZoom(1);setQuizEnabled(false);setQuizQuestion('');setQuizOptions(['','','']);setQuizCorrect(0);setQuizExplanation('')
      setNotice(answerRequest ? 'Your explanation is published on the request.' : 'Mini Lesson published.')
      back()
      setRefreshKey(key=>key+1)
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to submit Mini.')}
    finally {setBusy(false)}
  }

  async function retryPublication(id: string) {
    if (!viewer || busy) return
    setBusy(true);setError('');setNotice('')
    try {
      await publishMiniSafely('mini',id)
      setNotice('Mini Lesson published.')
      setRefreshKey(key=>key+1)
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to retry safety check.')}
    finally {
      try {setMine(await fetchOwnMiniStatus(viewer))}
      catch {setError(previous=>previous || 'Unable to refresh publication status.')}
      setBusy(false)
    }
  }

  async function openMine() {
    if (!ensureSignIn(viewer) || !viewer || busy) return
    setBusy(true);setError('')
    try {setMine(await fetchOwnMiniStatus(viewer));setSection('mine')}
    catch(e) {setError(e instanceof Error ? e.message : 'Unable to load submissions.')}
    finally {setBusy(false)}
  }

  async function editProfile() {
    if (!ensureSignIn(viewer) || !viewer || busy) return
    setError('');setNotice('')
    if (!adult) {
      setError('Public creator profiles currently require adult account verification. There is no HQ content approval.')
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
      setNotice('Your public profile is ready. Publish Mini Lessons through automatic safety checks.')
      setSection('compose')
    } catch {setError('Could not save your profile. Check whether that username is already taken.')}
    finally {setBusy(false)}
  }

  const card = (post: MiniPost) => <article key={post.id} className={styles.feedCard}>
    <div className={styles.feedCreator}>
      <button type="button" className={styles.linkButton} onClick={() => {setCreatorId(post.creator_id);setSection('creator')}}>
        <span className={styles.avatar} aria-hidden="true">{post.creator_label.charAt(0).toUpperCase()}</span>
        <span>@{post.creator_label}</span>
      </button>
      <button type="button" className={styles.smallButton} disabled={busy || post.creator_id===viewer}
        aria-pressed={follows.has(post.creator_id)} onClick={()=>void follow(post)}>
        {follows.has(post.creator_id)?'Following':'+ Follow'}
      </button>
    </div>
    <button type="button" className={styles.feedImage} onClick={()=>open(post)} aria-label={'Read '+post.title}>
      <Cover url={covers[post.id]} subject={post.subject} title={post.title}/>
    </button>
    <div className={styles.feedCaption}>
      <button type="button" className={styles.linkButton} onClick={()=>open(post)}><strong>{post.title}</strong></button>
      <p>{post.body.length>240?post.body.slice(0,240).trimEnd()+'…':post.body}</p>
      <div className={styles.tagRow}>{post.tags.map(name=><button type="button" key={name}
        className={styles.tagButton} onClick={()=>chooseTag(name)}>{miniTagLabel(name)}</button>)}</div>
      {post.quiz_question && <button type="button" className={styles.smallButton} onClick={()=>open(post)}>
        Try quick question ›
      </button>}
      <div className={styles.feedActions}>
        <button type="button" aria-pressed={likes.has(post.id)} disabled={busy} onClick={()=>void interact('like',post)}>
          {likes.has(post.id)?'♥ Liked':'♡ Like'} {post.like_count}</button>
        <button type="button" onClick={()=>open(post)}>◇ Comment</button>
        <button type="button" aria-pressed={saves.has(post.id)} disabled={busy} onClick={()=>void interact('save',post)}>
          {saves.has(post.id)?'▣ Saved':'▢ Save'}</button>
        <button type="button" onClick={()=>void (navigator.share
          ? navigator.share({title:post.title,url:window.location.origin+'/explore?mini='+encodeURIComponent(post.id)}).catch(()=>setNotice('Sharing cancelled.'))
          : navigator.clipboard.writeText(window.location.origin+'/explore?mini='+encodeURIComponent(post.id)).then(()=>setNotice('Link copied.')).catch(()=>setError('Unable to copy the link.')))}>↗ Share</button>
      </div>
    </div>
  </article>

  return <div className={styles.explorePage}><div className={styles.container}>
    {(error || notice) && <p role={error?'alert':'status'} className={styles.formNote}>{error || notice}</p>}
    {section === 'feed' && <>
      <div className={styles.exploreTop}>
        <div><h1 className={styles.exploreTitle}>Mini Lessons</h1></div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => void editProfile()}>My Profile</button>
          <button type="button" className={styles.secondary} onClick={() => void openMine()}>My Minis</button>
          <div className={styles.createWrap}>
            <button type="button" className={styles.primary} aria-expanded={createMenu} onClick={()=>setCreateMenu(v=>!v)}>+ Create</button>
            {createMenu&&<div className={styles.createMenu}>
              <button type="button" onClick={()=>{setAnswerRequest(null);setCreateMenu(false);setSection('compose')}}>Create Mini Lesson</button>
              <button type="button" onClick={()=>{setCreateMenu(false);setSection('request')}}>Request an explanation</button>
            </div>}
          </div>
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
        <div className={styles.filters} role="group" aria-label="Explore by hashtag">
          {['All',...popularTags].map(name=><button type="button" key={name}
            className={styles.pill+(tag===name?' '+styles.pillActive:'')} aria-pressed={tag===name}
            onClick={()=>chooseTag(name)}>{name==='All'?'All':miniTagLabel(name)}</button>)}
        </div>
      </div>
      {tab !== 'Following' && <MiniLiveRequests query={query} onExplain={explainRequest}/>}
      <div className={styles.resultsLabel}><strong>{tab==='Following'?'Creators you follow':'Mini Lessons'}</strong>
        <span>{visible.length} loaded</span></div>
      {feedError && <div role="alert" className={styles.formNote}>{feedError} <button type="button" onClick={()=>setRefreshKey(key=>key+1)}>Retry</button></div>}
      {loading ? <p role="status">Loading Mini Lessons…</p> : visible.length
        ? <div className={styles.grid}>{visible.map(card)}</div>
        : <div className={styles.empty}>
          <p>{error || (tab==='Following'?'Follow an educator to see their Minis here.':'No published Minis found.')}</p>
          <button type="button" className={styles.primary} onClick={()=>setSection('request')}>Request this topic</button>
          <button type="button" className={styles.secondary} onClick={()=>{setTag('All');setQuery('');setTab('For You')}}>Explore all</button>
        </div>}
      {!loading && nextOffset!==null && <button type="button" className={styles.loadMore} disabled={pageBusy} onClick={()=>void loadMore()}>{pageBusy?'Loading…':'Load more'}</button>}
    </>}

    {section === 'request' && <MiniLiveRequests mode="compose" query={query} onBack={back} onExplain={explainRequest}/>}
    {section === 'read' && current && <article className={styles.reader}>
      <div className={styles.readerHeader}><button className={styles.back} type="button" onClick={back}>← Explore</button></div>
      <Cover url={covers[current.id]} subject={current.subject} title={current.title}/>
      <div className={styles.readerBody}>
        <span className={styles.subject}>MINI LESSON</span>
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
        <div className={styles.tagRow}>{current.tags.map(name=><button key={name} type="button" className={styles.tagButton} onClick={()=>chooseTag(name)}>{miniTagLabel(name)}</button>)}</div>
        {current.quiz_question && <section className={styles.quiz}>
          <h2>Try a quick question</h2>
          <p>{current.quiz_question}</p>
          {current.quiz_options.map((option,index)=><button type="button" key={index}
            className={styles.choice+(answers[current.id]===index?' '+styles.selected:'')}
            aria-pressed={answers[current.id]===index}
            onClick={()=>setAnswers(previous=>({...previous,[current.id]:index}))}>
            {String.fromCharCode(65+index)}. {option}
          </button>)}
          {answers[current.id]!==undefined && <p role="status" className={styles.feedback}>
            {answers[current.id]===current.quiz_correct?'Correct! ':'Not quite. '}
            {current.quiz_explanation}
          </p>}
        </section>}
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
            <button type="submit" className={styles.primary} disabled={busy || !commentText.trim()}>Post comment</button>
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
      <span className={styles.eyebrow}>{answerRequest?'EXPLAIN STUDENT REQUEST':'CREATE MINI LESSON'}</span>
      {answerRequest&&<p className={styles.formNote}>{answerRequest.question}</p>}
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
        <label htmlFor="mini-tags" className={styles.label}>Hashtags</label>
        <input id="mini-tags" className={styles.field} required maxLength={180} value={draftTags}
          onChange={e=>setDraftTags(e.target.value)} placeholder="#Mathematics #Fractions (up to 5)"/>
        <p className={styles.previewNote}>Use 1–5 hashtags so people can discover your Mini Lesson.</p>
        <label htmlFor="mini-photo" className={styles.label}>Cover photo</label>
        <input type="file" id="mini-photo" required accept="image/jpeg,image/png,image/webp"
          onChange={e=>setPhoto(e.target.files?.[0]??null)}/>
        {photo && <div className={styles.photoEditor}>
          <div className={styles.photoCanvas}>
            {photoPreview && <img src={photoPreview} alt="Edited photo preview"
              style={{width:'100%',height:'100%',objectFit:'cover',transform:'rotate('+photoRotation+'deg) scale('+photoZoom+')'}}/>}
          </div>
          <p className={styles.previewNote}>{photo.name} · {(photo.size/1024/1024).toFixed(2)} MB · 4:3 crop</p>
          <div className={styles.photoTools}>
            <button type="button" className={styles.secondary} onClick={()=>setPhotoRotation(value=>(value+90)%360)}>↻ Rotate</button>
            <label htmlFor="mini-zoom">Zoom</label>
            <input id="mini-zoom" type="range" min="1" max="2" step="0.1" value={photoZoom}
              onChange={e=>setPhotoZoom(Number(e.target.value))}/>
            <button type="button" className={styles.secondary} onClick={()=>{setPhotoRotation(0);setPhotoZoom(1)}}>Reset</button>
          </div>
        </div>}
        <p className={styles.formNote}>Photos remain private until an automated safety check passes. There is no HQ publication approval.</p>
        <div style={{margin:'18px 0'}}>
          <label style={{display:'flex',gap:10,alignItems:'center',fontWeight:700,fontSize:14}}>
            <input type="checkbox" checked={quizEnabled} onChange={e=>setQuizEnabled(e.target.checked)} />
            Add a quick question (optional)
          </label>
          {quizEnabled && <div className={styles.quiz}>
            <label className={styles.label} htmlFor="mini-quiz">Question</label>
            <input id="mini-quiz" className={styles.field} required minLength={10} maxLength={240}
              value={quizQuestion} onChange={e=>setQuizQuestion(e.target.value)} placeholder="What did someone learn?"/>
            {quizOptions.map((option,index)=><div key={index}>
              <label className={styles.label} htmlFor={'mini-quiz-option-'+index}>Answer {String.fromCharCode(65+index)}</label>
              <input className={styles.field} id={'mini-quiz-option-'+index} required maxLength={180}
                value={option} onChange={e=>setQuizOptions(previous=>previous.map((item,i)=>i===index?e.target.value:item))}/>
            </div>)}
            <label className={styles.label} htmlFor="mini-correct">Correct answer</label>
            <select id="mini-correct" className={styles.field} value={quizCorrect}
              onChange={e=>setQuizCorrect(Number(e.target.value))}>
              {quizOptions.map((_,i)=><option value={i} key={i}>{String.fromCharCode(65+i)}</option>)}
            </select>
            <label className={styles.label} htmlFor="mini-explanation">Why this answer is correct</label>
            <textarea className={styles.field} id="mini-explanation" required minLength={10} maxLength={500}
              value={quizExplanation} onChange={e=>setQuizExplanation(e.target.value)} rows={3}/>
          </div>}
        </div>
        <button type="submit" className={styles.primary} disabled={!viewer || busy || !draftTitle.trim() || !draftBody.trim() || !photo}>
          {busy?'Checking safety…':'Publish Mini Lesson'}</button>
      </form>
    </section>}

    {section === 'mine' && <section className={styles.profile}>
      <button type="button" className={styles.back} onClick={back}>← Explore</button>
      <h1>My Mini Lessons</h1>
      <p className={styles.subline}>View your Mini Lessons and their automatic safety status.</p>
      {mine.length ? mine.map(p=><div key={p.id} className={styles.comment}><strong>{p.title}</strong>
        {p.tags.map(miniTagLabel).join(' ')} · {p.status==='approved'?'Published':p.status==='pending'?'Safety check pending':p.status}
        {p.status==='pending' && <button type="button" className={styles.secondary} disabled={busy} onClick={()=>void retryPublication(p.id)}>Retry safety check</button>}</div>)
        : <p>No Mini Lessons submitted yet.</p>}
    </section>}

    {section === 'profile' && <section className={styles.profile}>
      <button type="button" className={styles.back} onClick={back}>← Explore</button>
      <h1>My VibeSchool public profile</h1>
      <p className={styles.subline}>Your existing account and username appear on published Minis. Public creator age safeguards remain separate from content moderation.</p>
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
  </div></div>
}
