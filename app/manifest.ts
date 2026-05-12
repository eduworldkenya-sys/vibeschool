import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VibeSchool',
    short_name: 'VibeSchool',
    description: 'Built around the teacher.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#05050F',
    theme_color: '#05050F',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}