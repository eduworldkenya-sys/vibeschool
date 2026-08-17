import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact VibeSchool | Support & Enquiries',
  description:'Contact VibeSchool for general enquiries, schools, institutions, government, partnerships, careers or authenticated account support.',
  alternates:{canonical:'/contact'},
  openGraph: {
    title: 'Contact VibeSchool | Support & Enquiries',
    description:'Talk to VibeSchool about the platform, schools, partnerships, careers or account-specific support.',
    url: '/contact', siteName:'VibeSchool', locale:'en_KE', type:'website',
  },
  twitter: { card:'summary_large_image', title:'Contact VibeSchool | Support & Enquiries', description:'Talk to VibeSchool about the platform, schools, partnerships, careers or account-specific support.' },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) { return children }
