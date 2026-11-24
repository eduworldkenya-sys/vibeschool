'use client'
import { POST_SECONDARY_PUBLIC_ENABLED } from '@/lib/learner/learning-levels'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight, BookOpen, Calculator, ChevronRight,
  FlaskConical, Globe2, GraduationCap, Languages, Layers3, LibraryBig,
  Music2, Palette, School, Search, Sprout,
  Wrench, type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  SCHOOL_LEVELS, groupsForTextbookShells,
  levelForGrade, readersForSubject, recogniseLearnerGrade, subjectKey,
  type SchoolLevelId, type SubjectGroup,
} from '@/lib/learn/schoolCatalog'
import styles from './SchoolLearnLibrary.module.css'
import UnifiedLearnCollections from '@/components/learn/UnifiedLearnCollections'
import SubjectTextbookOutline from '@/components/learn/SubjectTextbookOutline'
import CertifiedResourceLinks from '@/components/learn/CertifiedResourceLinks'

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

/** Keep the published CRE identity, but present one Religious Education entry
 * in Learn for Grades 4 and 5. IRE/HRE retain separate subject identities. */
function isCreLearnAlias(grade: string, subject?: string | null) {
  return (grade === 'Grade 4' || grade === 'Grade 5') &&
    ['religiouseducation', 'christianreligiouseducation'].includes(subjectKey(subject))
}

function sameLearnSubject(grade: string, a?: string | null, b?: string | null) {
  return subjectKey(a) === subjectKey(b) || (isCreLearnAlias(grade, a) && isCreLearnAlias(grade, b))
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
  const collectionView = params.get('view') === 'reading' ? 'reading' : POST_SECONDARY_PUBLIC_ENABLED && params.get('view') === 'courses' ? 'courses' : null
  const preferredGrade = recogniseLearnerGrade(learnerGrade) ?? 'Grade 4'
  const urlGrade = params.get('grade')
  const grade = SCHOOL_LEVELS.some(level =>
    (level.grades as readonly string[]).includes(urlGrade ?? '')
  ) ? urlGrade! : preferredGrade
  const selectedSubject = params.get('subject')
  const activeLevel: SchoolLevelId = levelForGrade(grade)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'lessons' | 'resources'>('lessons')
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

  // Public catalogue metadata is isolated from draft, teacher and learner data.
  useEffect(() => {
    let active = true
    setRegisteredSubjects(null)
    void (async () => {
      const {data:metadata,error:metadataError} = await supabase.rpc('get_school_textbook_shell_metadata',{p_grade:grade})
      if (!active) return
      if (!metadataError && metadata && Array.isArray(metadata.subjects)) {
        setRegisteredSubjects(uniqueNames(metadata.subjects.filter((name:unknown): name is string=>typeof name==='string' && !!name.trim())))
        return
      }
      // Compatibility while the additive database migration is rolling out.
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
    })().catch(()=>undefined)
    return () => { active = false }
  }, [grade])

  useEffect(() => { setQuery(''); setTab('lessons') }, [grade, selectedSubject])

  const gradeBooks = useMemo(() => books.filter(book => gradeMatches(book.cbc_grade, grade)), [books, grade])
  const subjectGroups: SubjectGroup[] = useMemo(() => {
    const bookSubjects = uniqueNames(gradeBooks.map(book => book.cbc_subject?.trim() || '').filter(Boolean))
    const seenSubjects = new Set<string>()
    const base = groupsForTextbookShells(grade, registeredSubjects ?? [])
      .map(group => ({ ...group, subjects: group.subjects
        .map(name => isCreLearnAlias(grade, name) ? 'Religious Education' : name)
        .filter(name => {
          const key = subjectKey(name)
          if (seenSubjects.has(key)) return false
          seenSubjects.add(key)
          return true
        }) }))
      .filter(group => group.subjects.length)
    const existing = new Set(base.flatMap(group => group.subjects).map(subjectKey))
    const extraBooks = bookSubjects
      .map(name => isCreLearnAlias(grade, name) ? 'Religious Education' : name)
      .filter(name => !existing.has(subjectKey(name)))
    return extraBooks.length
      ? [...base, { title: 'Additional published materials', subjects: uniqueNames(extraBooks) }]
      : base
  }, [grade, gradeBooks, registeredSubjects])
  const subjectNames = useMemo(() => uniqueNames(subjectGroups.flatMap(group => group.subjects)), [subjectGroups])
  const requestedSubject = isCreLearnAlias(grade, selectedSubject) ? 'Religious Education' : selectedSubject
  const activeName = subjectNames.find(name => sameLearnSubject(grade, name, requestedSubject))
  const curriculumSubject = isCreLearnAlias(grade, activeName) ? 'Christian Religious Education' : activeName
  const activeBooks = gradeBooks.filter(book => sameLearnSubject(grade, book.cbc_subject, activeName))
  const activeReaders = activeName ? readersForSubject(grade,
    isCreLearnAlias(grade, activeName) ? 'Christian Religious Education' : activeName) : []
  // Reuse the existing reader catalogue so the released pilot is discoverable
  // from Learn itself without a duplicate lesson or publication record.
  const grade4MathsLesson = grade === 'Grade 4'
    ? readersForSubject(grade, 'Mathematics').find(reader => reader.href === '/learn/grade-4/mathematics/place-value')
    : undefined
  const filteredGroups = subjectGroups.map(group => ({
    ...group,
    subjects: group.subjects.filter(name => {
      if (!query.trim()) return true
      const text = [name, subjectDescription(name), ...gradeBooks
        .filter(book => sameLearnSubject(grade, book.cbc_subject, name))
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
      <div className={collectionView || activeName ? styles.collectionsFrame : styles.frame}>
        {!collectionView && !activeName && <aside className={styles.sidebar} aria-label="School level navigation">
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
              <div className={styles.gradeTabs} role="tablist" aria-label="Subject learning activities">
                {([['lessons','Book',BookOpen],['resources','Resources',LibraryBig]] as const).map(([id,label,Icon]) =>
                  <button key={id} type="button" role="tab" aria-selected={tab === id}
                    className={`${styles.gradeButton} ${tab === id ? styles.gradeActive : ''}`}
                    onClick={() => setTab(id)}><Icon size={15} aria-hidden="true"/> {label}</button>)}
              </div>
              {tab === 'lessons' && <section role="tabpanel" aria-label="Textbook">
                {activeReaders.length > 0 && <section className={styles.detailPanel} aria-label="Available subject lessons">
                  <h2>Lessons</h2>
                  <div className={styles.resourceList}>
                    {activeReaders.map(reader => <Link className={styles.resource} key={reader.href} href={reader.href}>
                      <span className={styles.resourceIcon}><BookOpen size={21} aria-hidden="true"/></span>
                      <span className={styles.resourceBody}>
                        <strong>{reader.title}</strong>
                        <p>{reader.subtitle}</p>
                      </span>
                      <ChevronRight size={18} aria-hidden="true"/>
                    </Link>)}
                  </div>
                </section>}
                <SubjectTextbookOutline grade={grade} subject={activeName} curriculumSubject={curriculumSubject ?? activeName}
                  books={activeBooks.map(book => ({id:book.id,title:book.title,href:`/read/textbook/${encodeURIComponent(book.id)}`}))}
                  readers={activeReaders} booksLoading={booksLoading} booksError={booksError || catalogueTruncated}/>
                <div className={styles.linksRow}>
                  <Link className={styles.buttonSecondary} aria-label="Finished learning? Practise this subject" href={'/student/vibelearn/topic-practice?' + new URLSearchParams({subject:curriculumSubject ?? activeName}).toString()}>Practise <ArrowRight size={16}/></Link>
                </div>
              </section>}
              {tab === 'resources' && <section role="tabpanel" className={styles.detailPanel} aria-label="Supporting resources">
                <h2>Learning resources</h2>
                <p className={styles.description}>Diagrams, illustrations, reading support and subject-specific activities appear inside published lesson readers. Only approved resources are displayed.</p>
                <CertifiedResourceLinks grade={grade} subject={curriculumSubject ?? activeName}/>
                <div className={styles.linksRow}>
                  {activeReaders.map(reader => <Link className={styles.buttonSecondary} key={reader.href} href={reader.href}>Open {reader.title} <ArrowRight size={15} /></Link>)}
                  <Link className={styles.buttonSecondary} href="/student/resources">My shared learning materials <ArrowRight size={15} /></Link>
                  <Link className={styles.buttonSecondary} href={'/learn/visuals?' + new URLSearchParams({grade, subject:curriculumSubject ?? activeName}).toString()}>Visual learning library <ArrowRight size={15}/></Link>
                </div>
              </section>}
            </>
          ) : <>
            <div className={styles.intro}><div>
              <div className={styles.kicker}>One destination for your learning content</div>
              <h1 className={styles.pageTitle}>What would you like to learn?</h1>
              <p className={styles.description}>Choose your grade and subject to open released lessons, exercises and textbooks. Browse published reading from this same library.</p>
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
            {grade4MathsLesson && <section className={styles.continueCard} aria-label="Grade 4 Mathematics available lesson">
              <span className={styles.continueIcon}><Calculator size={28} aria-hidden="true"/></span>
              <div className={styles.continueText}>
                <strong>Mathematics · Lesson 1: {grade4MathsLesson.title}</strong>
                <span>Learn place value, explore the interactive chart and move into practice.</span>
              </div>
              <Link className={styles.buttonPrimary} href={grade4MathsLesson.href}>Open Lesson 1 <ArrowRight size={16}/></Link>
            </section>}
            <nav className={styles.linksRow} aria-label="Continue to Practice">
              <Link className={styles.buttonSecondary} href="/student/vibelearn/topic-practice">Already learned a topic? Open Practice <ArrowRight size={15}/></Link>
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
                  const count = gradeBooks.filter(book => sameLearnSubject(grade, book.cbc_subject, name)).length
                  const readers = readersForSubject(grade, name).length
                  return <Link key={name} className={styles.subjectCard} href={buildUrl(basePath, grade, name)}>
                    <span className={`${styles.subjectIcon} ${styles[`tone${(index + groupIndex) % 6}`] ?? ''}`}><IconForSubject name={name}/></span>
                    <span className={styles.subjectName}>{name}</span>
                    <span className={styles.subjectDescription}>{subjectDescription(name)}</span>
                    <span className={styles.subjectAvailability}>{count > 0 || readers > 0 ? 'Read textbook' : 'View textbook'} <ChevronRight size={13} style={{ verticalAlign: 'middle' }} /></span>
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
              <div className={styles.stat}><strong>Explore</strong><span>Interactive demonstrations and visual aids</span></div>
              <div className={styles.stat}><strong>Read</strong><span>Published books, stories and reading support</span></div>
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
