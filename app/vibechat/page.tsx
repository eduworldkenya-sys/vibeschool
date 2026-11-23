import { Suspense } from 'react'
import VibeChat from '@/components/vibechat/VibeChat'

export const metadata = {
  title: 'VibeChat | VibeSchool',
  description: 'Your school, tuition and family conversations in one place.',
}

export default function VibeChatPage() {
  return <Suspense fallback={<main style={{padding:24}}>Opening VibeChat…</main>}>
    <VibeChat />
  </Suspense>
}
