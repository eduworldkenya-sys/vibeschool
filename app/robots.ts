import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/about', '/contact', '/knowledge', '/knowledge/', '/legal/'],
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
        '/global/',
      ],
    }],
    sitemap: 'https://www.vibeschool.co.ke/sitemap.xml',
  }
}
