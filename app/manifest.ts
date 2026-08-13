import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'VibeSchool',
    short_name: 'VibeSchool',
    description: 'Built around the teacher.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'en-KE',
    background_color: '#05050F',
    theme_color: '#05050F',
    categories: ['education'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/icons/icon.png?size=192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon.png?size=512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
