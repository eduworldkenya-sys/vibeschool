import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublicCourses } from '@/lib/public-discovery'

export const revalidate = 900

export const metadata: Metadata = {
  title: 'Public Learning Knowledge',
  description: 'Published VibeSchool learning resources and educational knowledge.',
  alternates: { canonical: 'https://www.vibeschool.co.ke/knowledge' },
  robots: { index: true, follow: true },
}

export default async function KnowledgeIndexPage() {
  const courses = await getPublicCourses()
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 80px', fontFamily: 'var(--font-jakarta, system-ui)' }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 24 }}><Link href="/">VibeSchool</Link> / <span>Knowledge</span></nav>
      <h1 style={{ fontSize: 'clamp(34px, 6vw, 56px)', lineHeight: 1.05 }}>VibeSchool Knowledge</h1>
      <p style={{ fontSize: 18, lineHeight: 1.7, maxWidth: 720, opacity: .72 }}>
        A public, structured layer for published VibeSchool educational knowledge. Private learner, teacher, parent, school and administrative data remains outside this layer.
      </p>
      {courses.length === 0 ? (
        <section style={{ marginTop: 36 }}><h2>Published courses</h2><p>No courses are currently marked live. Content becomes discoverable when its authoritative lifecycle state permits publication.</p></section>
      ) : (
        <section style={{ marginTop: 36 }}><h2>Published courses</h2><ul>{courses.map(course => <li key={course.id} style={{ margin: '12px 0' }}><Link href={`/knowledge/${course.slug}`}>{course.title}</Link></li>)}</ul></section>
      )}
    </main>
  )
}
