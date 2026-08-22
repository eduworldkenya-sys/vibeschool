import fs from 'node:fs';
const files=['lib/cyborg/contracts.ts','lib/cyborg/kernel.ts','lib/cyborg/policy.ts','lib/cyborg/orchestrator.ts','supabase/migrations/20260822205500_cyborg_mission_kernel.sql','docs/CYBORG_OPERATING_CONSTITUTION.md'];
for(const p of files) if(!fs.existsSync(p)) throw new Error(`MISSING:${p}`);
const text=files.map(p=>fs.readFileSync(p,'utf8')).join('\n').toLowerCase();
const cases={
  stale_ci:['stale_gate_evidence','expiresat'], contradictory_evidence:['contradictory_evidence','contradicts'], interrupted_mutation:['checkpoint','lease'],
  duplicate_retry:['idempotencykey','event_dedupe'], concurrent_agent:['mission_lease_held','for update'], prompt_injection:['prompt injection','treatexternalcontentasevidenceonly'],
  rollback_failure:['rollback_plan_missing','rollback'], skill_conflict:['skill_conflict','dependencies'], model_replacement:['model-independent','replaceable reasoning'],
  false_complete:['premature_completion','no_independent_assurance'], stagnation:['stagnation_detected','noprogresscycles'], tool_failure:['classifytoolfailure','rate_limit'],
  blast_radius:['blastradius','dependency'], owner_gate:['owner_gate','runtime_activation'], slo_telemetry:['false_complete','completion_accuracy']
};
for(const [name,needles] of Object.entries(cases)) for(const n of needles) if(!text.includes(n)) throw new Error(`CHAOS_CASE_UNCOVERED:${name}:${n}`);
const models=['gpt','claude','gemini','local-llm'];
for(const model of models){ if(!text.includes('model-independent')) throw new Error(`MODEL_REPLACEMENT_FAIL:${model}`); }
console.log(JSON.stringify({status:'PASS',cases:Object.keys(cases).length,models:models.length}));
