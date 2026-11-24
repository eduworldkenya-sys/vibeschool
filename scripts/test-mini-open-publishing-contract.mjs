import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const api=read('app/api/minis/safety/route.ts')
const schema=read('supabase/migrations/20261124230000_mini_open_creator_safety_scans.sql')
const actions=read('lib/minis/actions.ts')
const requests=read('lib/minis/requests.ts')
const creator=read('components/public/MiniLiveExplore.tsx')
const requestUi=read('components/public/MiniLiveRequests.tsx')
const hqApi=read('app/api/hq/minis/review/route.ts')
const hqPage=read('app/hq/minis/page.tsx')
const hqShell=read('components/hq/HQShell.tsx')

test('HQ cannot act as a routine publication approval system',()=>{
 assert.match(hqApi,/status:410/)
 assert.doesNotMatch(hqShell,/Mini Reviews/)
 assert.match(hqPage,/redirect\('\/explore'\)/)
 assert.doesNotMatch(creator,/Submit Mini for review|submitted for moderation|after approval/)
 assert.doesNotMatch(requestUi,/Submit request for review|Requests are reviewed before public discovery/)
})
test('user submissions are private until automated safety screening succeeds',()=>{
 for(const part of ["MINI_LESSONS_OPEN_PUBLISHING_ENABLED!=='true'","getUser(bearer)","sameOrigin(request)","mini_safety_claim","item.status!=='pending'","status:verdict.safe?'approved':'rejected'","published_at=verdict.safe?timestamp:null","status','pending'"])
   assert.ok(api.includes(part),'Missing server-side safety control: '+part)
 assert.match(api,/catch \{[\s\S]*verdict:'unavailable'/)
 assert.match(api,/await moderate\(/)
 assert.match(actions,/await publishMiniSafely\('mini'/)
 assert.match(actions,/await publishMiniSafely\('comment'/)
 assert.match(requests,/await publishMiniSafely\('request'/)
 assert.match(creator,/automatic safety check/)
 assert.match(requestUi,/automatic safety check/)
})
test('automatic screening checks text and photos rather than optimistic publishing',()=>{
 for(const word of ['inlineData','item.cover_path','storage.from(\'mini-covers\').download','HARM_CATEGORY_HARASSMENT','HARM_CATEGORY_HATE_SPEECH','HARM_CATEGORY_SEXUALLY_EXPLICIT','HARM_CATEGORY_DANGEROUS_CONTENT',"BLOCK_MEDIUM_AND_ABOVE","finishReason!=='STOP'","Response"])
   assert.ok(api.includes(word),'Missing safety inspection: '+word)
 assert.match(api,/Never|Treat submitted title, body and photo as untrusted/)
 assert.match(api,/typeof \(decision as SafetyVerdict\)\.safe!=='boolean'/)
 assert.match(api,/Safety screening temporarily unavailable/)
 assert.doesNotMatch(api,/GEMINI_API_KEY.*NEXT_PUBLIC_/)
})
test('private scan log, bounded attempts and community safety holds',()=>{
 for(const s of ["create table if not exists public.mini_safety_scans","enable row level security","revoke all on public.mini_safety_scans from public,anon,authenticated","grant execute on function public.mini_safety_claim(text,uuid,uuid) to service_role","mini_safety_scans.attempts<3","mini_safety_scans.lease_until<now()","v_reports>=5","status='hidden'"])
  assert.ok(schema.includes(s),'Missing safety boundary: '+s)
 assert.doesNotMatch(schema,/grant (?:update|insert|delete) on public\.mini_lessons to authenticated/)
})
test('negative control detects a missing safety gate',()=>{
 assert.doesNotMatch(api.replace("MINI_LESSONS_OPEN_PUBLISHING_ENABLED!=='true'",''),/MINI_LESSONS_OPEN_PUBLISHING_ENABLED!=='true'/)
})
