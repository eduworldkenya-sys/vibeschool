import fs from 'node:fs'

const foundationPath='supabase/migrations/20260819170000_hq_geographic_intelligence_foundation.sql'
const readModelsPath='supabase/migrations/20260819171500_hq_national_intelligence_read_models.sql'
const explorerPath='supabase/migrations/20260819172500_hq_school_explorer_read_model.sql'
const levelSemanticsPath='supabase/migrations/20260819173500_hq_school_level_semantics.sql'
const school360SemanticsPath='supabase/migrations/20260819174500_hq_school_360_level_semantics.sql'
const regionIntegrityPath='supabase/migrations/20260819175500_hq_region_aggregate_integrity.sql'
const growthTolerancePath='supabase/migrations/20260819180500_hq_growth_measurement_dependency_tolerance.sql'
const sqlContractPath='supabase/tests/hq_national_intelligence_contract.sql'
const pagePath='app/hq/geography/page.tsx'
const foundation=fs.readFileSync(foundationPath,'utf8')
const readModels=fs.readFileSync(readModelsPath,'utf8')
const explorer=fs.readFileSync(explorerPath,'utf8')
const levelSemantics=fs.readFileSync(levelSemanticsPath,'utf8')
const school360Semantics=fs.readFileSync(school360SemanticsPath,'utf8')
const regionIntegrity=fs.readFileSync(regionIntegrityPath,'utf8')
const growthTolerance=fs.readFileSync(growthTolerancePath,'utf8')
const sqlContract=fs.readFileSync(sqlContractPath,'utf8')
const migration=`${foundation}\n${readModels}\n${explorer}\n${levelSemantics}\n${school360Semantics}\n${regionIntegrity}\n${growthTolerance}`
const page=fs.readFileSync(pagePath,'utf8')

const required=[
  'create table if not exists public.geo_countries','create table if not exists public.geo_counties','create table if not exists public.geo_subcounties','create table if not exists public.geo_wards','create table if not exists public.school_geography','references public.schools(id)','verification_state','source_checksum','alter table public.school_geography enable row level security','revoke all on public.geo_countries','public.is_platform_owner()',"raise exception 'invalid_geographic_hierarchy'",'create or replace function public.hq_geography_summary','create or replace function public.hq_geographic_data_quality','create or replace function public.hq_map_school_points','create or replace function public.hq_school_360','create or replace function public.hq_growth_intelligence','create or replace function public.hq_geographic_opportunities','create or replace function public.hq_school_explorer_list','product_measurement_state','product_account_sessions',"'residential_geography_inferred',false","'retention_state','not_calculated_here'",'public.school_levels'
]
for(const token of required){if(!migration.includes(token)) throw new Error(`Missing geographic contract: ${token}`)}

const forbidden=[/create table[^;]*hq_schools/i,/create table[^;]*hq_users/i,/grant\s+select\s+on\s+public\.school_geography\s+to\s+(anon|authenticated)/i,/security definer[\s\S]{0,160}set search_path\s*=\s*public\s*(?:;|\n)/i,/residential[^\n]{0,80}(infer|derived)[^\n]{0,80}true/i,/stk[^\n]{0,80}(revenue|settled)/i]
for(const pattern of forbidden){if(pattern.test(migration)) throw new Error(`Forbidden geographic architecture pattern: ${pattern}`)}

if(!regionIntegrity.includes('school_rollup')||!regionIntegrity.includes('event_rollup')) throw new Error('Regional aggregation must separate school and event rollups')
if(!regionIntegrity.includes('count(s.id)')) throw new Error('Regional totals must count eligible non-deleted canonical schools')
if(!regionIntegrity.includes('count(distinct pe.school_id)')) throw new Error('Active-school aggregation must be distinct')
if(!regionIntegrity.includes('s.deleted_at is null')) throw new Error('Regional totals must exclude soft-deleted schools')
if(/count\(sg\.school_id\)/i.test(regionIntegrity)) throw new Error('Regional totals may not count geography rows directly')

const functionSources={hq_geography_region_breakdown:regionIntegrity,hq_school_360:school360Semantics,hq_growth_intelligence:growthTolerance,hq_geographic_opportunities:readModels,hq_school_explorer_list:levelSemantics}
for(const [fn,source] of Object.entries(functionSources)){
  const marker=`create or replace function public.${fn}`
  const start=source.indexOf(marker)
  if(start<0) throw new Error(`Missing function ${fn}`)
  const next=source.indexOf('create or replace function public.',start+marker.length)
  const body=source.slice(start,next<0?undefined:next)
  if(!body.includes('security definer')) throw new Error(`${fn} must define its privilege mode explicitly`)
  if(!body.includes('set search_path=public,extensions,pg_temp')) throw new Error(`${fn} must pin search_path`)
  if(!body.includes('public.is_platform_owner()')) throw new Error(`${fn} must assert canonical HQ owner`)
  if(!body.includes('revoke all on function')||!body.includes('from public,anon')) throw new Error(`${fn} must revoke PUBLIC/anon execution`)
}

if(!growthTolerance.includes("to_regclass('public.product_measurement_state')")) throw new Error('Growth intelligence must tolerate missing upstream Measurement Kernel')
if(!growthTolerance.includes("'upstream_contract_unavailable'")) throw new Error('Missing Measurement Kernel must remain explicitly unavailable')
if(!growthTolerance.includes("'retention_state','not_calculated_here'")) throw new Error('Growth intelligence must not fabricate retention')
if(!growthTolerance.includes("'returning_users','active in both selected window")) throw new Error('Returning-user semantics must be explicit and distinct from retention')

if(!levelSemantics.includes('public.school_levels')) throw new Error('School level intelligence must consume canonical school_levels')
if(!/v_level[\s\S]{0,900}exists\s*\(select 1 from public\.school_levels sl where sl\.school_id=s\.id and upper\(sl\.level\)=v_level\)/i.test(levelSemantics)) throw new Error('School level filter must be enforced through canonical school_levels')
if(/v_level[\s\S]{0,900}(?:s\.school_type|s\.school_category)\s*=/i.test(levelSemantics)) throw new Error('School level filter may not compare institution type/category as level')
if(!levelSemantics.includes("when 'JUNIOR SCHOOL' then 'JUNIOR'")) throw new Error('Founder Junior School label must normalize to canonical JUNIOR')
if(!levelSemantics.includes("when 'SECONDARY' then 'SENIOR_SECONDARY'")) throw new Error('Founder Secondary label must normalize to canonical SENIOR_SECONDARY')
if(!levelSemantics.includes('institution_type')) throw new Error('Institution type must remain distinct from school level')
if(!levelSemantics.includes('school_aliases')) throw new Error('School search must consume canonical aliases')
if(!levelSemantics.includes('limit v_limit')) throw new Error('School explorer payload must be bounded')
if(/select\s+s\.\*/i.test(levelSemantics)) throw new Error('School explorer may not return unrestricted school rows')
if(/full_name|phone|email|date_of_birth/i.test(levelSemantics)) throw new Error('School explorer payload may not expose user PII')

if(!school360Semantics.includes("'school_type',(select min(sl.level)")) throw new Error('School 360 display level must come from canonical school_levels')
if(!school360Semantics.includes("'institution_type',v_school.school_type")) throw new Error('School 360 must keep institution type separate from school level')
if(!school360Semantics.includes('limit 50')) throw new Error('School 360 alias payload must be bounded')
if(/full_name|phone|email|date_of_birth/i.test(school360Semantics)) throw new Error('School 360 aggregate read model may not expose user PII')

const opportunityStart=readModels.indexOf('create or replace function public.hq_geographic_opportunities')
const opportunities=readModels.slice(opportunityStart)
if(!opportunities.includes("'teacher_activation'::text")) throw new Error('Teacher activation opportunity must be deterministic')
if(!/where\s+learners>0\s+and\s+active_teachers=0/i.test(opportunities)) throw new Error('Learners with zero active teachers must trigger teacher activation')
if(!opportunities.includes("'geography_gap'")) throw new Error('Geography gap opportunity must remain explicit')
if(!opportunities.includes('recommended_investigation')) throw new Error('Opportunity signals must return an investigation, not execute an action')

for(const token of ['has_function_privilege','has_table_privilege','product_measurement_state','residential_geography_inferred','recommended_investigation']){if(!sqlContract.includes(token)) throw new Error(`SQL regression contract missing ${token}`)}

if(!page.includes('Unknown evidence remains unknown')) throw new Error('HQ geography must state evidence semantics')
if(!page.includes('Map evidence not ready')) throw new Error('HQ geography must fail truthfully when map evidence is incomplete')
if(!page.includes('disabled={!county}')) throw new Error('Sub-county filter must be parent-scoped')
if(!page.includes('disabled={!subcounty}')) throw new Error('Ward filter must be parent-scoped')
for(const rpc of ['hq_growth_intelligence','hq_geographic_opportunities','hq_school_explorer_list','hq_school_360']){if(!page.includes(`supabase.rpc("${rpc}"`)) throw new Error(`HQ route must consume canonical bounded RPC ${rpc}`)}
if(/supabase\.from\(/.test(page)) throw new Error('National HQ route may not pull raw analytical tables into the browser')
if(/HQNavigation|navGroups/.test(page)) throw new Error('Geography module must not independently own global HQ navigation')
if(/fake|demo data|fallback counties/i.test(page)) throw new Error('Production geography route may not contain fabricated fallback data')

console.log('HQ Geographic Intelligence contract: PASS')
