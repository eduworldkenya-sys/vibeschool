#!/usr/bin/env node
import fs from 'node:fs'

const path='supabase/migrations/20260818205000_student_one_legacy_identity_recovery.sql'
const sql=fs.readFileSync(path,'utf8')
const norm=sql.replace(/\s+/g,' ').toLowerCase()
const req=(needle,label)=>{if(!norm.includes(needle.replace(/\s+/g,' ').toLowerCase()))throw new Error(`missing ${label}`)}

req('create table if not exists public.student_identity_recovery_cases','recovery ledger')
req("'legacy_missing_canonical_learner'",'legacy reason')
req("p.created_at < timestamptz '2026-08-16 15:32:38+00'",'pre-atomic scope')
req("'state','needs_student_identity'",'student onboarding guard')
req("'destination','/student/claim'",'canonical recovery route')
req("'recovery_required',true",'opaque recovery flag without service-only ledger read')
req('create or replace function public.resolve_student_identity_recovery_case()','automatic recovery resolution')
req('quarantined_student_profiles','health quarantine telemetry')
req("when v_wrong_fk>0 or v_missing_fk>0 or v_duplicates>0 or v_role_mismatch>0 or v_unquarantined>0 then 'blocked'",'fail-closed health state')
req('student_one_unquarantined_missing_identity','migration closure assertion')
req('revoke all privileges on table public.student_identity_recovery_cases from public, anon, authenticated','service-only recovery ledger')
req('resolved_student_id uuid references public.students(id) on delete restrict','resolved-case referential integrity')

if(/update\s+public\.students\s+set\s+profile_id/i.test(sql)) throw new Error('legacy recovery may not guess-link a roster learner')
if(/insert\s+into\s+public\.students/i.test(sql)) throw new Error('legacy recovery may not fabricate canonical learners')

const onboardingStart=norm.indexOf('create or replace function public.get_my_onboarding_state()')
const onboardingEnd=norm.indexOf('revoke all on function public.get_my_onboarding_state()',onboardingStart)
const onboarding=norm.slice(onboardingStart,onboardingEnd)
if(onboarding.includes('student_identity_recovery_cases')) throw new Error('authenticated onboarding must not read the service-only recovery ledger')

console.log('PASS: Student=1 legacy identities are quarantined, routed to claim, and auto-resolve only on canonical attachment')
