import type { Metadata } from 'next'
import SchoolAccess from '@/components/success-wishes/SchoolAccess'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'School access · Success Wishes', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function SchoolAccessPage() { return <SchoolAccess/> }
