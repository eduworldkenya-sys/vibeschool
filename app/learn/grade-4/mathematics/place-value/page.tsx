import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Link from 'next/link'
import PlaceValuePreviewChart from '@/components/learn/PlaceValuePreviewChart'
import styles from './PlaceValuePreview.module.css'

export const dynamic = 'force-static'
export const metadata: Metadata = {
  title: 'Place Value and Total Value | Grade 4 Mathematics | VibeSchool Preview',
  description: 'Explore place value, total value, worked examples and independent exercises in Grade 4 Mathematics.',
  robots: { index: false, follow: true },
}

type Section =
  | { kind: 'heading'; level: number; value: string }
  | { kind: 'paragraph'; value: string }
  | { kind: 'list'; numbered: boolean; start: number; entries: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'divider' }

function parseManuscript(markdown: string): Section[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const sections: Section[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    if (/^---+$/.test(line)) { sections.push({ kind: 'divider' }); i++; continue }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      sections.push({ kind: 'heading', level: heading[1].length, value: heading[2] })
      i++
      continue
    }
    if (line.startsWith('|') && /^\|[\s:-]+\|/.test((lines[i + 1] ?? '').trim())) {
      const rows = [line.split('|').slice(1, -1).map(value => value.trim())]
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().split('|').slice(1, -1).map(value => value.trim()))
        i++
      }
      sections.push({ kind: 'table', rows })
      continue
    }
    if (/^(?:-\s+|\d+\.\s+)/.test(line)) {
      const numbered = /^\d+\.\s+/.test(line)
      const start = numbered ? Number(line.match(/^\d+/)?.[0] ?? 1) : 1
      const entries: string[] = []
      const matches = (value: string) => numbered ? /^\d+\.\s+/.test(value) : /^-\s+/.test(value)
      while (i < lines.length && matches(lines[i].trim())) {
        entries.push(lines[i].trim().replace(/^(?:-\s+|\d+\.\s+)/, ''))
        i++
      }
      sections.push({ kind: 'list', numbered, start, entries })
      continue
    }
    const paragraph = [line]
    i++
    while (i < lines.length && lines[i].trim()
      && !/^(?:#{1,3}\s+|---+$|\|\s*|\d+\.\s+|-\s+)/.test(lines[i].trim())) {
      paragraph.push(lines[i].trim())
      i++
    }
    sections.push({ kind: 'paragraph', value: paragraph.join(' ') })
  }
  return sections
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part,
  )
}

function renderSection(block: Section, key: number) {
  if (block.kind === 'heading') {
    if (block.level === 1) return <h2 key={key}>{block.value}</h2>
    if (block.level === 2) return <h2 key={key}>{block.value}</h2>
    return <div key={key}>
      <h3>{block.value}</h3>
      {block.value === 'Read the place-value chart' ? <PlaceValuePreviewChart /> : null}
    </div>
  }
  if (block.kind === 'paragraph') return <p key={key}>{inline(block.value)}</p>
  if (block.kind === 'divider') return <hr key={key} />
  if (block.kind === 'table') return <div key={key} className={styles.tableWrap}>
    <table>
      <thead><tr>{block.rows[0].map((cell, i) => <th scope="col" key={i}>{inline(cell)}</th>)}</tr></thead>
      <tbody>{block.rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{inline(cell)}</td>)}</tr>)}</tbody>
    </table>
  </div>
  const items = block.entries.map((entry, i) => <li key={i}>{inline(entry)}</li>)
  return block.numbered ? <ol key={key} start={block.start}>{items}</ol> : <ul key={key}>{items}</ul>
}

const raw = readFileSync(join(process.cwd(),
  'content/curriculum/production/grade4-mathematics-whole-numbers-objective1.v3.learner.md'), 'utf8')
const sections = parseManuscript(raw)
// The chapter and subject labels are displayed in the page heading rather than
// duplicated at the start of the learner's authored manuscript.
const learnerContent = sections.slice(3)

export default function Grade4PlaceValueOpenPreviewPage() {
  return <main className={styles.shell}>
    <div className={styles.wrap}>
      <Link href="/learn?grade=Grade%204&subject=Mathematics" className={styles.back}>← Grade 4 Mathematics</Link>
      <article className={styles.paper}>
        <header className={styles.hero}>
          <div className={styles.kicker}>VibeSchool Originals · Grade 4 Mathematics · Numbers</div>
          <h1>Place Value and Total Value</h1>
          <p className={styles.lede}>Whole Numbers · Our first learning objective</p>
        </header>
        <p role="note" className={styles.previewNote}>
          Open learning preview. This original textbook section is available for reading and exploration
          while the full chapter completes publication review. Work on this page is not scored or saved.
        </p>
        <div className={styles.lesson}>{learnerContent.map(renderSection)}</div>
        <nav className={styles.buttonRow} aria-label="Continue studying">
          <Link className={styles.action} href="/student/vibelearn/topic-practice?subject=Mathematics&topic=Place%20Value%20%26%20Total%20Value">
            Practice Place Value →
          </Link>
          <Link className={styles.action + ' ' + styles.actionSecondary} href="/learn?grade=Grade%204&subject=Mathematics">
            Back to Mathematics
          </Link>
        </nav>
      </article>
    </div>
  </main>
}
