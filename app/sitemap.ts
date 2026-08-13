import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const SITE_URL = 'https://www.vibeschool.co.ke'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/contact`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/global/read`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/legal/privacy`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/terms`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return staticRoutes

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: publications } = await supabase
    .from('vibe_publications')
    .select('id, format, published_at, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1000)

  const publicationRoutes: MetadataRoute.Sitemap = (publications ?? []).map((publication) => ({
    url:
      publication.format === 'vibetextbook'
        ? `${SITE_URL}/read/textbook/${publication.id}`
        : `${SITE_URL}/global/read/publication/${publication.id}`,
    lastModified: publication.updated_at ?? publication.published_at ?? undefined,
    changeFrequency: 'weekly',
    priority: publication.format === 'vibetextbook' ? 0.9 : 0.8,
  }))

  return [...staticRoutes, ...publicationRoutes]
}
