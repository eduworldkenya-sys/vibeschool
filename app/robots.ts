import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/about', '/contact', '/knowledge', '/knowledge/', '/global', '/global/chronicles', '/global/vibes', '/legal/'],
      disallow: [
        '/admin/',
        '/teacher/',
        '/parent/',
        '/student/',
        '/hq/',
        '/api/',
        '/auth/',
        '/select',
        '/learn/',
        '/global/create/',
        '/global/dashboard',
        '/global/profile',
        '/global/signup',
        '/global/read/',
      ],
    }],
    sitemap: 'https://www.vibeschool.co.ke/sitemap.xml',
  }
}
