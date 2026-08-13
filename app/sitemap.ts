import { MetadataRoute } from 'next'

const SITE = 'https://www.vibeschool.co.ke'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/global`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/global/read`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE}/global/chronicles`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE}/global/vibes`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE}/legal/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE}/legal/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]
}
