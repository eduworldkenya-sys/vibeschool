import fs from 'node:fs'

const foundationPath='supabase/migrations/20260819170000_hq_geographic_intelligence_foundation.sql'
const readModelsPath='supabase/migrations/20260819171500_hq_national_intelligence_read_models.sql'
const explorerPath='supabase/migrations/20260819172500_hq_school_explorer_read_model.sql'
const pagePath='app/hq/geography/page.tsx'
const foundation=fs.readFileSync(foundationPath,'utf8')
const readModels=fs.readFileSync(readModelsPath,'utf8')
const explorer=fs.readFileSync(explorerPath,'utf8')
const migration=`${foundation}\n${readModels}\n${explorer}`
const page=fs.readFileSync(pagePath,'utf8')

const required=[
  'create table if not exists public.geo_countries',
  'create table if not exists public.geo_counties',
  'create table if not exists public.geo_subcounties',
  'create table if not exists public.geo_wards',
  'create table if not exists public.school_geography',
  'references public.schools(id)',
  'verification_state',
  'source_checksum',
  'alter table public.school_geography enable row level security',
  'revoke all on public.geo_countries',
  'public.is_platform_owner()',
  "raise exception 'invalid_geographic_hierarchy'",
  'create or replace function public.hq_geography_summary',
  'create or replace function public.hq_geographic_data_quality',
  'create or replace function public.hq_map_school_points',
  'create or replace function public.hq_school_360',
  'create or replace function public.hq_growth_intelligence',
  'create or replace function public.hq_geographic_opportunities',
  'create or replace function public.hq_school_explorer_list',
  'product_measurement_state',
  'product_account_sessions',
  "'residential_geography_inferred',false",
  "'retention_state','not_calculated_here'",
]
for(const token of required){if(!migration.includes(token)) throw new Error(`Missing geographic contract: ${token}`)}

const forbidden=[
  /create table[^;]*hq_schools/i,
  /create table[^;]*hq_users/i,
  /grant\s+select\s+on\s+public\.school_geography\s+to\s+(anon|authenticated)/i,
  /security definer[\s\S]{0,160}set search_path\s*=\s*public\s*(?:;|\n)/i,
  /residential[^\n]{0,80}(infer|derived)[^\n]{0,80}true/i,
  /stk[^\n]{0,80}(revenue|settled)/i,
]
for(const pattern of forbidden){if(pattern.test(migration)) throw new Error(`Forbidden geographic architecture pattern: ${pattern}`)}

const replacement=readModels.slice(readModels.indexOf('create or replace function public.hq_geography_region_breakdown'),readModels.indexOf('create or replace function public.hq_school_360'))
if(!replacement.includes('school_rollup')||!replacement.includes('event_rollup')) throw new Error('Regional aggregation must separate school and event rollups')
if(/left join public\.platform_events[\s\S]{0,500}count\(sg\.school_id\)/i.test(replacement)) throw new Error('Event fan-out can inflate school totals')
if(!replacement.includes('count(distinct pe.school_id)')) throw new Error('Active-school aggregation must be distinct')

for(const fn of ['hq_geography_region_breakdown','hq_school_360','hq_growth_intelligence','hq_geographic_opportunities','hq_school_explorer_list']){
  const marker=`create or replace function public.${fn}`
  const source=fn==='hq_school_explorer_list'?explorer:readModels
  const start=source.indexOf(marker)
  if(start<0) throw new Error(`Missing function ${fn}`)
  const next=source.indexOf('create or replace function public.',start+marker.length)
  const body=source.slice(start,next<0?undefined:next)
  if(!body.includes('security definer')) throw new Error(`${fn} must define its privilege mode explicitly`)
  if(!body.includes('set search_path=public,extensions,pg_temp')) throw new Error(`${fn} must pin search_path`)
  if(!body.includes('public.is_platform_owner()')) throw new Error(`${fn} must assert canonical HQ owner`)
  if(!body.includes('revoke all on function')||!body.includes('from public,anon')) throw new Error(`${fn} must revoke PUBLIC/anon execution`)
}

if(!explorer.includes('school_aliases')) throw new Error('School search must consume canonical aliases')
if(!explorer.includes('limit v_limit')) throw new Error('School explorer payload must be bounded')
if(/select\s+s\.\*/i.test(explorer)) throw new Error('School explorer may not return unrestricted school rows')
if(/full_name|phone|email|date_of_birth/i.test(explorer)) throw new Error('School explorer payload may not expose user PII')

if(!page.includes('Unknown evidence remains unknown')) throw new Error('HQ geography must state evidence semantics')
if(!page.includes('Map evidence not ready')) throw new Error('HQ geography must fail truthfully when map evidence is incomplete')
if(!page.includes('disabled={!county}')) throw new Error('Sub-county filter must be parent-scoped')
if(!page.includes('disabled={!subcounty}')) throw new Error('Ward filter must be parent-scoped')
if(/HQNavigation|navGroups/.test(page)) throw new Error('Geography module must not independently own global HQ navigation')
if(/fake|demo data|fallback counties/i.test(page)) throw new Error('Production geography route may not contain fabricated fallback data')

console.log('HQ Geographic Intelligence contract: PASS')
