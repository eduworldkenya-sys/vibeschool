#!/usr/bin/env node
import fs from 'node:fs'

const sql = fs.readFileSync('supabase/migrations/20260818184000_student_one_semantic_identity_closure.sql','utf8')
const n = sql.toLowerCase().replace(/\s+/g,' ')
const must = (s,label) => { if (!n.includes(s.toLowerCase().replace(/\s+/g,' '))) throw new Error(`missing ${label}`) }

must('foreign key(student_id) references public.students(id)', 'canonical student FK')
must('student_save_topic_note(text,text,text)', 'topic note writer repair')
must('v_student uuid:=public.current_student_id()', 'canonical note writer')
must('v_account uuid:=auth.uid()', 'revision workspace account identity')
must('viewer_id=v_account', 'account-scoped reading progress')
must('rename column student_id to viewer_id', 'telemetry semantic rename')
must('vibelearn_content_views_viewer_id_fkey', 'content-view account FK')
must('vibelearn_searches_viewer_id_fkey', 'search account FK')
must('student_one_noncanonical_student_id_fk_count', 'global student_id FK postcondition')

if (/vibelearn_content_views[^;]{0,300}student_id\s*=\s*\(select auth\.uid\(\)\)/is.test(sql)) throw new Error('content views still encode account UUID under student_id')
if (/student_topic_notes[^;]{0,500}student_id\s*=\s*\(select auth\.uid\(\)\)/is.test(sql)) throw new Error('topic notes still compare canonical student_id directly with auth.uid')

console.log('PASS: Student = 1 semantic identity closure distinguishes canonical learner state from account telemetry')
