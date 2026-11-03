import BrowseClient from './browse/BrowseClient'

// The entry point is the browse screen itself. Tutor or learner is chosen in the filter bar.
export default function VibeTutorHome() {
  return <BrowseClient initialView="tutors" />
}
