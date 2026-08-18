import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: [
        '/', '/product', '/sandbox', '/teachers', '/learners', '/families', '/about', '/contact', '/careers', '/institutions',
        '/trust/', '/pathways/', '/learn/careers', '/global', '/global/chronicles', '/global/vibes', '/global/read/', '/legal/',
      ],
      disallow: [
        '/login', '/signup/', '/welcome', '/auth/', '/reset-password', '/api/', '/hq/', '/admin/',
        '/teacher/', '/parent/', '/student/', '/select', '/global/create/', '/global/dashboard', '/global/profile', '/global/signup',
      ],
    }],
    sitemap: 'https://www.vibeschool.co.ke/sitemap.xml',
    host: 'https://www.vibeschool.co.ke',
  }
}
