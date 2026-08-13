import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/contact',
          '/global',
          '/global/read/',
          '/global/chronicles',
          '/global/vibes',
          '/legal/',
        ],
        disallow: [
          '/admin/',
          '/teacher/',
          '/parent/',
          '/student/',
          '/select',
          '/global/create/',
          '/global/dashboard',
          '/global/profile',
          '/global/signup',
        ],
      },
    ],
    sitemap: 'https://www.vibeschool.co.ke/sitemap.xml',
  }
}
