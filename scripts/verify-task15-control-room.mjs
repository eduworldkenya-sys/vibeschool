import fs from 'node:fs'

const migration='supabase/migrations/20260819082000_task15_hq_workforce_control_room.sql'
const page='app/hq/workforce/page.tsx'
const sql=fs.readFileSync(migration,'utf8')
const ui=fs.readFileSync(page,'utf8')
const failures=[]
const requireText=(source,text,label)=>{if(!source.includes(text))failures.push(label)}

for(const fn of [
 'hq_workforce_owner_control_snapshot',
 'hq_workforce_owner_start_controlled_operations',
 'hq_workforce_owner_stop_operations',
 'hq_workforce_owner_set_global_stop'
]) requireText(sql,`function public.${fn}`,`missing ${fn}`)

requireText(sql,'perform public.hq_assert_owner()','owner assertion missing')
requireText(sql,'control_room_stale_runtime_state','stale-state rejection missing')
requireText(sql,"hq_workforce_trip_execution_breaker(\n      'global','global'",'Global Stop breaker integration missing')
requireText(sql,"hq_workforce_owner_transition_capability_authority(\n        g.id,'suspend'",'shutdown authority neutralization missing')
requireText(sql,'task15_migration_must_not_activate_runtime','non-activation invariant missing')
requireText(sql,'revoke all on function public.hq_workforce_owner_start_controlled_operations','start RPC grant hardening missing')
requireText(sql,'from public,anon,service_role','service-role activation denial missing')
requireText(sql,'alter table public.hq_workforce_owner_control_events enable row level security','audit RLS missing')
requireText(sql,'revoke all on table public.hq_workforce_owner_control_events from public,anon,authenticated,service_role','audit direct-access denial missing')
requireText(sql,"'authority_reactivated',false",'Global Stop release must not reactivate authority')

for(const text of [
 'Control Room',
 'Safety summary',
 'Start Controlled Operations',
 'Activation review',
 'Stop Operations',
 'Global Stop',
 'Temporary authority',
 'Circuit breakers',
 'Recent executions',
 'Resource envelope',
 'Owner audit trail',
 'hq_workforce_owner_control_snapshot',
 'hq_workforce_owner_start_controlled_operations',
 'hq_workforce_owner_stop_operations',
 'hq_workforce_owner_set_global_stop'
]) requireText(ui,text,`UI contract missing: ${text}`)

requireText(ui,'Type ${confirmation} to confirm','deliberate typed confirmation missing')
requireText(ui,'p_expected_updated_at:e.updated_at','UI stale-state token missing')
requireText(ui,'Read-only fallback','safe missing-RPC fallback missing')
requireText(ui,'Global Stop released, an enabled global policy and active temporary capability authority','activation prerequisites not explained')

if(failures.length){
 console.error('Task 15 Control Room contract FAILED')
 for(const f of failures) console.error(`- ${f}`)
 process.exit(1)
}
console.log('Task 15 Control Room contract PASS')
console.log('- owner-only consequential RPC boundary present')
console.log('- stale-state and deliberate-confirmation controls present')
console.log('- normal Stop and emergency Global Stop remain distinct')
console.log('- authority/breaker/budget/execution/audit visibility present')
console.log('- migration is non-activating by invariant')
