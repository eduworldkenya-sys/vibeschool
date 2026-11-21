import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const source = readFileSync('supabase/migrations/20261121160639_qualified_machine_content_review_no_human_hq.sql','utf8')
const block=(begin,end)=> {
 const s=source.indexOf(begin),e=source.indexOf(end,s+begin.length)
 assert.ok(s>=0 && e>s,'expected function section: '+begin)
 return source.slice(s,e)
}
test('no reviewer is silently created, promoted, or given an HQ human identity',()=>{
 assert.match(source,/create table if not exists public\.ce_machine_content_commissions/)
 assert.match(source,/reviewer_user_id uuid not null references auth\.users/)
 assert.match(source,/commissioned_by uuid not null references auth\.users/)
 assert.match(source,/MACHINE_REVIEW_REAL_AUTH_IDENTITY_REQUIRED/)
 assert.match(source,/MACHINE_REVIEW_INDEPENDENT_IDENTITY_REQUIRED/)
 assert.match(source,/MACHINE_REVIEW_SUBJECT_QUALIFICATION_MISMATCH/)
 assert.match(source,/MACHINE_REVIEW_COMMISSION_OWNER_AUTH_REQUIRED/)
 assert.match(source,/expires_at<=commissioned_at\+interval '30 days'/)
 assert.match(source,/ce_revoke_machine_content_reviewer/)
 assert.doesNotMatch(source,/insert into (?:auth\.users|public\.hq_human_members)/i)
 assert.doesNotMatch(source,/set_config\s*\(\s*['"]request\.jwt/i)
})
test('machine cannot self-approve without exact independent fresh service-issued receipt',()=>{
 const helper=block('create or replace function public.ce_require_machine_review_receipt(', 'create or replace function public.ce_commission_machine_content_reviewer(')
 for(const s of ["v_reviewer is null","v_reviewer=v_author","c.revoked_at is null","c.expires_at>clock_timestamp()","e.content_sha256=p_hash","p_stage=any(c.stages)","e.quality_score>=85","e.hard_blockers='[]'::jsonb","interval '24 hours'","INDEPENDENT_MACHINE_REVIEW_RECEIPT_REQUIRED"])assert.ok(helper.includes(s),s)
 const ingestion=block('create or replace function public.ce_record_machine_content_review(', '-- Owner can stop a reviewer')
 for(const s of ["MACHINE_REVIEW_TEACHER_GUIDE_HASH_MISMATCH","MACHINE_REVIEW_ASSESSMENT_HASH_MISMATCH","MACHINE_REVIEW_EXACT_RELEASE_FINGERPRINT_REQUIRED","MACHINE_REVIEW_OFFICIAL_SOURCE_EVIDENCE_REQUIRED","MACHINE_REVIEW_RESOURCE_VERSION_PROOF_REQUIRED","MACHINE_REVIEW_INDEPENDENT_QUALITY_EVIDENCE_REQUIRED"])assert.ok(ingestion.includes(s),s)
 assert.match(source,/grant execute on function public\.ce_record_machine_content_review\([\s\S]*?to service_role;/)
 assert.match(source,/revoke all on public\.ce_machine_content_review_receipts from public,anon,authenticated,service_role/)
})
test('all three canonical content approvals accept machine receipts, not an unconditional bypass',()=>{
 const human=block('create or replace function public.ce_require_independent_content_approver(', 'CREATE OR REPLACE FUNCTION public.hq_review_teacher_guide(')
 assert.match(human,/ce_is_human_content_approver\(v_actor\)/)
 assert.match(human,/public\.ce_machine_content_commissions c/)
 assert.match(human,/CONTENT_APPROVER_AUTH_REQUIRED/)
 assert.match(human,/AUTHOR_CANNOT_INDEPENDENTLY_APPROVE/)
 for(const [start,end,stage] of [
 ['CREATE OR REPLACE FUNCTION public.hq_review_teacher_guide(','CREATE OR REPLACE FUNCTION public.hq_review_generated_assessment(', 'teacher_guide'],
 ['CREATE OR REPLACE FUNCTION public.hq_review_generated_assessment(','CREATE OR REPLACE FUNCTION public.hq_review_publication_release(', 'assessment'],
 ['CREATE OR REPLACE FUNCTION public.hq_review_publication_release(','-- Owner can stop a reviewer', 'release']
 ]){
 const fn=block(start,end)
 assert.ok(fn.includes('public.ce_require_independent_content_approver('))
 assert.ok(fn.includes('public.ce_require_machine_review_receipt('))
 assert.ok(fn.includes("'"+stage+"'"))
 assert.ok(fn.includes("MACHINE_REJECTION_REQUIRES_INDEPENDENT_NEGATIVE_REVIEW"))
 assert.ok(fn.includes("not coalesce(p_approve,false)"),"NULL machine rejection must also fail closed")
 }
})
test('KICD is an official reference, not KICD officer endorsement',()=>{
 const fn=block('create or replace function public.curriculum_authority_register_source(', '-- Canonical certification still requires')
 assert.match(fn,/https:\/\/kicd\[\.\]ac\[\.\]ke/)
 assert.match(fn,/KICD_OFFICIAL_SOURCE_EVIDENCE_REQUIRED/)
 assert.match(fn,/external_kicd_endorsement',false/)
 assert.match(fn,/public\.hq_assert_owner\(\)/)
 assert.match(fn,/SOURCE_MACHINE_REVIEW_SINGLE_PUBLICATION_SCOPE_REQUIRED/)
 assert.match(fn,/public\.ce_require_machine_review_receipt/)
 assert.match(fn,/public\.curriculum_authority_sources/)
 assert.doesNotMatch(fn,/set source_status='approved' where/i)
})
test('resource certification requires the same canonical lifecycle with machine evidence',()=>{
 const fn=block('create or replace function public.cla_certify_learning_resource_version(', 'revoke all on function public.curriculum_authority_register_source(')
 for(const s of ["v_version.lifecycle_status <> 'verified'","CLA_INDEPENDENT_VERIFICATION_REQUIRED","CLA_RIGHTS_CLEARANCE_REQUIRED","CLA_CERTIFIED_VERSION_ALREADY_EXISTS","CLA_MACHINE_RESOURCE_PUBLICATION_SCOPE_REQUIRED","public.ce_require_machine_review_receipt(","'resource_certification'"]) assert.ok(fn.includes(s),s)
 assert.match(source,/revoke all on function public\.cla_certify_learning_resource_version/)
 assert.doesNotMatch(source,/create or replace function public\.publish_publication/)
})
test('migration remains noncommissioning and permits no client grants or unsafe publication',()=>{
 assert.match(source,/^begin;\n/m)
 assert.match(source,/\ncommit;\s*$/)
 assert.doesNotMatch(source,/^insert into public\.ce_machine_content_commissions\s*\(/im)
 assert.doesNotMatch(source,/^insert into public\.publication_release_approvals\s*\(/im)
 assert.doesNotMatch(source,/update\s+public\.vibe_publications\s+set\s+status\s*=\s*'published'/i)
 assert.doesNotMatch(source,/disable\s+trigger|alter\s+table\s+.*disable\s+row\s+level\s+security|grant\s+all\s+on/i)
 assert.ok((source.match(/\$\$;/g)||[]).length>=7,'complete SQL function delimiters')
})
