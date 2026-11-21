import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyContentReleasePreflight, runAuthorizedContentRelease } from './content-release-automation.mjs'

const E={scope:'Grade 4 Mathematics / Whole Numbers only',packageId:'VS-G04-MA-1.1-WHOLE-NUMBERS-20261120',publicationId:'6fc551d7-c9ae-4402-ac52-3d0a46461e87',publisherId:'c49bf987-357f-46bc-98fb-9a326882e437',outcomeCount:11,resourceCount:6,publicResourceCount:4,privateResourceCount:2,chapterBlockCount:59,assessmentItemCount:11,assessmentMarks:16,minimumApprovedAssessmentItems:6}
const ready=()=>({scope:E.scope,package_id:E.packageId,publication_id:E.publicationId,no_mutation_performed:true,status:'READY_TO_PUBLISH',blockers:['student_catalogue_publication_pending'],facts:{book_status:'draft',app_actor_attached_to_this_connection:true,official_source:{approved:1,artifacts:1,promoted_snapshots:1},outcomes:{mapped:11,active:11,locator_matches:11},resources:{total:6,verified_payload_hashes:6,certified:6,rights_cleared:6,pending_rights:0,active_roots:6,public_learnable:4,protected_sensitive:2},guide:{approved:1,source_blocks:59},assessment:{items:11,marks:16,approved_items:11},curriculum_gate:{state:'PASS'},release:{current_fingerprint_approvals:1,final_release_approvals:1,published_chapters:0,live_catalogue_rows:0}}})
const live=()=>{const p=ready();p.status='CATALOGUE_VISIBLE';p.blockers=[];p.facts.release.current_fingerprint_approvals=0;p.facts.book_status='published';p.facts.release.published_chapters=1;p.facts.release.live_catalogue_rows=1;return p}

test('exact verified draft reaches only a request to canonical publisher, not claimed live',()=>{
 const r=classifyContentReleasePreflight(ready(),E)
 assert.equal(r.state,'READY_TO_PUBLISH');assert.equal(r.learnerVisible,false)
})
test('independent evidence is checked even when a submitted blocker list is forged ready',()=>{
 for(const change of [
  p=>p.facts.official_source.approved=0,p=>p.facts.outcomes.active=0,p=>p.facts.resources.rights_cleared=0,
  p=>p.facts.resources.pending_rights=1,p=>p.facts.resources.certified=5,p=>p.facts.guide.approved=0,
  p=>p.facts.assessment.approved_items=0,p=>p.facts.release.current_fingerprint_approvals=0,
  p=>p.facts.curriculum_gate.state='BLOCKED',p=>p.facts.resources.protected_sensitive=0
 ]){const p=ready();change(p);assert.equal(classifyContentReleasePreflight(p,E).mayRequestCanonicalPublish,false)}
})
test('invalid scope, actor status, read-only identity or publication status blocks',()=>{
 for(const change of [
  p=>p.publication_id='another',p=>p.scope='another',p=>p.no_mutation_performed=false,
  p=>p.facts.app_actor_attached_to_this_connection=false,p=>p.facts.book_status='published',
  p=>p.status='RELEASE_VERIFIED',p=>p.blockers.push('teacher_guide_independent_approval_pending'),
  p=>p.blockers.push('student_catalogue_publication_pending')
 ]){const p=ready();change(p);assert.equal(classifyContentReleasePreflight(p,E).mayRequestCanonicalPublish,false)}
 assert.equal(classifyContentReleasePreflight(null,E).state,'BLOCKED')
})
test('catalogue verification requires published book, chapter, catalogue and exact fingerprint proof',()=>{
 assert.equal(classifyContentReleasePreflight(live(),E).state,'CATALOGUE_VERIFIED')
 const p=live();p.facts.release.live_catalogue_rows=0;assert.equal(classifyContentReleasePreflight(p,E).state,'BLOCKED')
})
test('never calls release RPC if preflight or signed publisher identity is invalid',async()=>{
 let calls=0
 const mock={auth:{getUser:async()=>({data:{user:{id:'different'}}})},rpc:async()=>{calls++;return {data:[{}]}}}
 const r=await runAuthorizedContentRelease({client:mock,loadPreflight:async()=>ready(),expected:E})
 assert.equal(r.reason,'publisher_identity_mismatch');assert.equal(calls,0)
 const p=ready();p.facts.resources.rights_cleared=0
 await runAuthorizedContentRelease({client:mock,loadPreflight:async()=>p,expected:E});assert.equal(calls,0)
})
test('canonical RPC denial stops; catalogue proof requires a fresh readback',async()=>{
 const mock={auth:{getUser:async()=>({data:{user:{id:E.publisherId}}})},rpc:async()=>({error:{message:'denied'}})}
 const r=await runAuthorizedContentRelease({client:mock,loadPreflight:async()=>ready(),expected:E})
 assert.equal(r.reason,'canonical_publish_rpc_failed')
 let seen=0
 mock.rpc=async()=>({data:[{publication_id:E.publicationId}]})
 const result=await runAuthorizedContentRelease({client:mock,loadPreflight:async()=>++seen===1?ready():live(),expected:E})
 assert.equal(result.state,'CATALOGUE_VERIFIED');assert.equal(seen,2)
 const stillDraft=await runAuthorizedContentRelease({client:mock,loadPreflight:async()=>ready(),expected:E})
 assert.equal(stillDraft.reason,'post_release_catalogue_not_verified')
})

test('post-release fingerprint differs solely due to lifecycle; historical review still required',()=>{
 const p=live()
 assert.equal(p.facts.release.current_fingerprint_approvals,0)
 assert.equal(classifyContentReleasePreflight(p,E).state,'CATALOGUE_VERIFIED')
 p.facts.release.final_release_approvals=0
 assert.equal(classifyContentReleasePreflight(p,E).state,'BLOCKED')
})
