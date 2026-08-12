import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canonicalUrl, getPublicTopic, type ContentBlock } from '@/lib/public-discovery'

export const revalidate = 900

export async function generateMetadata({ params }: { params: { courseSlug: string; moduleSlug: string; topicSlug: string } }): Promise<Metadata> {
  const result = await getPublicTopic(params.courseSlug, params.moduleSlug, params.topicSlug)
  if (!result) return { robots: { index: false, follow: true } }
  const { course, module, topic } = result
  const title = `${topic.title} | ${course.title}`
  const description = topic.subtitle || `Learn ${topic.title} in ${module.title} with VibeSchool.`
  const url = canonicalUrl(`/knowledge/${course.slug}/${module.slug}/${topic.slug}`)
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', title, description, url, siteName: 'VibeSchool' },
    robots: { index: true, follow: true },
  }
}

function BlockSection({ heading, blocks }: { heading: string; blocks?: ContentBlock[] | null }) {
  if (!blocks?.length) return null
  return (
    <section style={{ marginTop: 36 }}>
      <h2>{heading}</h2>
      <div>
        {blocks.map((block, index) => (
          <article key={`${block.title ?? 'block'}-${index}`} style={{ marginTop: 20 }}>
            {block.title && <h3>{block.title}</h3>}
            {block.text && <p style={{ lineHeight: 1.8, fontSize: 16 }}>{block.text}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

export default async function PublicTopicPage({ params }: { params: { courseSlug: string; moduleSlug: string; topicSlug: string } }) {
  const result = await getPublicTopic(params.courseSlug, params.moduleSlug, params.topicSlug)
  if (!result) notFound()
  const { course, module, topic } = result
  const url = canonicalUrl(`/knowledge/${course.slug}/${module.slug}/${topic.slug}`)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: topic.title,
    description: topic.subtitle || `Learn ${topic.title} in ${module.title}.`,
    url,
    learningResourceType: 'lesson',
    isPartOf: { '@type': 'Course', name: course.title, url: canonicalUrl(`/knowledge/${course.slug}`) },
    provider: { '@type': 'EducationalOrganization', name: 'VibeSchool', url: 'https://www.vibeschool.co.ke' },
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 20px 80px', fontFamily: 'var(--font-jakarta, system-ui)' }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 28 }}>
        <Link href="/">VibeSchool</Link> / <Link href={`/knowledge/${course.slug}`}>{course.title}</Link> / <span>{module.title}</span>
      </nav>
      <article>
        <header>
          <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .65 }}>
            {topic.week_number ? `Week ${topic.week_number} · ` : ''}{module.title}
          </p>
          <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', lineHeight: 1.08, margin: '8px 0 14px' }}>{topic.title}</h1>
          {topic.subtitle && <p style={{ fontSize: 19, lineHeight: 1.6, opacity: .72 }}>{topic.subtitle}</p>}
        </header>

        <BlockSection heading="Core concepts" blocks={topic.concept_tab} />
        <BlockSection heading="Kenya context" blocks={topic.kenya_context_tab} />
        <BlockSection heading="Common errors" blocks={topic.common_errors_tab} />
        <BlockSection heading="Practical tip" blocks={topic.clinical_tip_tab} />

        <footer style={{ marginTop: 52, paddingTop: 24, borderTop: '1px solid #ddd' }}>
          <p><Link href={`/learn/${course.slug}/${module.slug}/${topic.slug}`}>Open the interactive learning experience →</Link></p>
          <p style={{ fontSize: 13, opacity: .65 }}>This public page represents published VibeSchool learning content. Interactive progress and learner-specific data remain in the authenticated learning experience.</p>
        </footer>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  )
}
