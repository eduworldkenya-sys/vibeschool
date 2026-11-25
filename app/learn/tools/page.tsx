import {redirect} from 'next/navigation'

// Legacy standalone library URL. The destination uses existing Teacher OS access.
export default function LearnToolsPage() {
  redirect('/teacher/resources/interactive-tools')
}
