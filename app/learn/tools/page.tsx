import type {Metadata} from 'next'
import Link from 'next/link'
import {TeachingToolsLibrary} from '@/components/learn/tools/TeachingToolsLibrary'
import styles from './tools.module.css'

export const metadata: Metadata = {
  title: 'Interactive learning tools | VibeSchool',
  description: 'Try interactive rulers, clocks, counters, graphs, science models and language activities.',
}

export default function LearnToolsPage() {
  return <main id="main-content" className={styles.page}>
    <header className={styles.header}>
      <h1>Interactive tools</h1>
      <p>Explore a model or try an activity. Your work stays on this page.</p>
      <Link href="/learn/visuals">Visual learning library</Link>
    </header>
    <TeachingToolsLibrary/>
  </main>
}
