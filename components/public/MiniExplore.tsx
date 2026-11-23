'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { MINI_EXAMPLES, type MiniExample } from '@/lib/public/mini-examples'
import { MiniArtwork } from './MiniArtwork'
import styles from './MiniExplore.module.css'

type View = 'feed' | 'read' | 'creator' | 'compose' | 'request-compose' | 'request-detail'
type FeedTab = 'For You' | 'Following' | 'New'
type LocalComment = { name: string; text: string }
type RequestReply = { id: string; title: string; explanation: string; photo: string }
type MiniRequest = { id: string; question: string; tags: string[]; supporters: number; replies: RequestReply[] }

const EXAMPLE_REQUESTS: MiniRequest[] = [
  { id: 'example-algebra-request', question: 'Can someone explain simultaneous equations step by step?',
    tags: ['mathematics','grade9','algebra'], supporters: 18, replies: [] },
]

function parseRequestTags(input: string): string[] {
  const words = input.trim().split(/[\s,]+/).filter(Boolean)
  if (words.length < 1 || words.length > 5) throw new Error('Add 1–5 hashtags.')
  const tags = words.map(word => word.replace(/^#/, '').toLowerCase())
  if (tags.some(tag => !/^[a-z][a-z0-9_]{1,29}$/.test(tag))) {
    throw new Error('Use hashtags with 2–30 letters, numbers or underscores.')
  }
  return [...new Set(tags)]
}


export function MiniExplore() {
  const [view, setView] = useState<View>('feed')
  const [selected, setSelected] = useState<string | null>(null)
  const [creator, setCreator] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('All')
  const [tab, setTab] = useState<FeedTab>('For You')
  const [liked, setLiked] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [followed, setFollowed] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<Record<string, LocalComment[]>>({})
  const [draftComment, setDraftComment] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [draftFile, setDraftFile] = useState('')
  const [draftImage, setDraftImage] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [requests, setRequests] = useState<MiniRequest[]>(EXAMPLE_REQUESTS)
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [supportedRequests, setSupportedRequests] = useState<string[]>([])
  const [requestQuestion, setRequestQuestion] = useState('')
  const [requestTags, setRequestTags] = useState('')
  const [requestFeedback, setRequestFeedback] = useState('')
  const [respondingTo, setRespondingTo] = useState<string | null>(null)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('mini')
    const requestId = new URLSearchParams(window.location.search).get('request')
    if (requestId && EXAMPLE_REQUESTS.some(request => request.id === requestId)) {
      setSelectedRequest(requestId)
      setView('request-detail')
    }
    if (id && MINI_EXAMPLES.some(mini => mini.id === id)) {
      setSelected(id)
      setView('read')
    }
  }, [])

  const popularTags = Array.from(new Set([...MINI_EXAMPLES.flatMap(mini => mini.tags), ...requests.flatMap(request => request.tags)]))
  const selectTag = (value: string) => { setTag(value); setView('feed'); window.history.replaceState(null,'','/explore') }
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    const results = MINI_EXAMPLES.filter(mini =>
      (tag === 'All' || mini.tags.includes(tag)) &&
      (tab !== 'Following' || followed.includes(mini.creator)) &&
      (!search || [mini.title, ...mini.tags, mini.summary, mini.creator].join(' ').toLocaleLowerCase().includes(search))
    )
    return tab === 'New' ? [...results].reverse() : results
  }, [query, tag, tab, followed])

  const visibleRequests = requests.filter(request =>
    tab !== 'Following' &&
    (tag === 'All' || request.tags.includes(tag)) &&
    (!query.trim() || [request.question, ...request.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  )
  const request = requests.find(item => item.id === selectedRequest)
  const current = MINI_EXAMPLES.find(mini => mini.id === selected)
  const toggle = (values: string[], set: (next: string[]) => void, key: string) =>
    set(values.includes(key) ? values.filter(value => value !== key) : [...values, key])

  const read = (mini: MiniExample) => {
    setSelected(mini.id)
    setDraftComment('')
    setView('read')
    window.history.replaceState(null, '', '/explore?mini=' + encodeURIComponent(mini.id))
  }
  const back = () => {
    setView('feed')
    setSelected(null)
    setCreator('')
    setSelectedRequest(null)
    setRespondingTo(null)
    setCreateMenuOpen(false)
    window.history.replaceState(null, '', '/explore')
  }
  const openCreator = (name: string) => {
    setCreator(name)
    setView('creator')
  }
  const openRequest = (id: string) => {
    setSelectedRequest(id)
    setView('request-detail')
    window.history.replaceState(null, '', '/explore?request=' + encodeURIComponent(id))
  }
  const toggleSupport = (id: string) => toggle(supportedRequests, setSupportedRequests, id)
  const createRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const question = requestQuestion.trim()
    if (question.length < 12 || question.length > 240) {
      setRequestFeedback('Write a clear question between 12 and 240 characters.')
      return
    }
    try {
      const tags = parseRequestTags(requestTags)
      const id = 'local-request-' + Date.now().toString(36)
      setRequests(existing => [{ id, question, tags, supporters: 1, replies: [] }, ...existing])
      setRequestQuestion('')
      setRequestTags('')
      setRequestFeedback('Request added to this preview only. It has not been submitted publicly.')
      setView('feed')
    } catch (error) {
      setRequestFeedback(error instanceof Error ? error.message : 'Check your request.')
    }
  }
  const explainRequest = (id: string) => {
    const target = requests.find(item => item.id === id)
    if (!target) return
    setRespondingTo(id)
    setDraftTitle('')
    setDraftBody('')
    setDraftTags(target.tags.map(tag => '#' + tag).join(' '))
    setDraftFile('')
    setDraftImage(null)
    setPreview(false)
    setView('compose')
  }
  const addPreviewExplanation = () => {
    if (!respondingTo || !draftTitle.trim() || !draftBody.trim() || !draftImage) return
    const id = respondingTo
    setRequests(existing => existing.map(item => item.id === id ?
      { ...item, replies: [...item.replies, {
        id: 'local-answer-' + Date.now().toString(36),
        title: draftTitle.trim(), explanation: draftBody.trim(), photo: draftImage,
      }] } : item))
    setDraftTitle('')
    setDraftBody('')
    setDraftFile('')
    setDraftImage(null)
    setRespondingTo(null)
    setRequestFeedback('Explanation added to the local preview only. Publishing remains inactive.')
    openRequest(id)
  }
  const addComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!current || !draftComment.trim()) return
    const next = { name: 'You · local preview', text: draftComment.trim() }
    setComments(existing => ({ ...existing, [current.id]: [...(existing[current.id] || []), next] }))
    setDraftComment('')
  }
  const attach = (file?: File) => {
    if (!file) return
    const image = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (file.size > 5 * 1024 * 1024 || !image) {
      setDraftFile('Choose a JPG, PNG or WebP photo under 5 MB.')
      setDraftImage(null)
      return
    }
    setDraftFile(file.name)
    if (image) {
      const reader = new FileReader()
      reader.onload = () => setDraftImage(typeof reader.result === 'string' ? reader.result : null)
      reader.readAsDataURL(file)
    } else {
      setDraftImage(null)
    }
  }

  return <div className={styles.explorePage}>
    <div className={styles.container}>
      {view === 'feed' && <>
        <div className={styles.exploreTop}>
          <div>
            <span className={styles.eyebrow}>VIBESCHOOL MINI LESSONS</span>
            <h1 className={styles.exploreTitle}>Mini Lessons</h1>
          </div>
          <div className={styles.createWrap}>
            <button type="button" className={styles.primary} aria-expanded={createMenuOpen} aria-controls="mini-create-menu"
              onClick={() => setCreateMenuOpen(open => !open)}>+ Create</button>
            {createMenuOpen && <div className={styles.createMenu} id="mini-create-menu">
              <button type="button" onClick={() => { setRespondingTo(null); setCreateMenuOpen(false); setView('compose') }}>Create Mini Lesson</button>
              <button type="button" onClick={() => { setCreateMenuOpen(false); setRequestFeedback(''); setView('request-compose') }}>Request an explanation</button>
            </div>}
          </div>
        </div>
        <div className={styles.controls}>
          <label className={styles.search}>
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search Minis, subjects or educators</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a topic, subject or teacher" />
            {query && <button type="button" className={styles.linkButton} onClick={() => setQuery('')} aria-label="Clear search">×</button>}
          </label>
          <div className={styles.tabs} role="group" aria-label="Explore feed">
            {(['For You', 'Following', 'New'] as FeedTab[]).map(value =>
              <button key={value} type="button" className={styles.tab + (tab === value ? ' ' + styles.tabActive : '')}
                aria-pressed={tab === value} onClick={() => setTab(value)}>{value}</button>
            )}
          </div>
          <div className={styles.filters} role="group" aria-label="Explore by hashtag">
            {['All', ...popularTags].map(value =>
              <button key={value} type="button" className={styles.pill + (tag === value ? ' ' + styles.pillActive : '')}
                aria-pressed={tag === value} onClick={() => setTag(value)}>{value === 'All' ? 'All' : '#'+value}</button>
            )}
          </div>
        </div>
        <div className={styles.resultsLabel}>
          <strong>{tab === 'Following' ? 'From creators you follow' : 'Mini Lessons'}</strong>
          <span>{filtered.length} Mini examples · {visibleRequests.length} request previews</span>
        </div>
        {requestFeedback && <p className={styles.previewNote} role="status">{requestFeedback}</p>}
        {(filtered.length > 0 || visibleRequests.length > 0) ? <div className={styles.grid}>
          {visibleRequests.map(item => <article key={item.id} className={styles.requestCard}>
            <div className={styles.requestEyebrow}>Student request · illustrative preview</div>
            <button type="button" className={styles.requestTitle} onClick={() => openRequest(item.id)}>{item.question}</button>
            <div className={styles.tagRow}>{item.tags.map(name => <button key={name} type="button"
              className={styles.tagButton} onClick={() => selectTag(name)}>{'#' + name}</button>)}</div>
            <div className={styles.requestMeta}>{item.supporters + (supportedRequests.includes(item.id) ? 1 : 0)} interested · {item.replies.length} explanations</div>
            <div className={styles.requestActions}>
              <button type="button" aria-pressed={supportedRequests.includes(item.id)} onClick={() => toggleSupport(item.id)}>
                {supportedRequests.includes(item.id) ? '✓ Me too' : '+ Me too'}</button>
              <button type="button" onClick={() => openRequest(item.id)}>View explanations</button>
              <button type="button" onClick={() => explainRequest(item.id)}>Explain</button>
            </div>
          </article>)}
          {filtered.map(mini => <article key={mini.id} className={styles.feedCard}>
            <div className={styles.feedCreator}>
              <button type="button" className={styles.linkButton} onClick={() => openCreator(mini.creator)}>
                <span className={styles.avatar} aria-hidden="true">{mini.creator.charAt(0)}</span>
                {mini.creator}
              </button>
              <button type="button" className={styles.smallButton}
                aria-pressed={followed.includes(mini.creator)}
                onClick={() => toggle(followed,setFollowed,mini.creator)}>
                {followed.includes(mini.creator) ? 'Following' : '+ Follow'}
              </button>
            </div>
            <button type="button" className={styles.feedImage} aria-label={'Read '+mini.title} onClick={() => read(mini)}>
              <MiniArtwork kind={mini.cover}/>
            </button>
            <div className={styles.feedCaption}>
              <button type="button" className={styles.linkButton} onClick={() => read(mini)}><strong>{mini.title}</strong></button>
              <p>{mini.summary}</p>
              <div className={styles.tagRow}>
                {mini.tags.map(name => <button key={name} type="button" className={styles.tagButton} onClick={() => selectTag(name)}>{'#'+name}</button>)}
              </div>
              <div className={styles.feedActions}>
                <button type="button" aria-pressed={liked.includes(mini.id)} onClick={() => toggle(liked,setLiked,mini.id)}>
                  {liked.includes(mini.id)?'♥ Liked':'♡ Like'}</button>
                <button type="button" onClick={() => read(mini)}>◇ Comment</button>
                <button type="button" aria-pressed={saved.includes(mini.id)} onClick={() => toggle(saved,setSaved,mini.id)}>
                  {saved.includes(mini.id)?'▣ Saved':'▢ Save'}</button>
                <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.origin+'/explore?mini='+encodeURIComponent(mini.id))}>↗ Share</button>
              </div>
            </div>
          </article>)}
        </div> : <div className={styles.empty}>
          <p>No matching Mini Lessons or requests in this preview.</p>
          <button type="button" className={styles.primary} onClick={() => { setRequestQuestion(query.trim()); setRequestFeedback(''); setView('request-compose') }}>Request this topic</button>
          <button type="button" className={styles.secondary} onClick={() => { setTag('All'); setTab('For You'); setQuery('') }}>Explore all</button>
        </div>}
        <p className={styles.previewNote}>Mini Lessons and requests here are illustrative. Requests, explanations and Me too actions are local to this preview. Public submission, recommendations and publishing are not active.</p>
      </>}

      {view === 'read' && current && <article className={styles.reader}>
        <div className={styles.readerHeader}><button type="button" className={styles.back} onClick={back}>← Back to Explore</button></div>
        <MiniArtwork kind={current.cover}/>
        <div className={styles.readerBody}>
          <span className={styles.subject}>MINI LESSON · {current.minutes} MIN READ</span>
          <h1 className={styles.readerTitle}>{current.title}</h1>
          <p className={styles.subline}>{current.summary}</p>
          <div className={styles.creatorRow}>
            <div className={styles.creatorLeft}>
              <span className={styles.avatar} aria-hidden="true">{current.creator.charAt(0)}</span>
              <div><button className={styles.linkButton} onClick={() => openCreator(current.creator)}>{current.creator}</button>
                <div className={styles.previewNote}>Example creator</div></div>
            </div>
            <button type="button" className={styles.smallButton} aria-pressed={followed.includes(current.creator)}
              onClick={() => toggle(followed, setFollowed, current.creator)}>{followed.includes(current.creator) ? 'Following' : '+ Follow'}</button>
          </div>
          {current.paragraphs.map((text, index) => <p className={styles.paragraph} key={index}>{text}</p>)}
          <div className={styles.tagRow}>{current.tags.map(name => <button key={name} type="button" className={styles.tagButton} onClick={() => selectTag(name)}>{'#'+name}</button>)}</div>
          <div className={styles.quiz}>
            <h3>Check your understanding</h3>
            <p>{current.question}</p>
            {current.choices.map((choice, index) =>
              <button type="button" key={choice} aria-pressed={answers[current.id] === index}
                className={styles.choice + (answers[current.id] === index ? ' ' + styles.selected : '')}
                onClick={() => setAnswers(prev => ({ ...prev, [current.id]: index }))}>{String.fromCharCode(65 + index)}. {choice}</button>)}
            {answers[current.id] !== undefined && <p className={styles.feedback} role="status">
              {answers[current.id] === current.correct ? 'Correct.' : 'Not quite. Review the Mini and try again.'}
            </p>}
          </div>
          <div className={styles.actions}>
            <button type="button" aria-pressed={liked.includes(current.id)} onClick={() => toggle(liked, setLiked, current.id)}>{liked.includes(current.id) ? '♥ Liked' : '♡ Like'}</button>
            <button type="button" aria-pressed={saved.includes(current.id)} onClick={() => toggle(saved, setSaved, current.id)}>{saved.includes(current.id) ? '▣ Saved' : '▢ Save'}</button>
            <button type="button" onClick={() => document.getElementById('mini-comments')?.scrollIntoView({ behavior: 'smooth' })}>Discussion</button>
            <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)}>↗ Share</button>
          </div>
          <section className={styles.comments} id="mini-comments" aria-label="Discussion preview">
            <h3>Discussion</h3>
            <p className={styles.subline}>Ask a question about this Mini. Your comments remain in this preview.</p>
            {(comments[current.id] || []).map((comment, index) =>
              <div key={index} className={styles.comment}><strong>{comment.name}</strong>{comment.text}</div>)}
            <form onSubmit={addComment} className={styles.commentEntry}>
              <label className={styles.label} htmlFor="mini-comment-input">Your question or comment</label>
              <textarea id="mini-comment-input" className={styles.field} maxLength={500} rows={3} value={draftComment}
                onChange={event => setDraftComment(event.target.value)} placeholder="Ask something about this Mini..."/>
              <button type="submit" className={styles.primary} disabled={!draftComment.trim()}>Add local comment</button>
            </form>
          </section>
          <p className={styles.previewNote}>All engagement is local to this browser view. Public comments and publishing require moderation and safeguarding controls.</p>
        </div>
      </article>}

      {view === 'request-detail' && request && <section className={styles.requestDetail}>
        <button type="button" className={styles.back} onClick={back}>← Back to Mini Lessons</button>
        <div className={styles.requestEyebrow}>Student request · illustrative preview</div>
        <h1>{request.question}</h1>
        <div className={styles.tagRow}>{request.tags.map(name => <button key={name} type="button"
          className={styles.tagButton} onClick={() => selectTag(name)}>{'#' + name}</button>)}</div>
        <div className={styles.requestActions}>
          <button type="button" aria-pressed={supportedRequests.includes(request.id)} onClick={() => toggleSupport(request.id)}>
            {supportedRequests.includes(request.id) ? '✓ Me too' : '+ Me too'}</button>
          <button type="button" className={styles.primary} onClick={() => explainRequest(request.id)}>Explain this</button>
        </div>
        <h2>{request.replies.length} {request.replies.length === 1 ? 'explanation' : 'explanations'}</h2>
        {request.replies.length === 0 && <p className={styles.subline}>No explanations added to this preview yet. Be the first to explain it.</p>}
        {request.replies.map(reply => <article key={reply.id} className={styles.localReply}>
          <img src={reply.photo} alt={'Illustration for ' + reply.title}/>
          <h3>{reply.title}</h3><p>{reply.explanation}</p>
          <span className={styles.previewNote}>Local explanation preview — not published</span>
        </article>)}
        <p className={styles.previewNote}>Requests do not expose student identity, and public explanations require verified creators and moderation.</p>
      </section>}

      {view === 'request-compose' && <section className={styles.form}>
        <button type="button" className={styles.back} onClick={back}>← Back to Mini Lessons</button>
        <span className={styles.eyebrow}>REQUEST A MINI LESSON</span>
        <h1>What would you like explained?</h1>
        <p className={styles.subline}>Ask a clear learning question. A photo is not required.</p>
        <form onSubmit={createRequest} className={styles.requestForm}>
          <label htmlFor="request-question" className={styles.label}>Your question</label>
          <textarea id="request-question" className={styles.editor} rows={4} minLength={12} maxLength={240}
            value={requestQuestion} onChange={event => setRequestQuestion(event.target.value)}
            placeholder="Can someone show me how to solve simultaneous equations?"/>
          <label htmlFor="request-tags" className={styles.label}>Hashtags</label>
          <input id="request-tags" className={styles.field} maxLength={160} value={requestTags}
            onChange={event => setRequestTags(event.target.value)} placeholder="#Mathematics #Grade9"/>
          {requestFeedback && <p role="status" className={styles.previewNote}>{requestFeedback}</p>}
          <button type="submit" className={styles.primary} disabled={requestQuestion.trim().length < 12 || !requestTags.trim()}>
            Add to preview</button>
        </form>
        <p className={styles.formNote}>This is a local interface preview. Nothing is posted online. Do not include names, phone numbers or other personal details.</p>
      </section>}

      {view === 'creator' && <section className={styles.profile}>
        <button type="button" className={styles.back} onClick={() => setView('read')}>← Back to Mini</button>
        <div className={styles.creatorRow}>
          <div className={styles.creatorLeft}><span className={styles.avatar} aria-hidden="true">{creator.charAt(0)}</span>
            <div><h1 style={{ margin: 0 }}>{creator}</h1><p className={styles.subline}>Illustrative educator profile</p></div></div>
          <button type="button" className={styles.smallButton} onClick={() => toggle(followed, setFollowed, creator)}>
            {followed.includes(creator) ? 'Following' : '+ Follow'}</button>
        </div>
        <h2>Mini Lessons</h2>
        <div className={styles.profileGrid}>{MINI_EXAMPLES.filter(mini => mini.creator === creator)
          .map(mini => <button type="button" className={styles.miniCard} key={mini.id} onClick={() => read(mini)}>
            <MiniArtwork kind={mini.cover}/><span className={styles.miniCardBody} style={{ display: 'block' }}><h3>{mini.title}</h3></span>
          </button>)}</div>
      </section>}

      {view === 'compose' && <section className={styles.form}>
        <button type="button" className={styles.back} onClick={back}>← Back to Explore</button>
        <span className={styles.eyebrow}>{respondingTo ? 'EXPLAIN A REQUEST' : 'CREATE MINI LESSON'}</span>
        <h1>{respondingTo ? 'Make it easy to understand.' : 'Share what you know.'}</h1>
        <p className={styles.subline}>{respondingTo ? 'Your explanation will be linked to the student question in this preview.' : 'One useful photo and a few paragraphs are enough to start.'}</p>
        <label className={styles.label} htmlFor="mini-title">Title</label>
        <input id="mini-title" className={styles.field} maxLength={100} value={draftTitle}
          onChange={event => setDraftTitle(event.target.value)} placeholder="What will someone learn?"/>
        <label className={styles.label} htmlFor="mini-body">Your explanation</label>
        <textarea id="mini-body" className={styles.editor} maxLength={3000} value={draftBody}
          onChange={event => setDraftBody(event.target.value)} placeholder="Explain something useful in a few paragraphs..."/>
        <label className={styles.label} htmlFor="mini-tags">Hashtags</label>
        <input id="mini-tags" className={styles.field} value={draftTags} onChange={event => setDraftTags(event.target.value)} placeholder="#Mathematics #Fractions" />
        <label className={styles.label} htmlFor="mini-attachment">Photo</label>
        <div className={styles.upload}>
          <input type="file" id="mini-attachment" accept="image/jpeg,image/png,image/webp"
            onChange={event => attach(event.target.files?.[0])}/>
          {draftFile && <span className={styles.previewNote}>{draftFile}</span>}
        </div>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" disabled={!draftTitle.trim() || !draftBody.trim()} onClick={() => setPreview(value => !value)}>
            {preview ? 'Hide preview' : 'Preview Mini'}</button>
          {respondingTo ? <button className={styles.primary} type="button"
            disabled={!draftTitle.trim() || !draftBody.trim() || !draftImage}
            onClick={addPreviewExplanation}>Add local explanation</button>
            : <button className={styles.primary} type="button" disabled title="Publishing requires a verified account and moderated backend">Publish — not active</button>}
        </div>
        {preview && <div className={styles.preview}>
          {draftImage ? <img src={draftImage} alt="Selected Mini cover preview" style={{ width: '100%', maxHeight: 320, objectFit: 'contain' }}/> : <MiniArtwork kind="history"/>}
          <div className={styles.previewBody}><span className={styles.subject}>MINI LESSON · {draftTags}</span>
            <h2>{draftTitle}</h2>{draftBody.split(/\n\s*\n/).map((part, index) => <p key={index}>{part}</p>)}</div>
        </div>}
        <p className={styles.formNote}>Interface preview only. Files remain on your device; nothing is uploaded or made public. Real publishing must verify creator permissions and pass content and child-safety checks.</p>
      </section>}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Link href="/" className={styles.sectionLink}>VibeSchool Home</Link>
      </div>
    </div>
  </div>
}
