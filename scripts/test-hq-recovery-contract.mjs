import fs from 'node:fs'

const reset=fs.readFileSync('app/hq/reset-password/page.tsx','utf8')
const hqClient=fs.readFileSync('lib/hq/supabase.ts','utf8')
const recoveryClient=fs.readFileSync('lib/hq/recovery-supabase.ts','utf8')
const completion=fs.readFileSync('app/api/hq/complete-password-setup/route.ts','utf8')
const teamApi=fs.readFileSync('app/api/hq/invite-member/route.ts','utf8')
const teamPage=fs.readFileSync('app/hq/team/page.tsx','utf8')

const required=[
  ['implicit recovery access token is consumed',/access_token/],
  ['implicit recovery refresh token is consumed',/refresh_token/],
  ['recovery session is installed into recovery-only client',/hqRecoverySupabase\.auth\.setSession/],
  ['PKCE code exchange remains supported',/hqRecoverySupabase\.auth\.exchangeCodeForSession/],
  ['recovery type is constrained',/type==="recovery"/],
  ['setup authorization is checked server-side',/\/api\/hq\/access\?surface=%2Fhq%2Freset-password&setup=1/],
  ['expired token gets explicit handling',/otp_expired/],
  ['scanner-proof recovery code is verified only on submit',/hqRecoverySupabase\.auth\.verifyOtp\(\{email,token,type:"recovery"\}\)/],
  ['password readiness is asserted only with recovery password update',/hqRecoverySupabase\.auth\.updateUser\(\{password,data:\{hq_password_ready:true\}\}\)/],
  ['temporary recovery session is signed out',/hqRecoverySupabase\.auth\.signOut\(\{scope:"local"\}\)/],
]
for(const [label,re] of required){if(!re.test(reset))throw new Error(`HQ recovery contract failed: ${label}`)}
if(/hqSupabase\.auth\./.test(reset))throw new Error('HQ recovery contract failed: reset page must never mutate/read the normal Founder HQ auth client')
if(!/storageKey:\s*"vibeschool-hq-auth"/.test(hqClient))throw new Error('HQ recovery contract failed: normal HQ storage key missing')
if(!/storageKey:\s*"vibeschool-hq-recovery-auth"/.test(recoveryClient))throw new Error('HQ recovery contract failed: recovery-only storage key missing')
if(!/detectSessionInUrl:\s*false/.test(recoveryClient))throw new Error('HQ recovery contract failed: recovery URL auto-detection must remain disabled')
if(!/member\.password_setup_completed/.test(completion))throw new Error('HQ recovery contract failed: completion audit missing')
if(!/status:\s*"active"/.test(completion))throw new Error('HQ recovery contract failed: activation transition missing')
if(!/action==="recovery_code"/.test(teamApi))throw new Error('HQ recovery contract failed: founder recovery-code action missing')
if(!/auth\.admin\.generateLink\(\{type:"recovery",email:u\.email\}\)/.test(teamApi))throw new Error('HQ recovery contract failed: recovery code must come from Supabase Auth')
if(!/properties\?\.email_otp/.test(teamApi))throw new Error('HQ recovery contract failed: generated email OTP is not returned through founder-only recovery path')
if(!/member\.recovery_code_generated/.test(teamApi))throw new Error('HQ recovery contract failed: recovery-code audit event missing')
if(!/Generate recovery code/.test(teamPage))throw new Error('HQ recovery contract failed: founder recovery-code control missing')
console.log('HQ Founder session isolation + recovery handoff + scanner-proof code contract: PASS')
