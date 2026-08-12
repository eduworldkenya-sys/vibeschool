import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const SITE_URL = 'https://www.vibeschool.co.ke'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type Publication = {
  id: string
  title: string | null
  subtitle: string | null
  description: string | null
  cbc_grade: string | null
  cbc_subject: string | null
  format: string | null
  published_at: string | null
  status: string | null
}

type Chapter = {
  id: string
  number: number | null
  title: string | null
  subtitle: string | null
  description: string | null
  status: string | null
}

async function select<T>(table: string, query: string): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return []
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      next: { revalidate: 900 },
    })
    if (!response.ok) return []
    return (await response.json()) as T[]
  } catch {
    return []
  }
}

async function getPublication(publicationId: string) {
  const publications = await select<Publication>(
    'vibe_publications',
    `select=id,title,subtitle,description,cbc_grade,cbc_subject,format,published_at,status&id=eq.${encodeURIComponent(publicationId)}&status=eq.published&limit=1`,
  )
  const publication = publications[0]
  if (!publication) return null
  const chapters = await select<Chapter>(
    'vibe_chapters',
    `select=id,number,title,subtitle,description,status&publication_id=eq.${encodeURIComponent(publication.id)}&status=eq.published&order=number.asc`,
  )
  return { publication, chapters }
}

export const revalidate = 900

export async function generateMetadata({ params }: { params: { publicationId: string } }): Promise<Metadata> {
  const result = await getPublication(params.publicationId)
  if (!result) return { robots: { index: false, follow: true } }
  const { publication } = result
  const title = publication.title?.trim() || 'Published VibeSchool publication'
  const description = publication.description?.trim() || [publication.cbc_grade, publication.cbc_subject, publication.subtitle].filter(Boolean).join(' · ')
  const url = `${SITE_URL}/knowledge/publication/${encodeURIComponent(publication.id)}`
  return {
    title,
    description: description || `Explore the published educational content ${title} on VibeSchool.`,
    alternates: { canonical: url },
    openGraph: { type: 'website', title, description: description || title, url, siteName: 'VibeSchool' },
    robots: { index: true, follow: true },
  }
}

export default async function PublicPublicationKnowledgePage({ params }: { params: { publicationId: string } }) {
  const result = await getPublication(params.publicationId)
  if (!result) notFound()
  const { publication, chapters } = result
  const url = `${SITE_URL}/knowledge/publication/${encodeURIComponent(publication.id)}`
  const title = publication.title?.trim() || 'Published VibeSchool publication'
  const description = publication.description?.trim() || publication.subtitle?.trim() || ''
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: title,
    url,
    ...(description ? { description } : {}),
    ...(publication.cbc_grade ? { educationalLevel: publication.cbc_grade } : {}),
    ...(publication.cbc_subject ? { about: publication.cbc_subject } : {}),
    publisher: { '@type': 'EducationalOrganization', name: 'VibeSchool', url: SITE_URL },
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 80px', fontFamily: 'var(--font-jakarta, system-ui)' }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 24 }}>
        <Link href="/">VibeSchool</Link> / <Link href="/knowledge">Knowledge</Link> / <span>{title}</span>
      </nav>
      <header>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .65 }}>Published educational publication</p>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 54px)', lineHeight: 1.05, margin: '8px 0 16px' }}>{title}</h1>
        {publication.subtitle && <p style={{ fontSize: 18, lineHeight: 1.6, opacity: .75 }}>{publication.subtitle}</p>}
        <p style={{ fontSize: 14, opacity: .65 }}>{[publication.cbc_grade, publication.cbc_subject, publication.format].filter(Boolean).join(' · ')}</p>
        {description && <p style={{ maxWidth: 760, fontSize: 18, lineHeight: 1.75, marginTop: 16 }}>{description}</p>}
      </header>

      <section aria-labelledby="publication-chapters" style={{ marginTop: 44 }}>
        <h2 id="publication-chapters">Published chapters</h2>
        {chapters.length === 0 ? (
          <p>Published chapters are being prepared for this publication.</p>
        ) : (
          <ol>
            {chapters.map(chapter => (
              <li key={chapter.id} style={{ margin: '18px 0' }}>
                <strong>{chapter.title || `Chapter ${chapter.number ?? ''}`}</strong>
                {chapter.subtitle && <span style={{ opacity: .7 }}> — {chapter.subtitle}</span>}
                {chapter.description && <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>{chapter.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p style={{ marginTop: 48 }}><Link href={`/global/read/publication/${encodeURIComponent(publication.id)}`}>Open the interactive reader →</Link></p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  )
}
