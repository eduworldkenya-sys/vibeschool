import fs from 'node:fs';

const file = 'supabase/migrations/20260825000500_fix_cyborg_admission_mission_id_ambiguity.sql';
const sql = fs.readFileSync(file, 'utf8');
for (const required of [
  'create or replace function public.hq_cyborg_admit_chat_mission',
  'on conflict on constraint hq_cyborg_invocation_budgets_pkey do nothing',
  'update public.hq_cyborg_chat_sessions as chat',
  'security invoker',
  'revoke all on function public.hq_cyborg_admit_chat_mission',
  'grant execute on function public.hq_cyborg_admit_chat_mission',
]) {
  if (!sql.toLowerCase().includes(required.toLowerCase())) throw new Error(`CYBORG_ADMISSION_SQL_INVARIANT_MISSING:${required}`);
}
if (/on conflict\s*\(\s*mission_id\s*\)/i.test(sql)) throw new Error('CYBORG_ADMISSION_AMBIGUOUS_CONFLICT_TARGET');
console.log('CYBORG_ADMISSION_SQL_PASS');
