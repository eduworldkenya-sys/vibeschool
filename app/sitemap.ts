import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const SITE = 'https://www.vibeschool.co.ke'

function baseEntries(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/about`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/contact`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/global`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/global/read`, changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE}/global/chronicles`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE}/global/vibes`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE}/legal/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE}/legal/terms`, changeFrequency: 'monthly', priority: 0.3 },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = baseEntries()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return entries

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Only the database's published state is eligible for discovery. The reader
  // currently exposes the textbook canonical route, so only published
  // VibeTextbooks are projected here until canonical routes exist for other
  // publication formats.
  const { data, error } = await supabase
    .from('vibe_publications')
    .select('id, format, published_at, updated_at')
    .eq('status', 'published')
    .eq('format', 'vibetextbook')
    .order('published_at', { ascending: false })
    .limit(5000)

  if (error || !data) return entries

  return [
    ...entries,
    ...data.map((publication) => ({
      url: `${SITE}/read/textbook/${publication.id}`,
      lastModified: publication.published_at ?? publication.updated_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
  ]
}
