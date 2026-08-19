import fs from 'node:fs'

const migrationPath='supabase/migrations/20260819170000_hq_geographic_intelligence_foundation.sql'
const pagePath='app/hq/geography/page.tsx'
const migration=fs.readFileSync(migrationPath,'utf8')
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
]
for(const token of required){if(!migration.includes(token)) throw new Error(`Missing geographic contract: ${token}`)}

const forbidden=[
  /create table[^;]*hq_schools/i,
  /create table[^;]*hq_users/i,
  /grant\s+select\s+on\s+public\.school_geography\s+to\s+(anon|authenticated)/i,
  /security definer[\s\S]{0,160}set search_path\s*=\s*public\s*(?:;|\n)/i,
]
for(const pattern of forbidden){if(pattern.test(migration)) throw new Error(`Forbidden geographic architecture pattern: ${pattern}`)}

if(!page.includes('Unknown evidence remains unknown')) throw new Error('HQ geography must state evidence semantics')
if(!page.includes('Map evidence not ready')) throw new Error('HQ geography must fail truthfully when map evidence is incomplete')
if(!page.includes('disabled={!county}')) throw new Error('Sub-county filter must be parent-scoped')
if(!page.includes('disabled={!subcounty}')) throw new Error('Ward filter must be parent-scoped')
if(/HQNavigation|navGroups/.test(page)) throw new Error('Geography module must not independently own global HQ navigation')
if(/fake|demo data|fallback counties/i.test(page)) throw new Error('Production geography route may not contain fabricated fallback data')

console.log('HQ Geographic Intelligence contract: PASS')
