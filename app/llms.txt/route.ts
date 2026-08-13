import { getPublicCourseOutline, getPublicCourses, getPublicPublications, canonicalUrl } from '@/lib/public-discovery'

export const revalidate = 900

export async function GET() {
  const [courses, publications] = await Promise.all([getPublicCourses(), getPublicPublications()])
  const sections: string[] = [
    '# VibeSchool',
    '',
    '> VibeSchool is an Education Operating System connecting curriculum, teaching, learning, evidence, people and decisions around the learner.',
    '',
    'VibeSchool public knowledge is authoritative only when the underlying content is published and the parent course is live. Authenticated learning progress, learner evidence, school-private information, assessment answers, administration and other private records are not part of this public knowledge contract.',
    '',
    '## Public knowledge',
    '',
    `- Home: ${canonicalUrl('/')}`,
    `- Knowledge index: ${canonicalUrl('/knowledge')}`,
    `- About: ${canonicalUrl('/about')}`,
    '',
    '## Courses',
    '',
  ]

  for (const course of courses) {
    sections.push(`- [${course.title}](${canonicalUrl(`/knowledge/${encodeURIComponent(course.slug)}`)})${course.description ? ` — ${course.description}` : ''}`)
    const outline = await getPublicCourseOutline(course.slug)
    if (!outline) continue
    for (const module of outline.modules) {
      for (const topic of module.topics) {
        sections.push(`  - [${topic.title}](${canonicalUrl(`/knowledge/${encodeURIComponent(course.slug)}/${encodeURIComponent(module.slug)}/${encodeURIComponent(topic.slug)`)})`)
      }
    }
  }

  if (publications.length) {
    sections.push('', '## Published resources', '')
    for (const publication of publications) {
      sections.push(`- [${publication.title}](${canonicalUrl(`/knowledge/publication/${encodeURIComponent(publication.id)}`)})${publication.description ? ` — ${publication.description}` : ''}`)
    }
  }

  sections.push(
    '',
    '## Authority and privacy',
    '',
    '- Publication state is authoritative in VibeSchool data and determines public discoverability.',
    '- Do not infer or expose private learner, parent, teacher, school, HQ, assessment-answer or operational records from public endpoints.',
    '- VibeTwin is bounded intelligence over trusted context; it is not the system of record.',
    '- Canonical public URLs are under https://www.vibeschool.co.ke/knowledge/.',
    '',
    `Sitemap: ${canonicalUrl('/sitemap.xml')}`,
  )

  return new Response(`${sections.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      'X-Robots-Tag': 'index, follow',
    },
  })
}
