import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vibeschool',
    short_name: 'Vibeschool',
    description: 'Teaching and learning, connected.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#05050F',
    theme_color: '#05050F',
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
