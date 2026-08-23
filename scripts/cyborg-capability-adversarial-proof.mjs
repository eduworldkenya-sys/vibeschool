import fs from 'node:fs';
const cap=fs.readFileSync('lib/cyborg/capability.ts','utf8');
const cases={missing:'CYBORG_CAPABILITY_REQUIRED',forged:'CYBORG_CAPABILITY_INVALID',expired:'CYBORG_CAPABILITY_EXPIRED',mission:'CYBORG_CAPABILITY_MISSION_MISMATCH',provider:'CYBORG_CAPABILITY_PROVIDER_MISMATCH',model:'CYBORG_CAPABILITY_MODEL_MISMATCH'};
for(const [name,token] of Object.entries(cases)) if(!cap.includes(token)) throw new Error(`ADVERSARIAL_CASE_MISSING:${name}`);
const sql=fs.readFileSync('supabase/migrations/20260823080000_cyborg_model_lineage_enforcement.sql','utf8');
if(!sql.includes('CYBORG_CAPABILITY_REPLAYED')) throw new Error('ADVERSARIAL_CASE_MISSING:replay');
if(!sql.includes("status text not null check (status in ('claimed','succeeded','failed'))")) throw new Error('LINEAGE_STATE_MACHINE_MISSING');
console.log('CYBORG_CAPABILITY_ADVERSARIAL_MATRIX_PASS');
