'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Minus, Plus, Quote } from 'lucide-react'
import styles from './LiveReadingSurface.module.css'
import { parseLiveReadingPage, liveReadingBlockType } from '@/lib/live/readingPresentation'

/** Presentation only. The room's authenticated prompt/history is the authority.
 * Do not query the teacher's source library from a learner or parse arbitrary HTML.
 */
/** Readable live document, not a new book publishing system.
 * Quote-to-notes is strictly learner-private until the existing notes command saves.
 */
export function LiveReadingSurface({
  body, learner = false, onQuote,
}: {
  body: string
  learner?: boolean
  onQuote?: (quote: string) => void
}) {
  const [zoom, setZoom] = useState(0)
  const [quoted, setQuoted] = useState(false)
  const article = useRef<HTMLElement>(null)
  const pendingQuote = useRef('')
  const page = useMemo(() => parseLiveReadingPage(body),[body])
  useEffect(()=>{setQuoted(false);pendingQuote.current=''},[body])
  const selectedQuote = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return ''
    if (!article.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return ''
    return selection.toString().replace(/\s+/g, ' ').trim().slice(0, 360)
  }
  const saveQuote = () => {
    const quote = selectedQuote() || pendingQuote.current
    pendingQuote.current = ''
    if (!quote || !onQuote) return
    onQuote(quote)
    setQuoted(true)
    window.getSelection()?.removeAllRanges()
  }
  return <article className={styles.paper} ref={article} data-zoom={zoom} aria-label={page.title ? page.title + ' reading page' : 'Shared lesson reading'}>
    <header className={styles.top}>
      <div className={styles.book}><BookOpen size={17} aria-hidden="true"/><span>{page.title ?? 'Live reading'}</span></div>
      {page.number !== null && <span className={styles.pageNumber}>Page {page.number} / {page.total}</span>}
    </header>
    {learner && <div className={styles.actions} aria-label="Reading preferences">
      <span>Text size</span>
      <button type="button" aria-label="Make reading text smaller" disabled={zoom === -1} onClick={() => setZoom(value => Math.max(-1, value - 1))}><Minus size={16}/></button>
      <button type="button" aria-label="Make reading text bigger" disabled={zoom === 2} onClick={() => setZoom(value => Math.min(2, value + 1))}><Plus size={16}/></button>
      {onQuote && <button type="button" onPointerDown={() => { pendingQuote.current = selectedQuote() }} onClick={saveQuote} aria-label="Save selected passage to private notes" title="Select text, then save it to your notes"><Quote size={16}/> Note quote</button>}
    </div>}
    <div className={styles.chapters}>
      {page.paragraphs.map((part, index) => {
        const kind = liveReadingBlockType(part)
        if (kind === 'heading') return <h2 key={index} className={styles.heading}>{part}</h2>
        if (kind === 'section') return <h3 key={index} className={styles.section}>{part}</h3>
        if (kind === 'outcome') return <p key={index} className={styles.outcome}>{part}</p>
        return <p key={index} className={styles.paragraph}>{part}</p>
      })}
    </div>
    {quoted && learner && <p className={styles.saved} role="status">Quote added to your private notes. Save the notes to keep it.</p>}
  </article>
}
