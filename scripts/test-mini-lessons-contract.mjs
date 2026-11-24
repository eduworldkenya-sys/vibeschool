import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { miniRecommendationScore, rankMiniLessons } from '../lib/minis/recommendation.ts'
import { parseMiniHashtags, miniSubjectFromTags } from '../lib/minis/tags.ts'

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const schema = read('supabase/migrations/20261124044148_mini_lessons_foundation_v1.sql')
const review = read('supabase/migrations/20261124044153_mini_lessons_review_and_abuse_limits.sql')
const actions = read('lib/minis/actions.ts')
const realExplore = read('components/public/MiniLiveExplore.tsx')
const explore = read('app/explore/page.tsx')
const home = read('components/public/MiniHomeSection.tsx')
const safetyApi = read('app/api/minis/safety/route.ts')
const safetyDb = read('supabase/migrations/20261124072331_mini_open_creator_safety_scans.sql')
const oldHq = read('app/api/hq/minis/review/route.ts')

assert.deepEqual(parseMiniHashtags('#Mathematics #Fractions #Mathematics'),['mathematics','fractions'])
assert.deepEqual(parseMiniHashtags('  #Agriculture, #Maize '),['agriculture','maize'])
assert.equal(miniSubjectFromTags(['fractions','mathematics']),'Mathematics')
assert.equal(miniSubjectFromTags(['farming']),'General Knowledge')
for (const invalid of ['', '#', '#x', '#foo!', '#one #two #three #four #five #six', '#1234'])
  assert.throws(()=>parseMiniHashtags(invalid), 'invalid hashtag must be denied: '+invalid)
const basic = {
  id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  creator_id:'11111111-1111-4111-8111-111111111111',
  subject:'Mathematics',
  quality_score:80, like_count:0, save_count:0, learned_count:0,
  published_at:'2026-11-22T12:00:00Z'
}
const now = new Date('2026-11-23T12:00:00Z')
const another = {...basic,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',subject:'History'}
const interested = new Set(['Mathematics'])
assert.ok(miniRecommendationScore(basic,{interests:interested},now) >
  miniRecommendationScore(another,{interests:interested},now)+15)
assert.ok(miniRecommendationScore({...basic,save_count:7,learned_count:4},
    {interests:interested},now) >
  miniRecommendationScore(basic,{interests:interested},now))
assert.ok(miniRecommendationScore({...basic,quality_score:95},{},now) >
  miniRecommendationScore({...basic,quality_score:10},{},now))
assert.ok(miniRecommendationScore(basic,{dismissed:new Set([basic.id])},now)<0)
const ranked = rankMiniLessons([
  {...basic,id:'a',creator_id:'one',quality_score:100},
  {...basic,id:'b',creator_id:'one',quality_score:99},
  {...basic,id:'c',creator_id:'one',quality_score:98},
  {...basic,id:'d',creator_id:'two',quality_score:65},
],{},now)
assert.equal(ranked[2].creator_id,'two','Third consecutive post from same creator should be deferred')
assert.deepEqual(rankMiniLessons([basic,another],{dateKey:'2026-11-23'},now),
  rankMiniLessons([basic,another],{dateKey:'2026-11-23'},now),'ranking must be deterministic')
assert.doesNotMatch(read('lib/minis/recommendation.ts'),/watch_?time|user_location|age_group|gender|ethnicity/i)
for(const table of ['mini_lessons','mini_interactions','mini_learning_signals','mini_comments','mini_reports'])
  assert.ok(schema.includes('alter table public.'+table+' enable row level security'),
    'new table must enforce RLS: '+table)
for(const required of [
  "status in ('draft','pending')",
  "public.mini_creator_can_submit(creator_id)",
  "status='approved' and public.mini_creator_public",
  "p.date_of_birth <= current_date - interval '18 years'",
  "public.mini_adult_signal_allowed(user_id)",
  "status='pending'",
  "revoke all on public.mini_lessons from anon,authenticated",
  "grant insert(creator_id,title,body,subject,tags,quiz_question,quiz_options,quiz_correct,quiz_explanation,cover_path,status)",
  "public.mini_approved_comments",
  "public.mini_creator_public(m.creator_id)",
  "'mini-covers','mini-covers',false",
  "for insert to authenticated",
  "for delete to authenticated",
]) assert.ok(schema.includes(required),'schema missing mandatory authorization: '+required)
for(const required of [
  'mini_creator_can_submit','review',
  'mini_rate_limit', 'pg_advisory_xact_lock',
  "p_decision='approved'",
  "Creator cannot review their own Mini",
  "HQ content review authority denied",
  "grant execute on function public.mini_review_item",
  "to service_role",
  'hq_human_audit_log',
]) assert.ok(review.includes(required),'review contract missing: '+required)
assert.ok(schema.includes('public.mini_tags_valid(tags)') &&
  schema.includes('mini_optional_quiz_valid') &&
  schema.includes('using gin(tags)'),
  'valid hashtags and optional questions must have database constraints')
for (const [name,sql] of [['foundation',schema],['review',review]]) {
  assert.ok(!sql.includes('as $' + String.fromCharCode(10)),
    name+' has a malformed SQL dollar-quote delimiter')
  assert.ok(!sql.includes(String.fromCharCode(10)+'$;'),
    name+' has a malformed SQL dollar-quote terminator')
}
assert.ok(schema.includes('grant execute on function public.mini_tags_valid(text[]) to authenticated'),
  'authenticated clients must be allowed to satisfy the tag-check function')
assert.ok(!review.includes('p.date_of_birth is null'),
  'unknown-age creators must not bypass adult eligibility')
assert.ok(actions.includes('parseMiniHashtags') && actions.includes('quiz_question:question') &&
  realExplore.includes('popularTags') && realExplore.includes('miniTagLabel'),
  'hashtags must be wired to publication and discovery')
assert.ok(realExplore.includes('prepareMiniPhoto') && realExplore.includes('quizEnabled') &&
  realExplore.includes('current.quiz_question'),
  'real image editing and optional reader question must be present')
assert.ok(safetyApi.includes('quiz_explanation') && safetyApi.includes('quiz_options') &&
  safetyApi.includes("item.cover_path") && safetyApi.includes('moderate('),
  'automated safety must examine photo, explanation and optional question')
assert.ok(actions.includes("status: 'pending'") && actions.includes("upload(coverPath, photo") &&
  actions.includes("remove([coverPath])"),'submissions must be pending with private cover cleanup')
assert.ok(actions.includes("currentMiniUser()") && actions.includes("miniIsVerifiedAdult") &&
  actions.includes("global_profile_follows"),'canonical identity and adult feedback missing')
assert.ok(realExplore.includes('rankMiniLessons') && realExplore.includes('loadMiniCovers') &&
  realExplore.includes('loadApprovedComments') && realExplore.includes('submitMini'))
assert.ok(explore.includes("NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED === 'true'") &&
  home.includes("NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED === 'true'"),
  'new read/write backend must remain off until commissioned')
assert.ok(safetyApi.includes("MINI_LESSONS_OPEN_PUBLISHING_ENABLED") &&
  safetyApi.includes('getUser(bearer)') && safetyApi.includes('mini_safety_claim') &&
  safetyApi.includes("status:'pending'") === false && safetyApi.includes("'approved'") &&
  safetyApi.includes("MINI_GOOGLE_SAFETY_API_KEY") &&
  actions.includes("await publishMiniSafely('mini'") &&
  oldHq.includes('status:410'),
  'creator publishing must be automated, safety-gated and independent of HQ')
assert.ok(safetyDb.includes('enable row level security') &&
  safetyDb.includes("to service_role") &&
  safetyDb.includes('mini_report_safety_hold'), 'automated safety audit and community-report hold required')
console.log('PASS: Mini Lesson hashtags, photo editing, learning, ranking fairness, authorization, automated safety and rollout guards')
