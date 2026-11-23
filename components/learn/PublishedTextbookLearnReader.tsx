'use client'

import { useMemo } from 'react'
import type { ContentBlock } from '@/lib/publishTypes'
import UniversalLearnReader, { type UniversalLearnSection } from '@/components/learn/UniversalLearnReader'
import { VisualRichText } from '@/components/learn/VisualLearningAsset'

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
    return <figure style={{ margin: '18px 0', textAlign: 'center' }}>
      <img src={src} alt={alt} loading="lazy" style={{ maxWidth: '100%', height: 'auto', borderRadius: 12, display: 'block', margin: 'auto' }} />
      {caption && <figcaption style={{ marginTop: 9, color: '#526558', fontSize: 13 }}>{caption}</figcaption>}
    </figure>
  }
  if (block.type === 'divider') return <hr style={{ border: 0, borderTop: '1px solid #dce6df', margin: '14px 0' }} />
  if (!text) return null
  if (block.type === 'heading3') return <h3 style={{ color: '#183e2c', fontSize: '1.05rem', margin: '16px 0 6px' }}>{text}</h3>
  if (block.type === 'bulletList' || block.type === 'numberedList' || block.type === 'keyPoints') {
    const lines = text.split(/\n+/).map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
    return block.type === 'numberedList'
      ? <ol style={{ paddingLeft: 22 }}>{lines.map((line, i) => <li key={i}><VisualRichText body={line}/></li>)}</ol>
      : <ul style={{ paddingLeft: 22 }}>{lines.map((line, i) => <li key={i}><VisualRichText body={line}/></li>)}</ul>
  }
  if (['activity','experiment','project','question','interactive'].includes(block.type)) return <aside style={{ borderLeft: '3px solid #9574ba', padding: '10px 15px', background: '#faf8ff', borderRadius: 8, margin: '12px 0' }}>
    <strong style={{ fontSize: 13, color: '#613e83' }}>{block.type === 'question' ? 'Think about it' : block.type === 'interactive' ? 'Explore' : 'Try this'}</strong>
    <VisualRichText body={text}/>
  </aside>
  if (['definition','example','workedExample','callout','summary'].includes(block.type)) return <aside style={{ borderLeft: '3px solid #168659', padding: '10px 15px', background: '#f4faf6', borderRadius: 8, margin: '12px 0' }}>
    <strong style={{ fontSize: 13, color: '#185b3d' }}>{block.type === 'workedExample' ? 'Worked example' : block.type.charAt(0).toUpperCase() + block.type.slice(1)}</strong>
    <VisualRichText body={text}/>
  </aside>
  if (block.type === 'quote') return <blockquote style={{ margin: '12px 0', paddingLeft: 15, borderLeft: '3px solid #9ebcaf' }}><VisualRichText body={text}/></blockquote>
  return <VisualRichText body={text}/>
}

export default function PublishedTextbookLearnReader({ subject, blocks, chapterId }: {
  subject: string
  blocks: readonly ContentBlock[]
  chapterId: string
}) {
  const sections = useMemo(() => textbookLearnSections(blocks), [blocks])
  return <UniversalLearnReader
    subject={subject}
    topic={chapterId}
    anchorPrefix={'textbook-' + chapterId}
    sections={sections}
    showTeachingTools={false}
    renderBody={section => <div style={{ display: 'grid', gap: 12 }}>
      {(section as ReaderSection).sourceBlocks.map(block => <div key={block.id} id={'reader-block-' + block.id} data-reader-block-id={block.id}>
        <PublishedBlock block={block}/>
      </div>)}
    </div>}
  />
}
