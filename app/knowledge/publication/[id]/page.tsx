import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { ContentBlock, VibeChapter, VibePublication } from '@/lib/publishTypes'
import { FORMAT_META } from '@/lib/publishTypes'
import { canonicalUrl } from '@/lib/public-discovery'

export const revalidate = 900

type PublicChapter = Pick<VibeChapter, 'id' | 'title' | 'number' | 'status' | 'word_count' | 'reading_time_min' | 'learning_outcomes' | 'cbc_strand' | 'blocks'>

function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )
}

async function getPublicPublication(id: string) {
  const supabase = createClient()
  const { data: publication, error } = await supabase
    .from('vibe_publications')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (error || !publication) return null

  const { data: chapters } = await supabase
    .from('vibe_chapters')
    .select('id,title,number,status,word_count,reading_time_min,learning_outcomes,cbc_strand,blocks')
    .eq('publication_id', id)
    .eq('status', 'published')
    .order('number', { ascending: true })

  return { publication: publication as VibePublication, chapters: (chapters ?? []) as PublicChapter[] }
}

function blockText(block: ContentBlock): string {
  if (!block?.content) return ''
  return block.content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function publicBlocks(chapter: PublicChapter, publication: VibePublication): ContentBlock[] {
  const pricing = publication.pricing
  const isFree = pricing.type === 'free' || pricing.type === 'donation'
  const isFreemium = pricing.type === 'freemium' && chapter.number <= pricing.freeChapters
  return isFree || isFreemium ? chapter.blocks ?? [] : []
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const result = await getPublicPublication(params.id)
  if (!result) return { robots: { index: false, follow: true } }
  const { publication } = result
  const meta = FORMAT_META[publication.format] ?? { label: 'Learning resource', chapterPlural: 'Chapters', chapterLabel: 'Chapter' }
  const title = publication.title || 'Published learning resource'
  const description = publication.description?.trim() || `Published ${meta.label} on VibeSchool.`
  const url = canonicalUrl(`/knowledge/publication/${publication.id}`)
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', title, description, url, siteName: 'VibeSchool' },
    robots: { index: true, follow: true },
  }
}

export default async function PublicPublicationKnowledgePage({ params }: { params: { id: string } }) {
  const result = await getPublicPublication(params.id)
  if (!result) notFound()

  const { publication, chapters } = result
  const meta = FORMAT_META[publication.format] ?? { label: 'Learning resource', chapterPlural: 'Chapters', chapterLabel: 'Chapter' }
  const url = canonicalUrl(`/knowledge/publication/${publication.id}`)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': publication.format === 'vibetextbook' ? 'Book' : 'CreativeWork',
    name: publication.title,
    description: publication.description || undefined,
    url,
    inLanguage: publication.language,
    datePublished: publication.published_at || undefined,
    author: { '@type': 'Organization', name: 'VibeSchool', url: 'https://www.vibeschool.co.ke' },
    ...(publication.cbc_grade ? { educationalLevel: publication.cbc_grade } : {}),
    ...(publication.cbc_subject ? { about: publication.cbc_subject } : {}),
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '44px 20px 90px', fontFamily: 'var(--font-jakarta, system-ui)' }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 28 }}>
        <Link href="/">VibeSchool</Link> / <Link href="/knowledge">Knowledge</Link> / <span>{publication.title || 'Publication'}</span>
      </nav>

      <header>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .65 }}>{meta.label} · Published learning resource</p>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', lineHeight: 1.05, margin: '8px 0 14px' }}>{publication.title || 'Untitled publication'}</h1>
        {publication.subtitle && <p style={{ fontSize: 20, lineHeight: 1.6, opacity: .72 }}>{publication.subtitle}</p>}
        <p style={{ fontSize: 14, lineHeight: 1.7, opacity: .7 }}>
          {[publication.cbc_grade, publication.cbc_subject, publication.curriculum_framework].filter(Boolean).join(' · ') || 'Educational resource'}
        </p>
        {publication.description && <p style={{ maxWidth: 760, fontSize: 18, lineHeight: 1.75 }}>{publication.description}</p>}
      </header>

      <section aria-labelledby="publication-contents" style={{ marginTop: 42 }}>
        <h2 id="publication-contents">{meta.chapterPlural}</h2>
        {chapters.length === 0 ? <p>Published content is being prepared.</p> : chapters.map(chapter => {
          const blocks = publicBlocks(chapter, publication)
          return (
            <article key={chapter.id} style={{ marginTop: 34, paddingTop: 24, borderTop: '1px solid rgba(0,0,0,.12)' }}>
              <h3>{meta.chapterLabel} {chapter.number}: {chapter.title || `${meta.chapterLabel} ${chapter.number}`}</h3>
              <p style={{ opacity: .65, fontSize: 13 }}>{chapter.word_count.toLocaleString()} words · approximately {chapter.reading_time_min} minutes</p>
              {chapter.cbc_strand && <p style={{ fontSize: 13, opacity: .7 }}>Curriculum strand: {chapter.cbc_strand}</p>}
              {chapter.learning_outcomes?.length > 0 && (
                <div>
                  <h4>Learning outcomes</h4>
                  <ul>{chapter.learning_outcomes.map((outcome, index) => <li key={`${chapter.id}-outcome-${index}`}>{outcome}</li>)}</ul>
                </div>
              )}
              {blocks.length > 0 ? (
                <div aria-label={`${chapter.title || meta.chapterLabel} educational content`}>
                  {blocks.map(block => {
                    const text = blockText(block)
                    if (!text) return null
                    if (block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3') {
                      const Heading = block.type === 'heading1' ? 'h4' : block.type === 'heading2' ? 'h5' : 'h6'
                      return <Heading key={block.id}>{text}</Heading>
                    }
                    return <p key={block.id} style={{ lineHeight: 1.8 }}>{text}</p>
                  })}
                </div>
              ) : (
                <p style={{ opacity: .65 }}>The interactive reader contains the complete reading experience for this {meta.chapterLabel.toLowerCase()}.</p>
              )}
            </article>
          )
        })}
      </section>

      <p style={{ marginTop: 48 }}><Link href={`/global/read/publication/${publication.id}`}>Open the interactive reader →</Link></p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  )
}
