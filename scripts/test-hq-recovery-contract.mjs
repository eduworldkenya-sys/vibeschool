import fs from 'node:fs'

const reset=fs.readFileSync('app/hq/reset-password/page.tsx','utf8')
const client=fs.readFileSync('lib/hq/supabase.ts','utf8')
const completion=fs.readFileSync('app/api/hq/complete-password-setup/route.ts','utf8')

const required=[
  ['implicit recovery access token is consumed',/access_token/],
  ['implicit recovery refresh token is consumed',/refresh_token/],
  ['recovery session is installed into isolated HQ client',/hqSupabase\.auth\.setSession/],
  ['PKCE code exchange remains supported',/exchangeCodeForSession/],
  ['recovery type is constrained',/type==="recovery"/],
  ['setup authorization is checked server-side',/\/api\/hq\/access\?surface=%2Fhq%2Freset-password&setup=1/],
  ['expired token gets explicit handling',/otp_expired/],
  ['password readiness is asserted only with password update',/hq_password_ready:true/],
  ['temporary recovery session is signed out',/signOut\(\{scope:"local"\}\)/],
]
for(const [label,re] of required){if(!re.test(reset))throw new Error(`HQ recovery contract failed: ${label}`)}
if(!/storageKey:\s*"vibeschool-hq-auth"/.test(client))throw new Error('HQ recovery contract failed: isolated storage key missing')
if(!/detectSessionInUrl:\s*false/.test(client))throw new Error('HQ recovery contract failed: URL session auto-detection must remain disabled')
if(!/member\.password_setup_completed/.test(completion))throw new Error('HQ recovery contract failed: completion audit missing')
if(!/status:\s*"active"/.test(completion))throw new Error('HQ recovery contract failed: activation transition missing')
console.log('HQ recovery session handoff contract: PASS')
