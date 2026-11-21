// Non-HQ content approval must not turn independent review into self-approval or publication.
// This static contract runs on the exact migration; SQL/RLS and runtime require separate verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20261121113548_content_independent_review_no_hq.sql','utf8');
const body=(name)=>{
 const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
 const offset=start>=0?start:sql.indexOf('create or replace function public.'+name+'(');
 assert.ok(offset>=0,'missing '+name);
 const next=sql.indexOf('\n\n',offset);
 return sql.slice(offset,next<0?undefined:next);
};
test('content approval is no longer tied to HQ owner or HQ screen',()=>{
  for(const name of ['hq_review_teacher_guide','hq_review_generated_assessment','hq_review_publication_release']){
    assert.match(sql,new RegExp('function public\\.'+name+'\\('));
  }
  assert.doesNotMatch(sql,/HQ platform owner required|public\.is_platform_owner\(\)|public\.hq_assert_owner\(/i);
  assert.match(sql,/ce_require_independent_content_approver/);
  assert.match(sql,/content\.approve/);
  assert.match(sql,/role in \('reviewer','partner_admin','hq_admin'\)/);
});
test('fail closed on anonymous, revoked, expired, suspended and author actors',()=>{
 for(const key of ['v_actor is null','hm.status=\'active\'','hm.revoked_at is null','hm.suspended_at is null','hm.access_expires_at>clock_timestamp()','AUTHOR_CANNOT_INDEPENDENTLY_APPROVE','v_actor=v_author','v_actor=p_created_by']){
  assert.ok(sql.includes(key),'missing authorization guard: '+key);
 }
 assert.match(sql,/CONTENT_APPROVER_AUTH_REQUIRED/);
 assert.match(sql,/REVIEWABLE_DRAFT_PUBLICATION_REQUIRED/);
 assert.match(sql,/INDEPENDENT_REVIEW_NOTE_REQUIRED/);
});
test('keep substantive QA and exact release fingerprint checks',()=>{
 for(const key of ['content_worker_teacher_guide_self_review','TEACHER_GUIDE_SOURCE_SCOPE_REQUIRED','missing_source','missing_answer','v_marks<>a.total_marks','publication_release_fingerprint','publication_release_checks_not_green','v_fingerprint','v_chapters','v_failures']){
  assert.ok(sql.includes(key),'missing release check: '+key);
 }
 assert.doesNotMatch(sql,/update public\.vibe_publications set status='published'|publish_publication\(/i);
});
test('review RPC privileges remain authenticated-only; helper not exposed',()=>{
 for(const fn of ['hq_review_teacher_guide','hq_review_generated_assessment','hq_review_publication_release']){
  const signature=fn+'(uuid,boolean,text)';
  assert.ok(sql.includes('grant execute on function public.'+signature+' to authenticated;'),fn+' grant');
  assert.ok(sql.includes('revoke all on function public.'+signature+' from public,anon,service_role;'),fn+' revoke');
 }
 assert.match(sql,/revoke all on function public\.ce_require_independent_content_approver\(uuid,uuid\)[\s\S]*from public,anon,authenticated,service_role/);
});
