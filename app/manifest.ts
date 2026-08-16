import type { MetadataRoute } from 'next'

const ICON_192 = '/pwa-icons/v3/192'
const ICON_512 = '/pwa-icons/v3/512'
const ICON_MASKABLE_512 = '/pwa-icons/v3/maskable-512'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'VibeSchool',
    short_name: 'VibeSchool',
    description: 'VibeSchool connects curriculum, teaching, learning evidence and the people supporting a learner.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'en-KE',
    background_color: '#070B1F',
    theme_color: '#070B1F',
    categories: ['education'],
    prefer_related_applications: false,
    icons: [
      { src: ICON_192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: ICON_512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: ICON_MASKABLE_512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Student', short_name: 'Student', description: 'Open the VibeSchool student experience.', url: '/student', icons: [{ src: ICON_192, sizes: '192x192', type: 'image/png' }] },
      { name: 'Teacher', short_name: 'Teacher', description: 'Open the VibeSchool teacher experience.', url: '/teacher', icons: [{ src: ICON_192, sizes: '192x192', type: 'image/png' }] },
    ],
  }
}
