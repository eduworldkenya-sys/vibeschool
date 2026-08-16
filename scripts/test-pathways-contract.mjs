import fs from 'node:fs'

const read = p => fs.readFileSync(p,'utf8')
const requireText = (text, needle, label) => { if(!text.includes(needle)) throw new Error(`Pathways contract failed: ${label}`) }
const forbidText = (text, needle, label) => { if(text.includes(needle)) throw new Error(`Pathways contract failed: ${label}`) }

const domain = read('supabase/migrations/20260816143000_pathways_canonical_integration.sql')
const family = read('supabase/migrations/20260816143500_pathways_family_continuation.sql')
const observations = read('supabase/migrations/20260816144000_pathways_authoritative_observations.sql')
const cryptoFix = read('supabase/migrations/20260816144500_pathways_pgcrypto_schema_qualification.sql')
const quick = read('lib/pathways/quickCheck.ts')
const check = read('app/pathways/check/page.tsx')
const cont = read('app/pathways/continue/page.tsx')
const schools = read('app/pathways/schools/page.tsx')
const login = read('app/login/[role]/page.tsx')
const parentSignup = read('app/signup/parent/page.tsx')
const sitemap = read('app/sitemap.ts')

requireText(domain,'references public.schools(id)','school offerings must reference canonical schools')
requireText(domain,'references public.subjects(id)','combinations must reference existing subject identity')
requireText(domain,'s.global_subject_id is null','national combinations must accept canonical subjects only')
requireText(domain,'references public.students(id)','passport must reuse canonical learner identity')
forbidText(domain,'create table public.schools ','Pathways must not create a second school table')
forbidText(domain,'create table public.students ','Pathways must not create a second learner table')

for (const table of ['pathway_sources','pathways','pathway_tracks','pathway_subject_combinations','pathway_school_offerings']) requireText(domain,`create table public.${table}`,`${table} missing`)
requireText(domain,"offering_status = 'verified' and verified_at is not null",'public offering reads must be verified')
requireText(observations,'reconciliation_status','authoritative observations require reconciliation state')
requireText(observations,"('pending','matched','ambiguous','rejected','superseded')",'observation ambiguity must be explicit')
requireText(observations,'no anon/authenticated access','raw evidence must remain internal')

for (const migration of [domain,family,observations]) requireText(migration,'enable row level security','all new exposed tables need RLS declarations')
requireText(domain,'revoke all on function public.student_adopt_pathway_quick_check','student save RPC must revoke default execution')
requireText(family,'revoke all on function public.parent_save_pathway_draft','parent draft RPC must revoke default execution')
requireText(observations,'grant execute on function public.pathways_ingest_source_observation','ingestion RPC must have explicit grant')
requireText(observations,'to service_role','authoritative ingestion must be service-only')
forbidText(cryptoFix,'set search_path = public, extensions','cryptographic namespace must not widen SECURITY DEFINER search path')
requireText(cryptoFix,'extensions.digest','pgcrypto digest must be schema-qualified under constrained search path')

requireText(domain,'input_fingerprint','student decisions need input fingerprint')
requireText(cryptoFix,'idempotency_replay_mismatch','mismatched replay must fail closed after runtime fix')
requireText(cryptoFix,"'replayed', v_replayed",'student replay response must be deterministic')

requireText(quick,"QUICK_CHECK_STORAGE_KEY = 'vs_pathways_quick_check_v1'",'anonymous result needs local storage contract')
requireText(check,'No login required','free check cannot require auth')
requireText(check,'NOT AN OFFICIAL PLACEMENT','quick check must not masquerade as placement')
requireText(cont,'the durable account starts with the adult parent','new-family lane must begin with adult account')
requireText(family,'never creates a learner','parent draft must not manufacture learner identity')
requireText(family,'not a learner Pathway Passport','parent draft cannot silently adopt for learner')

requireText(schools,'Offering not yet verified','missing evidence must display as unverified')
requireText(schools,'not “the school does not offer it”','unknown offering cannot be presented as negative fact')

requireText(login,"value === '/pathways/continue'",'continuation redirect must be allowlisted')
requireText(login,"state === 'ready' && next",'continuation must not bypass onboarding')
requireText(login,"next=${encodeURIComponent(next)}",'OAuth continuation must survive callback')
requireText(cont,'/login/parent?next=${CONTINUE}','parent sign-in must invoke continuation')
requireText(cont,'/login/student?next=${CONTINUE}','learner sign-in must invoke continuation')
requireText(cont,'/signup/parent?next=${CONTINUE}','new family must invoke parent continuation')
requireText(parentSignup,"router.replace(data.session && next ? next : '/parent/students')",'parent signup must restore ready session to Pathways')
forbidText(login,'useSearchParams','login continuation must not introduce static prerender bailout')
forbidText(parentSignup,'useSearchParams','parent signup continuation must not introduce static prerender bailout')
forbidText(schools,'useSearchParams','school discovery must not introduce static prerender bailout')

for (const path of ['/pathways','/pathways/check','/pathways/schools']) requireText(sitemap,path,`${path} missing from sitemap`)

console.log('PASS Pathways authority, safety, continuation, runtime and discoverability contract')
