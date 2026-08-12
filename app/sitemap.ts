import { MetadataRoute } from 'next'

const SITE_URL = 'https://www.vibeschool.co.ke'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type PublicCourse = { id: string; slug: string }
type PublicModule = { id: string; slug: string; course_id: string }
type PublicTopic = { slug: string; module_id: string }
type PublicPublication = { id: string; updated_at: string | null; published_at: string | null }

async function supabaseSelect<T>(table: string, query: string): Promise<T[]> {
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, modules, topics, publications] = await Promise.all([
    supabaseSelect<PublicCourse>('courses', 'select=id,slug&status=eq.live&order=slug.asc'),
    supabaseSelect<PublicModule>('modules', 'select=id,slug,course_id&order=sequence_number.asc'),
    supabaseSelect<PublicTopic>('topics', 'select=slug,module_id&content_status=eq.published&order=sequence_number.asc'),
    supabaseSelect<PublicPublication>('vibe_publications', 'select=id,updated_at,published_at&status=eq.published&order=published_at.desc'),
  ])

  const courseById = new Map(courses.map(course => [course.id, course]))
  const moduleById = new Map(modules.map(module => [module.id, module]))
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/knowledge`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/global`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/global/chronicles`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/global/vibes`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/legal/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/legal/terms`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  for (const course of courses) {
    entries.push({ url: `${SITE_URL}/knowledge/${encodeURIComponent(course.slug)}`, changeFrequency: 'weekly', priority: 0.9 })
  }

  for (const topic of topics) {
    const module = moduleById.get(topic.module_id)
    if (!module) continue
    const course = courseById.get(module.course_id)
    if (!course) continue
    entries.push({
      url: `${SITE_URL}/knowledge/${encodeURIComponent(course.slug)}/${encodeURIComponent(module.slug)}/${encodeURIComponent(topic.slug)}`,
      changeFrequency: 'monthly',
      priority: 0.8,
    })
  }

  for (const publication of publications) {
    entries.push({
      url: `${SITE_URL}/knowledge/publication/${encodeURIComponent(publication.id)}`,
      lastModified: publication.updated_at || publication.published_at || undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }

  return entries
}
