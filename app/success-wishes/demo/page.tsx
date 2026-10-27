import type { Metadata } from 'next'
import DemoInbox from './DemoInbox'

export const metadata: Metadata = {
  title: 'Try the Success Wishes Inbox | VibeSchool',
  robots: { index: false, follow: false },
}

export default function DemoInboxPage() {
  return <DemoInbox />
}
