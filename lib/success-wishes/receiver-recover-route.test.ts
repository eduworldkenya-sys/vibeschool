import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { POST, PATCH } from '../../app/api/success-wishes/receiver/recover/route'
import { INBOX_COOKIE } from './receiver-otp'
import { recoveryDigest, otpDigest } from './receiver-sms'
import type { RecoveryIdentity } from './recovery-identity'

const origin = 'https://recovery.example'
const challengeId = '33333333-3333-4333-8333-333333333333'
const verificationSecret = 'synthetic-verification-secret-for-sms-recovery-tests'
const adultPhone = '+254712000111'
const guardianPhone = '+254733333333'
const secretA = 'ABCD-EFGH-JKMP-QRST'
const secretB = 'WXYZ-2345-6789-HJKM'
const saved = { ...process.env }

function record(id: string, phone: string, guardian: string | null = null, code = secretA): RecoveryIdentity {
  return { id, phone_e164: phone, guardian_phone_e164: guardian,
    consent_route: guardian ? 'guardian' : 'adult', consent_status: 'verified',
    recovery_secret_hash: recoveryDigest(id, code.replace(/-/g, '')) }
}

test('six-digit SMS-only recovery is unique, rate checked, private and guardian-safe; backup remains supported', async () => {
  const originalFetch = globalThis.fetch
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-role',
    SUCCESS_WISHES_ENABLED: 'true',
    SUCCESS_WISHES_RECEIVER_ENABLED: 'true',
    SUCCESS_WISHES_RECEIVER_SMS_ENABLED: 'true',
    SUCCESS_WISHES_AT_MODE: 'live',
    SUCCESS_WISHES_AT_USERNAME: 'synthetic',
    SUCCESS_WISHES_AT_API_KEY: 'synthetic-key',
    SUCCESS_WISHES_VERIFICATION_SECRET: verificationSecret,
  })
  let rows = [
    record('adult', adultPhone),
    record('guardian-a', '+254712000222', guardianPhone, secretA),
    record('guardian-b', '+254712000333', guardianPhone, secretB),
  ]
  const deliveries: { to:string; code:string }[] = []
  const sessions: string[] = []
  const challenges: string[] = []
  globalThis.fetch = (async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = init?.method || 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
    const response = (data: unknown, status = 200) => Response.json(data, { status })
    if (url.hostname === 'api.africastalking.com') {
      const params = new URLSearchParams(String(init?.body))
      const to = params.get('to') || ''
      const message = params.get('message') || ''
      const code = /Code (\d{6})/.exec(message)?.[1] || ''
      assert.match(code, /^\d{6}$/)
      deliveries.push({ to, code })
      return response({ SMSMessageData: { Recipients: [{number:to,statusCode:102,status:'Success',messageId:'test'}] } })
    }
    assert.equal(url.hostname, 'synthetic.supabase.co', 'No real database or SMS')
    if (url.pathname.endsWith('/rpc/success_wishes_take_attempt')) return response(true)
    if (url.pathname.endsWith('/rpc/success_wish_consume_receiver_challenge')) {
      const correct = body.p_challenge === challengeId &&
        deliveries.some(entry => entry.code && body.p_digest === otpDigest(String(body.p_receiver),entry.code))
      return response(correct)
    }
    if (url.pathname.endsWith('/success_wish_receivers')) {
      const key = url.searchParams.has('phone_e164') ? 'phone_e164':'guardian_phone_e164'
      const match = url.searchParams.get(key)?.slice(3)
      return response(rows.filter(x => x[key] === match && x.consent_status === 'verified'))
    }
    if (url.pathname.endsWith('/success_wish_receiver_challenges') && method === 'POST') {
      challenges.push(String(body.receiver_id));return response({id:challengeId},201)
    }
    if (url.pathname.endsWith('/success_wish_sms_deliveries') && method === 'POST')
      return response({id:'44444444-4444-4444-8444-444444444444'},201)
    if (url.pathname.endsWith('/success_wish_sms_deliveries') && method === 'PATCH')
      return response([])
    if (url.pathname.endsWith('/success_wish_receiver_sessions') && method === 'POST') {
      sessions.push(String(body.receiver_id));return response(null,201)
    }
    throw Error('Unexpected synthetic data request '+method+' '+url.pathname)
  }) as typeof fetch
  const request = (method:'POST'|'PATCH', phone:string, extra:Record<string,unknown>={}) =>
    new NextRequest(origin+'/api/success-wishes/receiver/recover',{
      method,headers:{origin,'content-type':'application/json'},body:JSON.stringify({phone,...extra}),
    })
  try {
    // No receiver or multiple receivers => same shape, no SMS or account disclosure.
    const absent=await POST(request('POST','0712000444'))
    assert.equal(absent.status,200)
    assert.match((await absent.json()).challengeId,/^[0-9a-f-]{36}$/)
    assert.equal(deliveries.length,0)
    const shared=await POST(request('POST','0733333333'))
    assert.equal(shared.status,200)
    assert.equal(deliveries.length,0,'Shared guardian number cannot select a child')
    const blocked=await PATCH(request('PATCH','0733333333',{challengeId,code:'123456'}))
    assert.equal(blocked.status,401)
    assert.equal(blocked.cookies.get(INBOX_COOKIE),undefined)
    // Student phone must not bypass a registered guardian's authority.
    const childPhone=await POST(request('POST','0712000222'))
    assert.equal(childPhone.status,200)
    assert.equal(deliveries.length,0)
    // Unique adult: phone-only SMS, six digits; no saved backup required.
    const adult=await POST(request('POST','0712000111'))
    assert.equal(adult.status,200)
    assert.equal(deliveries.at(-1)?.to,adultPhone)
    assert.equal(challenges.at(-1),'adult')
    assert.equal((await PATCH(request('PATCH','0712000111',{challengeId,code:'000000'}))).status,401)
    assert.equal(sessions.length,0,'Incorrect code never grants inbox session')
    const opened=await PATCH(request('PATCH','0712000111',{challengeId,code:deliveries.at(-1)!.code}))
    assert.equal(opened.status,200)
    assert.equal(sessions.at(-1),'adult')
    assert.ok(opened.cookies.get(INBOX_COOKIE)?.value,'Valid OTP issues private server-only session')
    // Shared guardian number: an existing backup secret selects only one child.
    const guardian=await POST(request('POST','0733333333',{recoveryCode:secretB}))
    assert.equal(guardian.status,200)
    assert.equal(challenges.at(-1),'guardian-b')
    assert.equal(deliveries.at(-1)?.to,guardianPhone)
    const guardianOpened=await PATCH(request('PATCH','0733333333',{recoveryCode:secretB,challengeId,code:deliveries.at(-1)!.code}))
    assert.equal(guardianOpened.status,200)
    assert.equal(sessions.at(-1),'guardian-b')
    // Backup format from the original 32-character code is also valid.
    rows=[record('old',adultPhone,null,'A'.repeat(32))]
    const legacy=await POST(request('POST','0712000111',{recoveryCode:'A'.repeat(32)}))
    assert.equal(legacy.status,200)
    assert.equal(challenges.at(-1),'old')
    assert.equal((await POST(request('POST','0712000111',{recoveryCode:secretB}))).status,200)
    assert.equal(challenges.at(-1),'old','Unknown backup does not send another SMS')
  } finally {
    globalThis.fetch=originalFetch
    for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k]
    Object.assign(process.env,saved)
  }
})
