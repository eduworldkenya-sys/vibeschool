import { redirect } from 'next/navigation'

// Keep old links functional without maintaining a second inbox.
export default function LegacyTutorInquiries() {
  redirect('/vibechat?tab=enquiries')
}
