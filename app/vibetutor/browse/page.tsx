import BrowseClient from './BrowseClient'

export default function BrowsePage({ searchParams }: { searchParams: { view?: string } }) {
  const initialView = searchParams.view === 'students' ? 'students' : 'tutors'
  return <BrowseClient initialView={initialView} />
}
