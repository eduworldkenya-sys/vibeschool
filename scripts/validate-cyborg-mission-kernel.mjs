import fs from 'node:fs';
const required = ['lib/cyborg/contracts.ts','lib/cyborg/kernel.ts','lib/cyborg/policy.ts','docs/CYBORG_OPERATING_CONSTITUTION.md'];
for (const p of required) if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
const all = required.map(p=>fs.readFileSync(p,'utf8')).join('\n');
const invariants = ['PREMATURE_COMPLETION','STALE_GATE_EVIDENCE','CONTRADICTORY_EVIDENCE','STAGNATION_DETECTED','REQUIRED_SKILL_UNPROVEN','NO_INDEPENDENT_ASSURANCE','idempotencyKey','self_certification','runtime_activation','prompt injection','exact revision','lease','rollback','model-independent'];
for (const x of invariants) if (!all.toLowerCase().includes(x.toLowerCase())) throw new Error(`missing invariant: ${x}`);
console.log('CYBORG_MISSION_KERNEL_CONTRACT_PASS');
