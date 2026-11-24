import type { Metadata } from 'next'

// Render the same Explore experience at the public root without a redirect.
export { default } from './explore/page'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  title: 'VibeSchool — Learn, teach and share knowledge',
  description: 'Discover Mini Lessons, learning resources and educators on VibeSchool, built for Kenyan education.',
}
