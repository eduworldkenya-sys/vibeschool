import type { Metadata } from 'next'
import JoinForm from './JoinForm'

export const metadata: Metadata = { title: 'Join VibeSchool', robots: { index: false, follow: false } }

export default function JoinPage({ searchParams }: { searchParams?: { role?: string } }) {
  const role = searchParams?.role === 'parent' ? 'parent' : 'teacher'
  return <JoinForm initialRole={role} />
}
