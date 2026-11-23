import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { miniRecommendationScore, rankMiniLessons } from '../lib/minis/recommendation.ts'

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const schema = read('supabase/migrations/20261123210000_mini_lessons_foundation_v1.sql')
const review = read('supabase/migrations/20261123210100_mini_lessons_review_and_abuse_limits.sql')
const actions = read('lib/minis/actions.ts')
const realExplore = read('components/public/MiniLiveExplore.tsx')
const explore = read('app/explore/page.tsx')
const home = read('components/public/MiniHomeSection.tsx')
const server = read('app/api/hq/minis/review/route.ts')

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
  "grant insert(creator_id,title,body,subject,cover_path,status)",
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
assert.ok(actions.includes("status: 'pending'") && actions.includes("upload(coverPath, photo") &&
  actions.includes("remove([coverPath])"),'submissions must be pending with private cover cleanup')
assert.ok(actions.includes("currentMiniUser()") && actions.includes("miniIsVerifiedAdult") &&
  actions.includes("global_profile_follows"),'canonical identity and adult feedback missing')
assert.ok(realExplore.includes('rankMiniLessons') && realExplore.includes('loadMiniCovers') &&
  realExplore.includes('loadApprovedComments') && realExplore.includes('submitMini'))
assert.ok(explore.includes("NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED === 'true'") &&
  home.includes("NEXT_PUBLIC_MINI_LESSONS_BACKEND_ENABLED === 'true'"),
  'new read/write backend must remain off until commissioned')
assert.ok(server.includes("MINI_LESSONS_REVIEW_ENABLED === 'true'") &&
  server.includes("getUser(bearer)") && server.includes("content.approve") &&
  server.includes("mini_review_item"),'moderation must stay staff-authenticated and separately gated')
console.log('PASS: Mini Lesson ranking fairness, relevance, authorization, private media, moderation and rollout guards')
