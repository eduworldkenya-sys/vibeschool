import type { Metadata } from 'next'
import styles from '@/components/vibetutor/VibeTutor.module.css'

export const metadata: Metadata = {
  title: { absolute: 'VibeTutor | Holiday tuition in Kenya' },
  description: 'Find a tutor or find students for holiday tuition, online or in person.',
}

export default function VibeTutorLayout({ children }: { children: React.ReactNode }) {
  return <main className={styles.wrap}>{children}</main>
}
