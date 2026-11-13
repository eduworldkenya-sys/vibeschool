import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path,'utf8')

test('Stories and Series is a first-class route within canonical Learn',()=>{
  assert.ok(existsSync('app/learn/stories/page.tsx'))
  assert.ok(existsSync('app/learn/stories/[id]/page.tsx'))
  assert.ok(existsSync('app/learn/stories/[id]/read/page.tsx'))
  assert.match(read('components/learn/SchoolLearnLibrary.tsx'),/href="\/learn\/stories"/)
  assert.match(read('components/learn/UnifiedLearnCollections.tsx'),/storyLandingHref\(publication\.id\)/)
  assert.match(read('app/global/read/publication/[id]/page.tsx'),/router\.replace\(storyLandingHref\(id\)\)/)
})

test('Story hub uses published content and a separate account-scoped reading shelf',()=>{
  const hub=read('components/originals/StoriesHub.tsx')
  assert.match(hub,/\.eq\('status','published'\)/)
  assert.match(hub,/\.in\('format',\['ebook','vibechronicles'\]\)/)
  assert.match(hub,/\.eq\('viewer_id',user\.id\)/)
  assert.match(hub,/\.from\('vibe_reading_progress'\)/)
  assert.match(hub,/series_name/)
  assert.match(hub,/storyReaderHref\(item\.story\.id,item\.chapter_id,true\)/)
  assert.doesNotMatch(hub,/f0d7477c|service_role|adminSupabase/)
})

test('Story reader resumes by block anchor and never uses editor chrome',()=>{
  const reader=read('components/originals/StoryBook.tsx')
  const util=read('lib/learn/storyPublications.ts')
  assert.match(reader,/data-story-block-id/)
  assert.match(reader,/reading_position\?\.block_id/)
  assert.match(reader,/record_story_reading_progress/)
  assert.match(reader,/window\.localStorage\.setItem\(GUEST_KEY\+id/)
  assert.match(reader,/document\.addEventListener\('visibilitychange'/)
  assert.match(reader,/className=\{css\.readingPaper\}/)
  assert.doesNotMatch(reader,/ContentBlockEditor|dangerouslySetInnerHTML/)
  assert.match(util,/isStoryPublication/)
  assert.match(util,/html\.replace\(/)
})

test('Fiction progress RPC preserves textbook entitlement and viewer identity isolation',()=>{
  const sql=read('supabase/migrations/20261113145500_originals_story_reading_progress.sql')
  assert.match(sql,/record_story_reading_progress/)
  assert.match(sql,/auth\.uid\(\)/)
  assert.match(sql,/coalesce\(v_publication\.pricing->>'type',''\) <> 'free'/)
  assert.match(sql,/v_chapter\.publication_id|publication_id=publication_id_input/)
  assert.match(sql,/block_not_found/)
  assert.match(sql,/completion_evidence_required/)
  assert.match(sql,/grant execute on function public\.record_story_reading_progress/)
  assert.doesNotMatch(sql,/alter table public\.vibe_reading_progress disable row level security/)
  assert.doesNotMatch(sql,/create or replace function public\.can_viewer_read_chapter/)
})

test('Simple reader fixes do not create a second reading system or extra gates',()=>{
  const hub=read('components/originals/StoriesHub.tsx')
  const reader=read('components/originals/StoryBook.tsx')
  const util=read('lib/learn/storyPublications.ts')
  const migration=read('supabase/migrations/20261113173000_originals_current_resume_anchor.sql')
  assert.match(hub,/window\.localStorage\.getItem\(STORY_GUEST_KEY\+story\.id\)/, 'Guests see their saved books in the same shelf')
  assert.match(hub,/Saved on this device/, 'Guest shelf must not claim cloud sync')
  assert.match(hub,/orderSeriesBooks\(visible\)/, 'Series must follow book number rather than new releases')
  assert.match(reader,/startAtChapterTopRef/, 'Selecting a chapter opens its beginning')
  assert.match(reader,/Next Book:/, 'Finished books can lead into their series')
  assert.match(util,/export function orderSeriesBooks/, 'One common series ordering rule')
  assert.match(migration,/v_new_position := position_input/, 'Return to most recently read paragraph even when rereading')
  assert.match(migration,/v_new_percent := greatest/, 'Completion history stays intact')
  assert.doesNotMatch(migration,/create table|drop table|alter table .* disable row level security/i)
})
