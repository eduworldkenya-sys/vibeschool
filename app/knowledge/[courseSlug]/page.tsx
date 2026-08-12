import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { canonicalUrl, getPublicCourseOutline } from '@/lib/public-discovery'

export const revalidate = 900

export async function generateMetadata({ params }: { params: { courseSlug: string } }): Promise<Metadata> {
  const result = await getPublicCourseOutline(params.courseSlug)
  if (!result) return { robots: { index: false, follow: true } }
  const { course } = result
  const url = canonicalUrl(`/knowledge/${course.slug}`)
  const description = [course.level, course.institution, course.duration_label].filter(Boolean).join(' · ')
  return {
    title: course.title,
    description: description || `Explore the published learning structure for ${course.title} on VibeSchool.`,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: course.title, description: description || `Explore ${course.title} on VibeSchool.`, url, siteName: 'VibeSchool' },
    robots: { index: true, follow: true },
  }
}

export default async function PublicCoursePage({ params }: { params: { courseSlug: string } }) {
  const result = await getPublicCourseOutline(params.courseSlug)
  if (!result) notFound()
  const { course, modules } = result
  const url = canonicalUrl(`/knowledge/${course.slug}`)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    url,
    provider: { '@type': 'EducationalOrganization', name: 'VibeSchool', url: 'https://www.vibeschool.co.ke' },
    ...(course.level ? { educationalLevel: course.level } : {}),
    hasCourseInstance: modules.flatMap(module => module.topics.map(topic => ({
      '@type': 'CourseInstance',
      name: topic.title,
      courseMode: 'online',
      url: canonicalUrl(`/knowledge/${course.slug}/${module.slug}/${topic.slug}`),
    }))),
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 80px', fontFamily: 'var(--font-jakarta, system-ui)' }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 24 }}>
        <Link href="/">VibeSchool</Link> / <Link href="/learn">Learn</Link> / <span>{course.title}</span>
      </nav>
      <header>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .65 }}>Published learning resource</p>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 54px)', lineHeight: 1.05, margin: '8px 0 16px' }}>{course.title}</h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, opacity: .75 }}>
          {[course.institution, course.level, course.duration_label].filter(Boolean).join(' · ') || 'VibeSchool learning resource'}
        </p>
      </header>

      <section aria-labelledby="course-content" style={{ marginTop: 40 }}>
        <h2 id="course-content">Course content</h2>
        {modules.length === 0 ? (
          <p>Published learning topics are being prepared for this course.</p>
        ) : (
          modules.map(module => (
            <section key={module.id} style={{ marginTop: 28 }}>
              <h3 style={{ marginBottom: 8 }}>{module.title}</h3>
              {module.weeks_label && <p style={{ marginTop: 0, opacity: .65 }}>{module.weeks_label}</p>}
              {module.topics.length > 0 ? (
                <ul>
                  {module.topics.map(topic => (
                    <li key={topic.id} style={{ margin: '10px 0' }}>
                      <Link href={`/knowledge/${course.slug}/${module.slug}/${topic.slug}`}>{topic.title}</Link>
                      {topic.subtitle && <span style={{ opacity: .65 }}> — {topic.subtitle}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ opacity: .65 }}>Topics are being prepared.</p>
              )}
            </section>
          ))
        )}
      </section>

      <p style={{ marginTop: 48 }}><Link href={`/learn/${course.slug}`}>Open the interactive learning experience →</Link></p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  )
}
