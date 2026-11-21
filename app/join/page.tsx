import type { Metadata } from 'next'
import JoinForm from './JoinForm'

export const metadata: Metadata = { title: 'Join VibeSchool', robots: { index: false, follow: false } }

export default async function JoinPage(props: { searchParams?: Promise<{ role?: string }> }) {
  const searchParams = await props.searchParams;
  const role = searchParams?.role === 'parent' ? 'parent' : 'teacher'
  return <JoinForm initialRole={role} />
}
