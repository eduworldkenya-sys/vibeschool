import fs from 'node:fs';
const capability=fs.readFileSync('lib/cyborg/capability.ts','utf8');
const gateway=fs.readFileSync('lib/cyborg/gateway.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260823080000_cyborg_model_lineage_enforcement.sql','utf8');
for(const token of ['CYBORG_CAPABILITY_SECRET_REQUIRED','CYBORG_CAPABILITY_REQUIRED','CYBORG_CAPABILITY_EXPIRED','CYBORG_CAPABILITY_MISSION_MISMATCH','CYBORG_CAPABILITY_PROVIDER_MISMATCH','CYBORG_CAPABILITY_MODEL_MISMATCH','crypto.subtle','expiresAt','jti']) if(!capability.includes(token)) throw new Error(`CAPABILITY_INVARIANT_MISSING:${token}`);
for(const token of ['invokeGovernedCyborgModel','issueCyborgCapability','verifyCyborgCapability','store.claim','store.complete','CYBORG_LINEAGE_STORE_REQUIRED']) if(!gateway.includes(token)) throw new Error(`GATEWAY_INVARIANT_MISSING:${token}`);
for(const token of ['cyborg_model_invocations','capability_jti uuid not null unique','cyborg_claim_model_capability','CYBORG_CAPABILITY_REPLAYED','cyborg_complete_model_invocation','enable row level security','revoke all']) if(!migration.includes(token)) throw new Error(`LINEAGE_INVARIANT_MISSING:${token}`);
for(const route of ['app/api/twin/pulse/route.ts','app/api/reports/insight/route.ts','app/api/generate-lesson-plan/route.ts']) { const text=fs.readFileSync(route,'utf8'); if(!text.includes('invokeGovernedCyborgModel')) throw new Error(`UNENFORCED_MODEL_ROUTE:${route}`); if(text.includes('invokeCyborgModel(adapter')) throw new Error(`DIRECT_GATEWAY_BYPASS:${route}`); }
console.log('CYBORG_CAPABILITY_LINEAGE_ENFORCEMENT_PASS');
