#!/usr/bin/env node
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260818181500_student_one_content_learning_identity.sql','utf8')
const original = fs.readFileSync('supabase/migrations/20260809065137_engine_001_closed_learning_publishing_loop.sql','utf8')

const requireText = (text, label) => {
  if (!migration.includes(text)) throw new Error(`missing ${label}: ${text}`)
}

requireText('add column if not exists account_user_id uuid', 'account provenance column')
requireText('add column if not exists student_id uuid', 'reading canonical learner column')
requireText('references public.students(id) on delete set null', 'canonical student foreign key')
requireText('foreign key (account_user_id) references auth.users(id) on delete set null', 'account provenance foreign key')
requireText('v_student_id uuid := public.current_student_id()', 'server canonical learner resolver')
requireText("raise exception 'canonical learner identity required'", 'fail closed learner event RPC')
requireText('new.student_id is null', 'reading projection canonical learner gate')
requireText('e.student_id is not null and e.content_block_id is not null', 'content intelligence learner filter')
requireText("revoke insert on public.content_learning_events from authenticated", 'no direct client event minting')
requireText('account_user_id = (select auth.uid())', 'account-owned event read policy')

if (/values\s*\(\s*v_user\s*,/i.test(migration)) throw new Error('auth UUID may not be written into canonical student_id')
if (/values\s*\(\s*new\.viewer_id\s*,/i.test(migration)) throw new Error('viewer account UUID may not be projected into canonical student_id')
if (!original.includes('references auth.users(id)')) throw new Error('baseline regression fixture changed unexpectedly')

console.log('PASS: Student = 1 content-learning identity separates account provenance from canonical learner evidence')
