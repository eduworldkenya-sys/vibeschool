'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight, BookOpen, BookText, Calculator, ChevronRight, Clock3,
  FlaskConical, Globe2, GraduationCap, Languages, Layers3, LibraryBig,
  Music2, Palette, PencilLine, RefreshCw, School, Search, Sprout,
  Wrench, type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  SCHOOL_LEVELS, fallbackSubjectGroups, groupsForAvailableSubjects,
  levelForGrade, readersForSubject, recogniseLearnerGrade, subjectKey,
  type SchoolLevelId, type SubjectGroup,
} from '@/lib/learn/schoolCatalog'
import styles from './SchoolLearnLibrary.module.css'
import UnifiedLearnCollections from '@/components/learn/UnifiedLearnCollections'

type PublishedBook = {
  id: string
  title: string
  description: string | null
  cbc_grade: string | null
  cbc_subject: string | null
}

type RegisteredSubject = {
  subject_name: string
  pathway: string | null
  subject_kind: string | null
  effective_from: string | null
  effective_to: string | null
}

type Props = {
  mode?: 'public' | 'student'
  learnerGrade?: string | null
}

function IconForSubject({ name }: { name: string }) {
  const normalized = name.toLowerCase()
  let Icon: LucideIcon = BookOpen
  if (/math/.test(normalized)) Icon = Calculator
  else if (/english|language|kiswahili|french|german|arabic|mandarin|sign/.test(normalized)) Icon = Languages
  else if (/science|chemistry|biology|physics|technology/.test(normalized)) Icon = FlaskConical
  else if (/creative|art|music|dance|theatre|film/.test(normalized)) Icon = Palette
  else if (/agriculture|environment|home science/.test(normalized)) Icon = Sprout
  else if (/technical|mechanic|electricity|wood|metal|construction|aviation/.test(normalized)) Icon = Wrench
  else if (/social|history|geography|religious|citizenship/.test(normalized)) Icon = Globe2
  else if (/sports/.test(normalized)) Icon = Music2
  return <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
}

function subjectDescription(subject: string) {
  const key = subjectKey(subject)
  if (key.includes('math')) return 'Numbers, patterns and problem-solving'
  if (key.includes('english')) return 'Reading, writing and communication'
  if (key.includes('kiswahili')) return 'Lugha, kusoma na mawasiliano'
  if (key.includes('science') || key.includes('technology')) return 'Investigations and discoveries'
  if (key.includes('environment')) return 'Our surroundings and the environment'
  if (key.includes('agriculture')) return 'Plants, food and practical skills'
  if (key.includes('creative') || key.includes('arts')) return 'Movement, music, drawing and making'
  if (key.includes('technical')) return 'Technology, design and practical work'
  if (key.includes('social')) return 'People, communities and the world'
  return 'Lessons, learning activities and revision'
}

function gradeMatches(source: string | null, grade: string) {
  return source === grade || recogniseLearnerGrade(source) === grade
}

function uniqueNames(names: string[]) {
  const found = new Set<string>()
  return names.filter(name => {
    const key = subjectKey(name)
    if (found.has(key)) return false
    found.add(key)
    return true
  })
}

function buildUrl(path: string, grade: string, subject?: string) {
  const params = new URLSearchParams({ grade })
  if (subject) params.set('subject', subject)
  return `${path}?${params.toString()}`
}

function SchoolLearnLibraryContent({ mode = 'public', learnerGrade }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const basePath = '/learn'
  const collectionView = params.get('view') === 'reading' ? 'reading' : params.get('view') === 'courses' ? 'courses' : null
  const preferredGrade = recogniseLearnerGrade(learnerGrade) ?? 'Grade 4'
  const urlGrade = params.get('grade')
  const grade = SCHOOL_LEVELS.some(level =>
    (level.grades as readonly string[]).includes(urlGrade ?? '')
  ) ? urlGrade! : preferredGrade
  const selectedSubject = params.get('subject')
  const activeLevel: SchoolLevelId = levelForGrade(grade)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'lessons' | 'practice' | 'revision' | 'resources'>('lessons')
  const [books, setBooks] = useState<PublishedBook[]>([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [booksError, setBooksError] = useState(false)
  const [catalogueTruncated, setCatalogueTruncated] = useState(false)
  const [registeredSubjects, setRegisteredSubjects] = useState<string[] | null>(null)

  // Use the existing publication surface. RLS and published status determine access.
  // Paging avoids silently omitting everything beyond the old first-150-books limit.
  useEffect(() => {
    let active = true
    async function load() {
      const pageSize = 200
      const all: PublishedBook[] = []
      try {
        for (let page = 0; page < 25; page += 1) {
          const { data, error } = await supabase.from('vibe_publications')
            .select('id,title,description,cbc_grade,cbc_subject')
            .eq('status', 'published')
            .eq('format', 'vibetextbook')
            .order('title', { ascending: true })
            .order('id', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1)
          if (error) throw error
          if (!active) return
          const rows = (data ?? []) as PublishedBook[]
          all.push(...rows)
          if (rows.length < pageSize) break
          if (page === 24) setCatalogueTruncated(true)
        }
        if (active) setBooks(all)
      } catch {
        if (active) setBooksError(true)
      } finally {
        if (active) setBooksLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  // Public visitors are not granted direct table access. Signed-in learners
  // can read the existing effective-dated grade subject authority when allowed.
  useEffect(() => {
    let active = true
    setRegisteredSubjects(null)
    void (async () => {
      // /learn is public; signed-in learners may see their authorized grade
      // register without creating a second student-only catalogue.
      const auth = await supabase.auth.getUser()
      if (!active || !auth.data.user) return
      const { data, error } = await supabase.from('grade_subject_authority')
        .select('subject_name,pathway,subject_kind,effective_from,effective_to')
        .eq('grade', grade)
        .order('subject_name', { ascending: true })
      if (!active || error) return
      const today = new Date().toISOString().slice(0, 10)
      const current = ((data ?? []) as RegisteredSubject[])
        .filter(item => (!item.effective_from || item.effective_from <= today)
          && (!item.effective_to || item.effective_to >= today))
        .map(item => item.subject_name)
      setRegisteredSubjects(uniqueNames(current))
    })()
    return () => { active = false }
  }, [grade])

  useEffect(() => { setQuery(''); setTab('lessons') }, [grade, selectedSubject])

  const gradeBooks = useMemo(() => books.filter(book => gradeMatches(book.cbc_grade, grade)), [books, grade])
  const subjectGroups: SubjectGroup[] = useMemo(() => {
    const bookSubjects = uniqueNames(gradeBooks.map(book => book.cbc_subject?.trim() || '').filter(Boolean))
    const fromRegister = registeredSubjects && registeredSubjects.length ? registeredSubjects : null
    const base = fromRegister
      ? groupsForAvailableSubjects(grade, fromRegister)
      : fallbackSubjectGroups(grade)
    const existing = new Set(base.flatMap(group => group.subjects).map(subjectKey))
    const extraBooks = bookSubjects.filter(name => !existing.has(subjectKey(name)))
    return extraBooks.length
      ? [...base, { title: 'Additional published materials', subjects: extraBooks }]
      : base
  }, [grade, gradeBooks, registeredSubjects])
  const subjectNames = useMemo(() => uniqueNames(subjectGroups.flatMap(group => group.subjects)), [subjectGroups])
  const activeName = subjectNames.find(name => subjectKey(name) === subjectKey(selectedSubject))
  const activeBooks = gradeBooks.filter(book => subjectKey(book.cbc_subject) === subjectKey(activeName))
  const activeReaders = activeName ? readersForSubject(grade, activeName) : []
  const filteredGroups = subjectGroups.map(group => ({
    ...group,
    subjects: group.subjects.filter(name => {
      if (!query.trim()) return true
      const text = [name, subjectDescription(name), ...gradeBooks
        .filter(book => subjectKey(book.cbc_subject) === subjectKey(name))
        .map(book => `${book.title} ${book.description ?? ''}`)].join(' ').toLowerCase()
      return text.includes(query.trim().toLowerCase())
    }),
  })).filter(group => group.subjects.length)

  function changeGrade(nextGrade: string) {
    if (nextGrade === grade && !selectedSubject) return
    router.push(buildUrl(basePath, nextGrade))
  }
  function changeLevel(level: SchoolLevelId) {
    const nextGrade = SCHOOL_LEVELS.find(item => item.id === level)?.grades[0]
    if (nextGrade) changeGrade(nextGrade)
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topInner}>
          <Link className={styles.brand} href={basePath} aria-label="VibeSchool Learn home">
            <span className={styles.brandIcon} aria-hidden="true">V</span>
            <span><span className={styles.brandName}>VibeSchool <strong>Learn</strong></span><span className={styles.brandSub}>Your digital learning library</span></span>
          </Link>
          <nav className={styles.topLinks} aria-label="Learning navigation">
            <Link className={styles.topLink} href="/learn" aria-current={!collectionView ? 'page' : undefined}>School subjects</Link>
            <Link className={styles.topLink} href="/learn?view=reading" aria-current={collectionView === 'reading' ? 'page' : undefined}>All reading</Link>
            <Link className={styles.topLink} href="/learn?view=courses" aria-current={collectionView === 'courses' ? 'page' : undefined}>College & courses</Link>
            <Link className={styles.topLink} href="/student/study">My learning</Link>
          </nav>
        </div>
      </header>
      <div className={collectionView ? styles.collectionsFrame : styles.frame}>
        {!collectionView && <aside className={styles.sidebar} aria-label="School level navigation">
          <div className={styles.sidebarHeading}>Choose school level</div>
          <nav className={styles.levels} aria-label="Browse school levels">
            {SCHOOL_LEVELS.map(level => {
              const Icon = level.id === 'early' ? Sprout : level.id === 'primary' ? BookOpen : level.id === 'junior' ? School : level.id === 'senior' ? GraduationCap : Layers3
              return <button type="button" key={level.id} className={`${styles.levelButton} ${activeLevel === level.id ? styles.levelActive : ''}`}
                aria-current={activeLevel === level.id ? 'page' : undefined} onClick={() => changeLevel(level.id)}>
                <Icon size={17} aria-hidden="true" />{level.label}
              </button>
            })}
          </nav>
          <div className={styles.sidebarFoot}>
            <strong>Learn at your pace</strong>
            Open an approved lesson, study its examples and move straight to practice or revision.
          </div>
        </aside>}

        <main className={styles.main} id="main-content">
          {collectionView ? <UnifiedLearnCollections view={collectionView}/> : activeName ? (
            <>
              <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                <Link href={buildUrl(basePath, grade)}>{grade}</Link>
                <ChevronRight size={15} aria-hidden="true" />
                <span aria-current="page">{activeName}</span>
              </nav>
              <div className={styles.kicker}>Subject library · {grade}</div>
              <h1 className={styles.pageTitle}>{activeName}</h1>
              <p className={styles.description}>{subjectDescription(activeName)}. Choose a published lesson or textbook below.</p>
              <div className={styles.statsRow}>
                <div className={styles.stat}><strong>Study</strong><span>Explanations, worked examples and visual learning</span></div>
                <div className={styles.stat}><strong>Practise</strong><span>Guided questions and checking understanding</span></div>
                <div className={styles.stat}><strong>Revise</strong><span>Revisit concepts and review mistakes</span></div>
              </div>
              <div className={styles.gradeTabs} role="tablist" aria-label="Subject learning activities">
                {([
                  ['lessons', 'Learn', BookOpen],
                  ['practice', 'Practice', PencilLine],
                  ['revision', 'Revision', RefreshCw],
                  ['resources', 'Resources', LibraryBig],
                ] as const).map(([id, label, Icon]) =>
                  <button key={id} type="button" role="tab" aria-selected={tab === id}
                    className={`${styles.gradeButton} ${tab === id ? styles.gradeActive : ''}`}
                    onClick={() => setTab(id)}><Icon size={15} aria-hidden="true" /> {label}</button>
                )}
              </div>
              {tab === 'lessons' && <section role="tabpanel" aria-label="Lessons and textbooks">
                {activeReaders.length > 0 && <>
                  <div className={styles.sectionHead}><h2>Topics and lessons</h2><span>Existing lesson readers</span></div>
                  <div className={styles.resourceList}>{activeReaders.map(reader =>
                    <Link className={styles.resource} key={reader.href} href={reader.href}>
                      <span className={styles.resourceIcon}><Clock3 size={23} aria-hidden="true" /></span>
                      <span className={styles.resourceBody}><strong>{reader.title}</strong><p>{reader.subtitle}</p>
                        <span className={styles.resourceMeta}>Open lessons and learning activities</span></span>
                      <ChevronRight size={19} aria-hidden="true" />
                    </Link>
                  )}</div>
                </>}
                <div className={styles.sectionHead}><h2>Published textbooks</h2><span>{booksLoading ? 'Loading…' : `${activeBooks.length} available`}</span></div>
                {booksError && <div className={styles.alert} role="alert">The textbook catalogue could not load. Please try reloading this page.</div>}
                {booksLoading ? <div className={styles.empty} role="status">Loading published learning materials…</div> :
                  activeBooks.length ? <div className={styles.resourceList}>{activeBooks.map(book =>
                    <Link className={styles.resource} href={`/read/textbook/${encodeURIComponent(book.id)}`} key={book.id}>
                      <span className={styles.resourceIcon}><BookText size={23} aria-hidden="true" /></span>
                      <span className={styles.resourceBody}><strong>{book.title}</strong>
                        <p>{book.description || 'Open the published VibeSchool textbook.'}</p>
                        <span className={styles.resourceMeta}>Read textbook</span></span>
                      <ChevronRight size={19} aria-hidden="true" />
                    </Link>
                  )}</div> : <div className={styles.empty}>
                    {activeReaders.length
                      ? 'No additional published textbooks are listed for this subject. Use the available topic reader above.'
                      : 'No published lessons or textbooks are listed for this subject yet. You can choose another subject or check again after new material is released.'}
                  </div>}
              </section>}
              {tab === 'practice' && <section role="tabpanel" className={styles.detailPanel} aria-label="Practice options">
                <h2>Build confidence through practice</h2>
                <p className={styles.description}>Study the topic first, then answer verified questions and review explanations. Practice sets appear only when they are available in the existing question bank.</p>
                <div className={styles.linksRow}>
                  <Link className={styles.buttonPrimary} href="/student/vibelearn/topic-practice">Topic Practice <ArrowRight size={16} /></Link>
                  <Link className={styles.buttonSecondary} href="/student/vibelearn/exams">Exams</Link>
                </div>
                <p className={styles.notice}>Learner sign-in is required for attempts and results. Practice uses the existing verified question bank.</p>
                <p className={styles.tinyNote}>The practice hub is not yet filtered to this subject. It will only show its own verified available practice sets.</p>
              </section>}
              {tab === 'revision' && <section role="tabpanel" className={styles.detailPanel} aria-label="Revision options">
                <h2>Revise what you have learned</h2>
                <p className={styles.description}>Reopen explanations and practise difficult ideas. Your results and mistakes stay connected to your learner account.</p>
                <div className={styles.linksRow}>
                  <Link className={styles.buttonPrimary} href="/student/vibelearn/revision">Open Revision <ArrowRight size={16} /></Link>
                  <Link className={styles.buttonSecondary} href="/student/vibelearn/mistakes">Review mistakes</Link>
                </div>
                <p className={styles.notice}>Learner sign-in is required to open private revision history and mistakes.</p>
              </section>}
              {tab === 'resources' && <section role="tabpanel" className={styles.detailPanel} aria-label="Supporting resources">
                <h2>Learning resources</h2>
                <p className={styles.description}>Diagrams, illustrations, reading support and subject-specific activities appear inside published lesson readers. Only approved resources are displayed.</p>
                <div className={styles.linksRow}>
                  {activeReaders.map(reader => <Link className={styles.buttonSecondary} key={reader.href} href={reader.href}>Open {reader.title} <ArrowRight size={15} /></Link>)}
                  <Link className={styles.buttonSecondary} href="/student/resources">My shared learning materials <ArrowRight size={15} /></Link>
                  <Link className={styles.buttonSecondary} href="/learn/visuals">Visual learning library</Link>
                </div>
              </section>}
            </>
          ) : <>
            <div className={styles.intro}><div>
              <div className={styles.kicker}>One destination for your learning content</div>
              <h1 className={styles.pageTitle}>What would you like to learn?</h1>
              <p className={styles.description}>Choose your grade and subject to open released lessons, exercises and textbooks. Browse all published reading and courses from this same library.</p>
            </div></div>
            <nav className={styles.gradeTabs} aria-label="Choose grade">
              {SCHOOL_LEVELS.find(level => level.id === activeLevel)?.grades.map(item =>
                <button key={item} type="button" aria-current={item === grade ? 'page' : undefined}
                  className={`${styles.gradeButton} ${item === grade ? styles.gradeActive : ''}`}
                  onClick={() => changeGrade(item)}>{item}</button>)}
            </nav>
            <section className={styles.continueCard} aria-label="Start learning">
              <span className={styles.continueIcon}><BookOpen size={29} aria-hidden="true" /></span>
              <div className={styles.continueText}><strong>{grade} learning library</strong><span>Find approved lessons by subject, revisit textbooks and learn at your own pace.</span></div>
              <Link className={styles.buttonPrimary} href="/student/study">My learning <ArrowRight size={16} /></Link>
            </section>
            <nav className={styles.linksRow} aria-label="More learning destinations">
              <Link className={styles.buttonSecondary} href="/student/vibelearn/topic-practice">Topic Practice <ArrowRight size={15}/></Link>
              <Link className={styles.buttonSecondary} href="/student/vibelearn/revision">Revision <ArrowRight size={15}/></Link>
              <Link className={styles.buttonSecondary} href="/student/vibelearn/exams">Exams <ArrowRight size={15}/></Link>
              <Link className={styles.buttonSecondary} href="/student/tasks">My tasks <ArrowRight size={15}/></Link>
            </nav>
            <div className={styles.sectionHead}><h2>Subjects for {grade}</h2><span>{subjectNames.length} catalogue choices</span></div>
            <label className={styles.searchbox}><Search size={19} aria-hidden="true" />
              <input type="search" value={query} onChange={event => setQuery(event.target.value)}
                placeholder="Search subjects, topics or textbook titles…" aria-label="Search subjects and published books" />
            </label>
            {booksError && <div className={styles.alert} role="alert">Published textbooks could not be loaded. Subject browsing is still available, but book availability is incomplete.</div>}
            {filteredGroups.length ? filteredGroups.map((group, groupIndex) =>
              <section key={group.title} aria-label={group.title}>
                <div className={styles.sectionHead}><h2>{group.title}</h2><span>{group.subjects.length} subjects</span></div>
                <div className={styles.subjectGrid}>{group.subjects.map((name, index) => {
                  const count = gradeBooks.filter(book => subjectKey(book.cbc_subject) === subjectKey(name)).length
                  const readers = readersForSubject(grade, name).length
                  return <Link key={name} className={styles.subjectCard} href={buildUrl(basePath, grade, name)}>
                    <span className={`${styles.subjectIcon} ${styles[`tone${(index + groupIndex) % 6}`] ?? ''}`}><IconForSubject name={name}/></span>
                    <span className={styles.subjectName}>{name}</span>
                    <span className={styles.subjectDescription}>{subjectDescription(name)}</span>
                    {(count > 0 || readers > 0) && <span className={styles.subjectAvailability}>{count > 0 ? `${count} published book${count === 1 ? '' : 's'}` : 'Lesson reader available'} <ChevronRight size={13} style={{ verticalAlign: 'middle' }} /></span>}
                  </Link>
                })}</div>
              </section>) : <div className={styles.empty}>
              {query ? 'No subjects match your search. Try a different word.' :
                grade === 'Playgroup'
                  ? 'No nationally registered Playgroup subjects are available in this catalogue. Age-appropriate published resources will be listed when available.'
                  : 'No subject entries are available for this grade yet. Published textbooks will appear when catalogued.'}
            </div>}
            {activeLevel === 'senior' && <p className={styles.tinyNote}>Senior School subjects are organised by core choices and pathways. A learner’s school-selected combination determines which optional subjects apply; these are not all compulsory.</p>}
            {activeLevel === 'legacy' && <p className={styles.tinyNote}>Forms 1–4 use a separate legacy curriculum. The incomplete legacy subject register is not presented as a complete official subject list.</p>}
            {catalogueTruncated && <p className={styles.alert}>The published textbook catalogue is very large; not every result could be displayed in this view.</p>}
            <div className={styles.statsRow}>
              <div className={styles.stat}><strong>Learn</strong><span>Clear notes, worked examples and diagrams</span></div>
              <div className={styles.stat}><strong>Practice</strong><span>Questions, activities and explanations</span></div>
              <div className={styles.stat}><strong>Revise</strong><span>Review previous work and strengthen understanding</span></div>
            </div>
          </>}
        </main>
      </div>
    </div>
  )
}

export default function SchoolLearnLibrary(props: Props) {
  return <Suspense fallback={<main role="status" style={{ padding: 24 }}>Opening VibeSchool Learn…</main>}>
    <SchoolLearnLibraryContent {...props} />
  </Suspense>
}
