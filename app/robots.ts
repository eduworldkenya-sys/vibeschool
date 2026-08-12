import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/about', '/contact', '/learn', '/learn/', '/knowledge', '/knowledge/', '/global', '/global/chronicles', '/global/vibes', '/global/read/', '/legal/'],
      disallow: ['/admin/', '/teacher/', '/parent/', '/student/', '/hq/', '/api/', '/auth/', '/select', '/global/create/', '/global/dashboard', '/global/profile', '/global/signup'],
    }],
    sitemap: 'https://www.vibeschool.co.ke/sitemap.xml',
  }
}
