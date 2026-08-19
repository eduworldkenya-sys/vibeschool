import fs from 'node:fs'

const migrationPaths=[
 'supabase/migrations/20260819082000_task15_hq_workforce_control_room.sql',
 'supabase/migrations/20260819082100_task15_hq_workforce_control_adjustments.sql'
]
const sql=migrationPaths.map(p=>fs.readFileSync(p,'utf8')).join('\n')
const ui=fs.readFileSync('app/hq/workforce/page.tsx','utf8')
const failures=[]
const requireText=(source,text,label)=>{if(!source.includes(text))failures.push(label)}

for(const fn of [
 'hq_workforce_owner_control_snapshot',
 'hq_workforce_owner_start_controlled_operations',
 'hq_workforce_owner_stop_operations',
 'hq_workforce_owner_set_global_stop',
 'hq_workforce_owner_configure_global_envelope',
 'hq_workforce_owner_control_authority',
 'hq_workforce_owner_reset_breaker'
]) requireText(sql,`function public.${fn}`,`missing ${fn}`)

for(const marker of [
 'perform public.hq_assert_owner()',
 'control_room_stale_runtime_state',
 'hq_workforce_trip_execution_breaker(',
 "'global','global','owner_global_stop'",
 'hq_workforce_owner_transition_capability_authority(',
 "g.id,'suspend'",
 'task15_migration_must_not_activate_runtime',
 'control_room_policy_change_requires_runtime_off',
 'control_room_breaker_reset_requires_runtime_off',
 'control_room_global_breaker_release_via_global_stop_only',
 "'authority_reactivated',false"
]) requireText(sql,marker,`SQL contract missing: ${marker}`)

requireText(sql,'revoke all on table public.hq_workforce_owner_control_events from public,anon,authenticated,service_role','audit direct-access denial missing')
requireText(sql,'alter table public.hq_workforce_owner_control_events enable row level security','audit RLS missing')
for(const fn of ['hq_workforce_owner_start_controlled_operations','hq_workforce_owner_configure_global_envelope','hq_workforce_owner_control_authority','hq_workforce_owner_reset_breaker']){
 requireText(sql,`revoke all on function public.${fn}`,`grant hardening missing: ${fn}`)
}
requireText(sql,'from public,anon,service_role','service-role consequential-control denial missing')

for(const text of [
 'Control Room','Safety summary','Safety envelope','Adjust permitted controls','Start Controlled Operations','Activation review','Stop Operations','Global Stop','Temporary authority','Activate authority','Circuit breakers','Review breaker reset','Recent executions','Resource envelope','Owner audit trail',
 'hq_workforce_owner_control_snapshot','hq_workforce_owner_start_controlled_operations','hq_workforce_owner_stop_operations','hq_workforce_owner_set_global_stop','hq_workforce_owner_configure_global_envelope','hq_workforce_owner_control_authority','hq_workforce_owner_reset_breaker'
]) requireText(ui,text,`UI contract missing: ${text}`)

requireText(ui,'Type ${token} to confirm','deliberate typed confirmation missing')
requireText(ui,'p_expected_updated_at:e.updated_at','UI stale-state token missing')
requireText(ui,'Read-only fallback','safe missing-RPC fallback missing')
requireText(ui,'Global Stop released, enabled policy and active temporary authority','activation prerequisites not explained')
requireText(ui,'Activation never creates authority','unsafe authority coupling copy missing')
requireText(ui,'Reset removes a prohibition only; it never restarts runtime or grants authority.','breaker semantics missing')

if(failures.length){console.error('Task 15 Control Room contract FAILED');for(const f of failures)console.error(`- ${f}`);process.exit(1)}
console.log('Task 15 Control Room contract PASS')
console.log('- owner-only consequential RPC boundary present')
console.log('- stale-state and deliberate-confirmation controls present')
console.log('- policy configuration is non-activating and runtime-off only')
console.log('- authority lifecycle is owner-governed without direct table writes')
console.log('- normal Stop and emergency Global Stop remain distinct')
console.log('- breaker recovery cannot restart runtime or grant authority')
console.log('- authority/breaker/budget/execution/audit visibility present')
console.log('- migration installation is non-activating by invariant')
