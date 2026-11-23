'use client'

import { useMemo } from 'react'
import styles from './PublishedTextbookEditorial.module.css'
import type { ContentBlock } from '@/lib/publishTypes'
import UniversalLearnReader, { type UniversalLearnSection } from '@/components/learn/UniversalLearnReader'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'
import { BiologyInteractiveBlock } from '@/components/global/publish/BiologyInteractiveBlock'

type ReaderSection = UniversalLearnSection & { sourceBlocks: ContentBlock[] }

function plainText(value: string): string {
  // Published Tiptap prose may contain HTML. Display the prose as text, never
  // interpolate the author-supplied markup into executable browser HTML.
  return value.replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
}

function publicMediaUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    // Never turn a private vibepress-draft:// reference into a public image.
    return url.toString()
  } catch { return null }
}

/** Presentation-only adapter: publication visibility and chapter entitlements
 * remain enforced by get_public_vibetextbook_reader and ReaderClient. */
export function textbookLearnSections(blocks: readonly ContentBlock[]): ReaderSection[] {
  const groups: ReaderSection[] = []
  let current: ReaderSection = { id: 'opening', title: 'Read and learn', tone: 'learn', body: '', sourceBlocks: [] }
  for (const block of blocks) {
    if (!block || typeof block.content !== 'string') continue
    if ((block.type === 'heading1' || block.type === 'heading2') && plainText(block.content)) {
      if (current.sourceBlocks.length) groups.push(current)
      current = { id: 'section-' + groups.length, title: plainText(block.content), tone: 'learn', body: '', sourceBlocks: [] }
      continue
    }
    if (block.content.trim() || block.type === 'divider') current.sourceBlocks.push(block)
  }
  if (current.sourceBlocks.length) groups.push(current)
  // UniversalLearnReader intentionally hides empty sections; preserve a body
  // marker derived from actual saved blocks even when renderBody owns layout.
  for (const group of groups) group.body = group.sourceBlocks.map(block => block.content).join('\n')
  return groups
}

function PublishedBlock({ block }: { block: ContentBlock }) {
  const text = plainText(block.content)
  const meta = block.meta ?? {}
  const caption = typeof meta.caption === 'string' ? meta.caption : ''
  if (block.type === 'image' || block.type === 'diagram') {
    const src = publicMediaUrl(block.content)
    if (!src) return <p role="status">This illustration is not publicly available.</p>
    const alt = typeof meta.alt === 'string' && meta.alt.trim() ? meta.alt : caption || 'Learning illustration'
    return <figure className={styles.media}>
      <img src={src} alt={alt} loading="lazy" style={{ maxWidth: '100%', height: 'auto', borderRadius: 0, display: 'block', margin: 'auto' }} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  }
  if (block.type === 'interactive') return <div style={{
    ['--publication-text' as string]: '#173e2c',
    ['--publication-muted' as string]: '#52665a',
    ['--publication-accent' as string]: '#168659',
    ['--publication-surface' as string]: '#f5faf6',
    ['--publication-border' as string]: '#dce7df',
  }}><BiologyInteractiveBlock block={block}/></div>
  if (block.type === 'divider') return <hr className={styles.divider} />
  if (!text) return null
  if (block.type === 'table') {
    const rows = block.content.split('\n').filter(Boolean).map(row => row.split('|').map(cell => cell.trim()))
    return <div className={styles.tableWrap}><table><tbody>
      {rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}
    </tbody></table></div>
  }
  if (block.type === 'heading3') return <h3 style={{ color: '#183e2c', fontSize: '1.05rem', margin: '16px 0 6px' }}>{text}</h3>
  if (block.type === 'bulletList' || block.type === 'numberedList' || block.type === 'keyPoints') {
    const lines = text.split(/\n+/).map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
    return block.type === 'numberedList'
      ? <ol style={{ paddingLeft: 22 }}>{lines.map((line, i) => <li key={i}><VisualRichText body={line}/></li>)}</ol>
      : <ul style={{ paddingLeft: 22 }}>{lines.map((line, i) => <li key={i}><VisualRichText body={line}/></li>)}</ul>
  }
  if (['activity','experiment','project','question'].includes(block.type)) return <section className={styles.activity} aria-label={block.type === 'question' ? 'Question' : 'Learning activity'}>
    <div className={styles.activityLabel}><span>{block.type === 'question' ? 'Think about it' : block.type === 'experiment' ? 'Investigation' : block.type === 'project' ? 'Project' : 'Activity'}</span></div>
    <div className={styles.activityBody}><VisualRichText body={text}/></div>
  </section>
  if (['definition','example','workedExample','callout','summary'].includes(block.type)) return <section className={block.type === 'summary' || block.type === 'callout' ? styles.keyIdea : styles.example}>
    <h3>{block.type === 'workedExample' ? 'Worked example' : block.type === 'summary' ? 'Remember' : block.type === 'example' ? 'Example' : block.type === 'definition' ? 'Meaning' : 'Key idea'}</h3>
    <VisualRichText body={text}/>
  </section>
  if (block.type === 'quote') return <blockquote className={styles.quote}><VisualRichText body={text}/></blockquote>
  return <VisualRichText body={text}/>
}

export default function PublishedTextbookLearnReader({ subject, blocks, chapterId }: {
  subject: string
  blocks: readonly ContentBlock[]
  chapterId: string
}) {
  const sections = useMemo(() => textbookLearnSections(blocks), [blocks])
  return <div className={styles.book}><UniversalLearnReader
    presentation="book"
    subject={subject}
    topic={chapterId}
    anchorPrefix={'textbook-' + chapterId}
    sections={sections}
    showTeachingTools={false}
    renderBody={section => <div className={styles.blocks}>
      {(section as ReaderSection).sourceBlocks.map(block => <div key={block.id} id={'reader-block-' + block.id} data-reader-block-id={block.id}>
        <PublishedBlock block={block}/>
      </div>)}
    </div>}
  /></div>
}
