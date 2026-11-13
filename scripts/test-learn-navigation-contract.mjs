import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')
const chrome = read('components/learn/LearnNavigation.tsx')
const publicNav = read('components/public/PublicBottomNav.tsx')
const library = read('components/learn/SchoolLearnLibrary.tsx')
const stories = read('components/originals/StoriesHub.tsx')
const book = read('components/originals/StoryBook.tsx')
const visuals = read('app/learn/visuals/page.tsx')
const courses = read('app/learn/[courseSlug]/page.tsx')

test('Learn discovery routes have one shared VibeSchool header and first-class reading', () => {
  assert.match(read('app/learn/layout.tsx'), /<LearnRouteShell>\{children\}<\/LearnRouteShell>/)
  assert.match(chrome, /vibeschool-wordmark\.svg/)
  assert.match(chrome, /href="\/" aria-label="VibeSchool website home"/)
  assert.match(chrome, /href="\/learn\?view=reading"/)
  assert.match(chrome, /href="\/learn\/stories"/)
  assert.match(chrome, /href="\/learn\?view=courses"/)
  assert.doesNotMatch(library, /<header className=\{styles\.topbar\}>/)
  assert.doesNotMatch(stories, /<header className=\{css\.header\}>/)
  assert.doesNotMatch(visuals, /<header className=\{learnStyles\.topbar\}>/)
  assert.match(stories, /id="main-content"/)
})

test('One bottom nav per Learn surface, using existing public or student navigation', () => {
  assert.match(chrome, /supabase\.rpc\('get_my_role'\)/)
  assert.match(chrome, /data === 'student'/)
  assert.match(chrome, /<StudentBottomNav\/>/)
  assert.match(chrome, /<PublicBottomNav forceVisible\/>/)
  assert.match(publicNav, /if \(!forceVisible && !PUBLIC_ROOTS\.has\(pathname\)\) return null/)
  assert.doesNotMatch(publicNav.split('const PUBLIC_ROOTS = ')[1].split('\n')[0], /'\/learn'/)
  assert.match(publicNav, /item\.href === '\/learn' && pathname\.startsWith\('\/learn\/'\)/)
  assert.doesNotMatch(courses, /<LearnBottomNav\s*\/>/)
  assert.match(chrome, /pathname !== '\/learn\/careers'/)
})

test('Chapter reading keeps its own focused controls and exits to this book', () => {
  assert.match(chrome, /isStoryReadingPath\(pathname\)/)
  assert.match(chrome, /!isStoryReadingPath\(pathname\)/)
  assert.match(book, /router\.push\(storyLandingHref\(id\)\)/)
  assert.match(book, /Save & Exit/)
  assert.match(book, /record_story_reading_progress/)
  assert.match(book, /data-story-block-id/)
  assert.match(book, /startAtChapterTopRef/)
  assert.doesNotMatch(book, /ContentBlockEditor|dangerouslySetInnerHTML/)
})
