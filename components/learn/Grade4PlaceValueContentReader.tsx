'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Calculator, ChevronRight } from 'lucide-react'
import type { ContentBlock } from '@/lib/publishTypes'
import UniversalLearnReader, { type UniversalLearnSection } from '@/components/learn/UniversalLearnReader'
import PlaceValuePreviewChart from '@/components/learn/PlaceValuePreviewChart'
import LearningNotebookPrompt from '@/components/learn/LearningNotebookPrompt'
import timeStyles from './Grade4TimeContentReader.module.css'
import styles from './Grade4PlaceValueContentReader.module.css'

type LessonSection = UniversalLearnSection & { items: ContentBlock[] }
type Props = { blocks: ContentBlock[]; publicationId: string; chapterId: string }

const normalize = (text: string) => text.trim().toLowerCase()
const isHeading = (block: ContentBlock, label: string) =>
  ['heading1', 'heading2', 'heading3'].includes(block.type) && normalize(block.content) === normalize(label)
const indexOfHeading = (blocks: readonly ContentBlock[], title: string) =>
  blocks.findIndex(block => isHeading(block, title))

/**
 * These are presentation boundaries in the already released first lesson, NOT
 * extra publication versions, newly generated claims or alternate curriculum.
 */
function lessonSections(blocks: ContentBlock[]): LessonSection[] {
  const intro = indexOfHeading(blocks, 'Introduction')
  const learn = indexOfHeading(blocks, 'What is Place Value?')
  const worked = indexOfHeading(blocks, 'Worked Example 1')
  const everyday = indexOfHeading(blocks, 'Whole numbers in everyday life')
  if (!(intro >= 0 && intro < learn && learn < worked && worked < everyday && everyday < blocks.length)) return []

  const groups = [
    { id: 'start', title: 'Start here', hint: 'Begin with a real-world number and think about each digit.', tone: 'learn', items: blocks.slice(intro, learn) },
    { id: 'learn', title: 'Learn and explore', hint: 'Read the explanation and investigate digits using a place-value chart.', tone: 'explore', items: blocks.slice(learn, worked) },
    { id: 'example', title: 'Worked example', hint: 'Try the question first, then reveal the published solution.', tone: 'example', items: blocks.slice(worked, everyday) },
    { id: 'apply', title: 'Use place value', hint: 'Connect the lesson to everyday quantities and explain what the digits mean.', tone: 'practice', items: blocks.slice(everyday) },
  ] as const
  return groups.map(group => ({ ...group, body: group.items.map(item => item.content).join('\n') }))
}

function displayBlocks(blocks: readonly ContentBlock[]): ReactNode[] {
  const nodes: ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type === 'numberedList' || block.type === 'bulletList') {
      const kind = block.type
      const same: ContentBlock[] = []
      while (i < blocks.length && blocks[i].type === kind) {
        same.push(blocks[i])
        i++
      }
      i--
      const listItems = same.map(item => <li key={item.id}>{item.content}</li>)
      nodes.push(kind === 'numberedList'
        ? <ol className={styles.list} key={block.id}>{listItems}</ol>
        : <ul className={styles.list} key={block.id}>{listItems}</ul>)
      continue
    }
    if (block.type === 'paragraph') {
      // Source is the *existing public published textbook RPC*. Its canonical
      // reader already renders these same released HTML paragraphs.
      nodes.push(<div className={styles.richText} key={block.id} dangerouslySetInnerHTML={{ __html: block.content }} />)
    } else if (block.type === 'heading1' || block.type === 'heading2') {
      nodes.push(<h3 className={styles.subheading} key={block.id}>{block.content}</h3>)
    } else if (block.type === 'heading3') {
      nodes.push(<h4 className={styles.smallHeading} key={block.id}>{block.content}</h4>)
    } else if (block.type === 'question') {
      nodes.push(<div className={styles.question} key={block.id}><strong>Think and try</strong><p>{block.content}</p></div>)
    } else if (block.type === 'divider') {
      nodes.push(<hr className={styles.rule} key={block.id}/>)
    } else if (block.content) {
      // Preserve non-text published block kinds instead of silently dropping them.
      nodes.push(<div className={styles.richText} key={block.id}>{block.content}</div>)
    }
  }
  return nodes
}

function PublishedBlocks({ items, worked = false }: { items: ContentBlock[]; worked?: boolean }) {
  const solutionAt = worked ? items.findIndex(item => isHeading(item, 'Solution')) : -1
  const before = solutionAt >= 0 ? items.slice(0, solutionAt) : items
  const solution = solutionAt >= 0 ? items.slice(solutionAt) : []
  return <div className={styles.blockBody}>
    {displayBlocks(before)}
    {solution.length > 0 && <details className={styles.answerReveal}>
      <summary>Show worked solution</summary>
      <div className={styles.answerBody}>{displayBlocks(solution)}</div>
    </details>}
  </div>
}

export default function Grade4PlaceValueContentReader({ blocks, publicationId, chapterId }: Props) {
  const [largeText, setLargeText] = useState(false)
  const sections = useMemo(() => lessonSections(blocks), [blocks])
  const outcomes = useMemo(() => {
    const start = indexOfHeading(blocks, 'Learning Outcomes')
    const end = indexOfHeading(blocks, 'Introduction')
    return start >= 0 && end > start
      ? blocks.slice(start + 1, end).filter(block => block.type === 'numberedList').map(block => block.content)
      : []
  }, [blocks])
  const chapterHref = `/read/textbook/${encodeURIComponent(publicationId)}/${encodeURIComponent(chapterId)}`
  const practiceHref = '/student/vibelearn/topic-practice?subject=Mathematics&topic=Place%20Value%20%26%20Total%20Value'

  // The server rejects incompatible released chapters before creating this view.
  if (!sections.length || !outcomes.length) return <main className={timeStyles.page}><p role="alert">This lesson is temporarily unavailable.</p></main>

  return <main className={timeStyles.page} style={{ color: '#163c2b', background: '#f5f9f6' }}>
    <div className={timeStyles.wrap}>
      <nav className={timeStyles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/learn">Learn</Link><ChevronRight size={15} aria-hidden="true"/>
        <Link href="/learn?grade=Grade+4&subject=Mathematics">Grade 4 Mathematics</Link>
        <ChevronRight size={15} aria-hidden="true"/><span aria-current="page">Place Value and Total Value</span>
      </nav>
      <header className={timeStyles.hero}>
        <div>
          <p className={timeStyles.kicker}>Grade 4 Mathematics · Numbers</p>
          <h1 className={timeStyles.heroTitle}>Place Value and Total Value</h1>
          <p className={timeStyles.heroDescription}>Discover what each digit means, use a place-value chart, and solve problems with whole numbers.</p>
        </div>
        <div className={timeStyles.subjectTag}><Calculator size={20} aria-hidden="true"/> Learn at your own pace</div>
      </header>

      <details className={timeStyles.lessonChooser}>
        <summary>Choose a lesson <span>(1 available)</span></summary>
        <nav className={timeStyles.lessonList} aria-label="Choose a Place Value lesson">
          <Link className={`${timeStyles.lessonButton} ${timeStyles.lessonButtonActive} ${styles.lessonCurrent}`} href="/learn/grade-4/mathematics/place-value" aria-current="page">
            <span className={timeStyles.lessonNumber}>1</span>
            <span><span className={timeStyles.lessonTitle}>Place Value and Total Value</span>
              <span className={timeStyles.lessonSmall}>Reading now</span></span>
          </Link>
        </nav>
      </details>

      <div className={timeStyles.contentArea}>
        <article className={`${timeStyles.article} ${largeText ? styles.largeType : ''}`} aria-labelledby="place-value-lesson-title">
          <header className={timeStyles.articleHead}>
            <div className={timeStyles.readerToolbar}>
              <p className={timeStyles.articleNum}>Lesson 1 of 1</p>
              <div className={timeStyles.textSettings} role="group" aria-label="Text size">
                <span>Text size</span>
                <button type="button" aria-label="Standard text size" aria-pressed={!largeText}
                  className={!largeText ? timeStyles.settingActive : ''} onClick={() => setLargeText(false)}>A</button>
                <button type="button" aria-label="Large text size" aria-pressed={largeText}
                  className={largeText ? timeStyles.settingActive : ''} onClick={() => setLargeText(true)}>A+</button>
              </div>
            </div>
            <h2 className={timeStyles.articleTitle} id="place-value-lesson-title">Place value and total value of digits up to 10,000</h2>
            <div className={timeStyles.goal}>
              <p className={timeStyles.goalLabel}>What you will learn</p>
              <ul className={styles.goalList}>{outcomes.map((outcome, index) => <li key={index}>{outcome}</li>)}</ul>
            </div>
          </header>

          <UniversalLearnReader
            subject="Mathematics"
            topic="place-value"
            anchorPrefix="place-value-section"
            sections={sections}
            showTeachingTools={false}
            renderBody={(_section, index) =>
              <PublishedBlocks items={sections[index].items} worked={sections[index].id === 'example'}/>}
            afterSection={(_section, index) =>
              sections[index].id === 'learn' ? <div className={styles.chartWrap}><PlaceValuePreviewChart/></div> : null}
          />
          <div className={timeStyles.articleBottom}>
            <LearningNotebookPrompt subject="Mathematics" stage="learn" compact />
            <nav className={timeStyles.lessonPager} aria-label="Continue learning">
              <Link className={timeStyles.pagerButton} href="/learn?grade=Grade+4&subject=Mathematics">Back to Mathematics <ArrowRight size={17} aria-hidden="true"/></Link>
              <Link className={`${timeStyles.pagerButton} ${timeStyles.pagerPrimary}`} href={practiceHref}>Practice Place Value <ArrowRight size={17} aria-hidden="true"/></Link>
            </nav>
            <p className={styles.fullReaderLink}><BookOpen size={16} aria-hidden="true"/>
              <Link href={chapterHref}>Read the full published topic</Link> to use chapter-level reading tools and saved progress. Lesson 1 alone does not mark the whole topic complete.
            </p>
          </div>
        </article>
      </div>
    </div>
  </main>
}
