import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/global',
          '/global/chronicles',
          '/global/vibes',
          '/global/read/',
          '/student/learn',
          '/student/resources',
          '/legal/',
        ],
        disallow: [
          '/admin/',
          '/teacher/',
          '/parent/',
          '/student/claim',
          '/student/vibelearn',
          ,
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
