#!/usr/bin/env node
import fs from 'node:fs'

const path='supabase/migrations/20260818202000_student_one_full_journey_certification.sql'
const sql=fs.readFileSync(path,'utf8')
const norm=sql.replace(/\s+/g,' ').toLowerCase()

const requireText=(text,label)=>{
  if(!norm.includes(text.replace(/\s+/g,' ').toLowerCase())) throw new Error(`missing ${label}`)
}

requireText('create or replace function public.is_teacher_of_student(p_student_id uuid)','teacher relationship predicate')
requireText('public.is_parent_of_student(p_student_id)','parent canonical relationship authority')
requireText("position('receives_alerts' in v_def)>0",'notification preference regression guard')
requireText('public.is_teacher_of_student(p_student_id)','teacher canonical relationship authority')
requireText("from pg_attribute a join pg_class t",'pg_catalog identity health scan')
requireText("revoke all on function public.run_student_identity_health_check() from public, anon, authenticated",'health check service-only execution')
requireText("student_one_noncanonical_fk_count",'global student_id FK invariant')
requireText("student_identity_health_scan_not_catalog_safe",'instrumentation performance invariant')

if(norm.includes('where parent_id=v_parent and student_id=p_student_id and receives_alerts')) {
  throw new Error('notification preference may not authorize parent learner visibility')
}
if(/student_id\s*=\s*auth\.uid\(\)/i.test(sql)) {
  throw new Error('auth account UUID may not be compared directly to canonical student_id')
}

console.log('PASS: Student=1 full journey contract covers adult authority and production-safe identity instrumentation')
