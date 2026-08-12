import type { Metadata } from 'next'
import { canonicalUrl, getPublicCourse } from '@/lib/public-discovery'

export async function generateMetadata({ params }: { params: { courseSlug: string } }): Promise<Metadata> {
  const course = await getPublicCourse(params.courseSlug)
  if (!course) return { robots: { index: false, follow: true } }
  const description = [course.level, course.institution, course.duration_label].filter(Boolean).join(' · ')
  return {
    title: course.title,
    description: description || `Explore ${course.title} on VibeSchool.`,
    alternates: { canonical: canonicalUrl(`/knowledge/${course.slug}`) },
    openGraph: { type: 'website', title: course.title, description: description || `Explore ${course.title} on VibeSchool.`, url: canonicalUrl(`/knowledge/${course.slug}`), siteName: 'VibeSchool' },
    robots: { index: false, follow: true },
  }
}

export default function CourseAppLayout({ children }: { children: React.ReactNode }) { return children }
