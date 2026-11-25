import type {Metadata} from 'next'
import Link from 'next/link'
import {TeachingToolsLibrary} from '@/components/learn/tools/TeachingToolsLibrary'
import styles from './tools.module.css'

export const metadata: Metadata = {
  title: 'Interactive teaching tools | VibeSchool',
  description: 'Preview rulers, clocks, counters, graphs, science models and language activities for teaching.',
}

export default function TeacherInteractiveToolsPage() {
  return <section className={styles.page}>
    <header className={styles.header}>
      <Link href="/teacher/resources">← Teaching library</Link>
      <h1>Interactive tools</h1>
      <p>Explore teaching models and activities before a lesson.</p>
      <Link href="/teacher/tutoring/live">Open live classroom</Link>
    </header>
    <TeachingToolsLibrary/>
  </section>
}
