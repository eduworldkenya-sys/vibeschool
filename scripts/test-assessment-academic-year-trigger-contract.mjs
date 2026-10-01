import assert from 'node:assert/strict'
import fs from 'node:fs'
const m=fs.readFileSync('supabase/migrations/20261001134000_fix_assessment_academic_year_trigger.sql','utf8')
assert.match(m,/create or replace function public\.fn_verify_grade_year\(\)/i)
assert.match(m,/new\.academic_year < 1000/i)
assert.match(m,/new\.academic_year > 9999/i)
assert.doesNotMatch(m,/academic_year\s*!~/i)
console.log('Assessment academic-year trigger contract passed')
