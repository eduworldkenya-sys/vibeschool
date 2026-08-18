#!/usr/bin/env node
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260818181500_student_one_content_learning_identity.sql','utf8')
const original = fs.readFileSync('supabase/migrations/20260809065137_engine_001_closed_learning_publishing_loop.sql','utf8')
const normalized = migration.toLowerCase().replace(/\s+/g, ' ')

const requireText = (text, label) => {
  if (!normalized.includes(text.toLowerCase().replace(/\s+/g, ' '))) {
    throw new Error(`missing ${label}: ${text}`)
  }
}
const requireRegex = (pattern, label) => {
  if (!pattern.test(migration)) throw new Error(`missing ${label}: ${pattern}`)
}

requireText('add column if not exists account_user_id uuid', 'account provenance column')
requireText('add column if not exists student_id uuid', 'reading canonical learner column')
requireRegex(/foreign\s+key\s*\(student_id\)\s+references\s+public\.students\s*\(id\)\s+on\s+delete\s+set\s+null/i, 'canonical student foreign key')
requireRegex(/foreign\s+key\s*\(account_user_id\)\s+references\s+auth\.users\s*\(id\)\s+on\s+delete\s+set\s+null/i, 'account provenance foreign key')
requireRegex(/v_student_id\s+uuid\s*:=\s*public\.current_student_id\(\)/i, 'server canonical learner resolver')
requireText("raise exception 'canonical learner identity required'", 'fail closed learner event RPC')
requireText('new.student_id is null', 'reading projection canonical learner gate')
requireText('e.student_id is not null and e.content_block_id is not null', 'content intelligence learner filter')
requireText('revoke insert on public.content_learning_events from authenticated', 'no direct client event minting')
requireRegex(/account_user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i, 'account-owned event read policy')

if (/values\s*\(\s*v_user\s*,/i.test(migration)) throw new Error('auth UUID may not be written into canonical student_id')
if (/values\s*\(\s*new\.viewer_id\s*,/i.test(migration)) throw new Error('viewer account UUID may not be projected into canonical student_id')
if (!original.includes('references auth.users(id)')) throw new Error('baseline regression fixture changed unexpectedly')

console.log('PASS: Student = 1 content-learning identity separates account provenance from canonical learner evidence')
