import JoinForm from './JoinForm'

export default function JoinPage({ searchParams }: { searchParams?: { role?: string } }) {
  const role = searchParams?.role === 'parent' ? 'parent' : 'teacher'
  return <JoinForm initialRole={role} />
}
