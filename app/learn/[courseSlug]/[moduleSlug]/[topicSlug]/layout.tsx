import type { Metadata } from 'next'
import { canonicalUrl, getPublicTopic } from '@/lib/public-discovery'

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
    robots: { index: false, follow: true },
  }
}

export default function TopicAppLayout({ children }: { children: React.ReactNode }) { return children }
