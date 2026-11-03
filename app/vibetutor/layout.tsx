import type { Metadata } from 'next'
import Nav from '@/components/vibetutor/Nav'
import styles from '@/components/vibetutor/VibeTutor.module.css'

export const metadata: Metadata = {
  title: { absolute: 'VibeTutor | Holiday tuition in Kenya' },
  description: 'Find a tutor or find students for holiday tuition, online or in person.',
}

export default function VibeTutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Nav />
      <main className={styles.page}>{children}</main>
    </div>
  )
}
