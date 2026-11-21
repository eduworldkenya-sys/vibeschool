import BrowseClient from './BrowseClient'

export default async function BrowsePage(props: { searchParams: Promise<{ view?: string }> }) {
  const searchParams = await props.searchParams;
  const initialView = searchParams.view === 'students' ? 'students' : 'tutors'
  return <BrowseClient initialView={initialView} />
}
