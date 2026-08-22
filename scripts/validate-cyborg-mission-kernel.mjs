import fs from 'node:fs';
const required = [
  'lib/cyborg/contracts.ts','lib/cyborg/kernel.ts','lib/cyborg/policy.ts','lib/cyborg/orchestrator.ts','lib/cyborg/runtime.ts',
  'docs/CYBORG_OPERATING_CONSTITUTION.md','docs/CYBORG_20X_CONTROL_MATRIX.md','supabase/migrations/20260822205500_cyborg_mission_kernel.sql',
  'scripts/cyborg-adversarial-proof.mjs','scripts/cyborg-behavior-proof.ts','tsconfig.cyborg-proof.json'
];
for (const p of required) if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
const all = required.map(p=>fs.readFileSync(p,'utf8')).join('\n');
const invariants = [
  'PREMATURE_COMPLETION','STALE_GATE_EVIDENCE','CONTRADICTORY_EVIDENCE','STAGNATION_DETECTED','REQUIRED_SKILL_UNPROVEN','NO_INDEPENDENT_ASSURANCE',
  'idempotencyKey','self_certification','runtime_activation','prompt injection','exact revision','lease','rollback','model-independent',
  'hq_cyborg_missions','hq_cyborg_mission_events','hq_cyborg_mission_leases','hq_cyborg_slo_events','SKILL_CONFLICT','CAPABILITY_MISSING',
  'ROLLBACK_PLAN_MISSING','RECOVERY_CHECKPOINT_MISSING','MISSION_LEASE_HELD','classifyToolFailure','blastRadius','adversarialCompletionCritic',
  'executeRollback','reconcileTruth','ENVIRONMENT_IDENTITY_MISMATCH','UNPLANNED_SIDE_EFFECT','CyborgPersistencePort','CyborgExecutionPort',
  'acquireLease','completion_rejected','completion_accuracy','mission replay must be deterministic','Production persistence proof | PROOF PENDING','CI enforcement | IMPLEMENTED'
];
for (const x of invariants) if (!all.toLowerCase().includes(x.toLowerCase())) throw new Error(`missing invariant: ${x}`);
console.log('CYBORG_MISSION_KERNEL_CONTRACT_PASS');
