import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path,'utf8')

test('Stories and Series is a first-class route within canonical Learn',()=>{
  assert.ok(existsSync('app/learn/stories/page.tsx'))
  assert.ok(existsSync('app/learn/stories/[id]/page.tsx'))
  assert.ok(existsSync('app/learn/stories/[id]/read/page.tsx'))
  assert.match(read('components/learn/LearnNavigation.tsx'),/href="\/learn\/stories"/, 'Stories link belongs to the unified Learn navigation')
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


const tarajiRoot = 'content/originals/taraji/'
const tarajiParts = ['your-way-forward-01.md','your-way-forward-02.md','your-way-forward-03.md']
const tarajiManuscript = () => tarajiParts.map(file=>read(tarajiRoot+file)).join('\n\n')
const chapterNumbers = source => [...source.matchAll(/^## Chapter ([0-9]+): (.+)$/gm)].map(match=>Number(match[1]))
const assertConsecutiveChapters = (source,expected) => {
  const numbers=chapterNumbers(source)
  assert.deepEqual(numbers,Array.from({length:expected},(_,i)=>i+1),
    'Published chapter order must be complete, distinct and consecutive')
}

test('Taraji has a complete original text-only 12-chapter narrative with continuous story arc',()=>{
  const story=tarajiManuscript()
  assertConsecutiveChapters(story,12)
  assert.ok(story.trim().endsWith('The end.'))
  assert.ok(story.split(/\s+/u).length>=6500,'Book One is not merely a book outline')
  assert.match(story,/Taraji/)
  assert.match(story,/Tuesday Table/)
  assert.match(story,/Grace/)
  assert.match(story,/Nuru/)
  assert.match(story,/Asha/)
  assert.match(story,/His name was Biko/,'Biko must have consistent character identity')
  assert.doesNotMatch(story,/Her name was Biko/)
  assert.doesNotMatch(story,/\bJean\b/,'Retired placeholder character name must not appear in the story')
  assert.doesNotMatch(story,/!\[[^\]]*\]\([^)]+\)/,'This edition is text-only, no illustrations')
})

test('CPA welcome companion is substantive, text-only and does not promise unofficial certification',()=>{
  const welcome=read(tarajiRoot+'welcome-to-your-cpa-student-life.md')
  assert.ok(welcome.split(/\s+/u).length>=1400,'Companion must contain actual reader guidance')
  assert.equal((welcome.match(/^## /gm)||[]).length,9)
  assert.match(welcome,/KASNEB/)
  assert.match(welcome,/official instructions/)
  assert.doesNotMatch(welcome,/!\[[^\]]*\]\([^)]+\)/)
  const metadata=read(tarajiRoot+'README.md')
  assert.match(metadata,/Canonical platform genre:\*\* `fiction`/)
  assert.match(metadata,/Canonical platform genre:\*\* `self_help`/)
  assert.match(metadata,/publication_release_approvals/)
  assert.match(metadata,/do not create a parallel store/)
})

test('Taraji publication integrity test detects missing or out-of-order chapters',()=>{
  assert.throws(()=>assertConsecutiveChapters('## Chapter 2: Missing beginning',2),/consecutive/)
  assert.throws(()=>assertConsecutiveChapters('## Chapter 1: First\n## Chapter 1: Duplicate',2),/consecutive/)
})


test('Noncurricular Originals use format-aware chapter checks without relaxing the academic release contract',()=>{
  const sql=read('supabase/migrations/20261115124500_originals_genre_release_quality.sql')
  assert.match(sql,/v_pub\.format='ebook'/)
  assert.match(sql,/v_pub\.genre in \('fiction','children','romance','thriller','biography','poetry','self_help'\)/)
  assert.match(sql,/not coalesce\(v_pub\.cbc_aligned,false\)/)
  assert.match(sql,/chapter_learning_outcome_links/)
  assert.match(sql,/v_pub\.cbc_subject/)
  assert.match(sql,/v_pub\.cbc_grade/)
  const start=sql.indexOf('if v_is_original then')
  const end=sql.indexOf('for ch in select vc.',start)
  assert.ok(start>0 && end>start)
  const fiction=sql.slice(start,end)
  for(const check of ['depth','chapter_structure','readable_blocks','block_identity','content_safety','word_count_accuracy','editorial_metadata','derivative_freshness'])
    assert.match(fiction,new RegExp("'"+check+"'"),'Missing fiction quality check: '+check)
  assert.equal((fiction.match(/\(p_publication_id,ch\.id,'/g)||[]).length,8,'Exactly eight chapter checks must preserve HQ owner approval contract')
  assert.match(fiction,/v_actual_words>=100/)
  assert.match(fiction,/v_distinct_ids=v_block_count/)
  assert.match(fiction,/v_distinct_numbers=v_total/)
  assert.match(fiction,/v_unsafe_blocks=0/)
  assert.match(fiction,/v_invalid_blocks=0/)
  assert.match(fiction,/rights_clearance|research_evidence|return query/)
  assert.match(sql,/if current_user not in \('service_role','postgres'\) and not public\.is_platform_owner\(\)/)
  const academy=sql.slice(end)
  for(const check of ['curriculum_outcomes','canonical_resource','teacher_guide','assessment','assessable_blocks','derivative_freshness'])
    assert.match(academy,new RegExp("'"+check+"'"),'Academic checks were unexpectedly removed: '+check)
  assert.doesNotMatch(sql,/update\s+public\.vibe_publications\s+set\s+status\s*=\s*'published'/i)
  assert.doesNotMatch(sql,/alter\s+table\s+.+disable\s+row\s+level\s+security/i)
})
