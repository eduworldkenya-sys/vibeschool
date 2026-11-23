'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { MINI_EXAMPLES, type MiniExample } from '@/lib/public/mini-examples'
import { MiniArtwork } from './MiniArtwork'
import styles from './MiniExplore.module.css'

type View = 'feed' | 'read' | 'creator' | 'compose'
type FeedTab = 'For You' | 'Following' | 'New'
type LocalComment = { name: string; text: string }

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

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('mini')
    if (id && MINI_EXAMPLES.some(mini => mini.id === id)) {
      setSelected(id)
      setView('read')
    }
  }, [])

  const popularTags = Array.from(new Set(MINI_EXAMPLES.flatMap(mini => mini.tags)))
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
    window.history.replaceState(null, '', '/explore')
  }
  const openCreator = (name: string) => {
    setCreator(name)
    setView('creator')
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
          <button type="button" className={styles.primary} onClick={() => setView('compose')}>+ Create Mini</button>
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
          <span>{filtered.length} illustrative examples</span>
        </div>
        {filtered.length ? <div className={styles.grid}>
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
          <p>No matching Minis in this preview.</p>
          <button type="button" className={styles.secondary} onClick={() => { setTag('All'); setTab('For You'); setQuery('') }}>Explore all</button>
        </div>}
        <p className={styles.previewNote}>These are examples for interface testing, not publications by real teachers. Personalized recommendations and public publishing are not active.</p>
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
        <span className={styles.eyebrow}>CREATE MINI LESSON</span>
        <h1>Share what you know.</h1>
        <p className={styles.subline}>One useful photo and a few paragraphs are enough to start.</p>
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
          <button className={styles.primary} type="button" disabled title="Publishing requires a verified account and moderated backend">Publish — not active</button>
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
