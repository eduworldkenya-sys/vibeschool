import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET, POST } from '../../app/api/success-wishes/receiver/guardian-consent/route'
import { otpDigest } from './receiver-sms'

// Independent assurance: actual handlers and Supabase SSR/Auth/PostgREST client.
// Only remote transports are replaced; this is not carrier or SQL certification.
test('guardian rights work with public receiver OFF; SMS kill switch and wrong guardian remain denied', async () => {
  const previousEnv = { ...process.env }
  const previousFetch = globalThis.fetch
  const origin = 'https://receiver.example'
  const guardian = '11111111-1111-4111-8111-111111111111'
  const school = '22222222-2222-4222-8222-222222222222'
  const student = '33333333-3333-4333-8333-333333333333'
  const receiver = '44444444-4444-4444-8444-444444444444'
  const link = '55555555-5555-4555-8555-555555555555'
  const challenge = '66666666-6666-4666-8666-666666666666'
  const stranger = '77777777-7777-4777-8777-777777777777'
  const phone = '+254712000111'
  type Row = Record<string, unknown>
  const rows: Record<string, Row[]> = {
    profiles: [guardian, stranger].map(id => ({ id, account_status: 'active', is_anonymized: false })),
    parent_student_links: [{ id: link, parent_id: guardian, student_id: student, school_id: school,
      relationship: 'guardian', is_primary: true, receives_alerts: true }],
    success_wish_receiver_provisioning_audit: [{ receiver_id: receiver, student_id: student,
      school_id: school, guardian_link_id: link }],
    success_wish_receivers: [{ id: receiver, student_id: student, display_name: 'Synthetic learner',
      guardian_phone_e164: phone, consent_route: 'guardian', consent_status: 'verified' }],
  }
  let authId = guardian
  let smsCount = 0
  let consentCount = 0
  let issuedCode = ''
  let storedDigest = ''
  const exp = Math.floor(Date.now() / 1000) + 3600
  function authCookie(id: string) {
    const jwt = ['e30', Buffer.from(JSON.stringify({ sub: id, exp, role: 'authenticated' })).toString('base64url'), 'synthetic'].join('.')
    const session = { access_token: jwt, refresh_token: 'synthetic', expires_at: exp,
      expires_in: 3600, token_type: 'bearer', user: { id } }
    return 'sb-synthetic-auth-token=base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
  }
  function request(method: 'GET' | 'POST', body?: Record<string, unknown>, authenticated = true) {
    return new NextRequest(origin + '/api/success-wishes/receiver/guardian-consent', {
      method, headers: { origin, 'content-type': 'application/json', ...(authenticated ? { cookie: authCookie(authId) } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  }
  try {
    Object.assign(process.env, {
      SUCCESS_WISHES_ENABLED: 'false', SUCCESS_WISHES_RECEIVER_ENABLED: 'false', SUCCESS_WISHES_STAFF_SETUP_ENABLED: 'false',
      NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic', SUCCESS_WISHES_RECEIVER_SMS_ENABLED: 'true',
      SUCCESS_WISHES_AT_MODE: 'sandbox', SUCCESS_WISHES_AT_USERNAME: 'sandbox', SUCCESS_WISHES_AT_API_KEY: 'synthetic',
      SUCCESS_WISHES_VERIFICATION_SECRET: 'independent-synthetic-test-secret-'.repeat(3), VERCEL_ENV: 'preview',
    })
    globalThis.fetch = (async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.hostname === 'api.sandbox.africastalking.com') {
        smsCount++
        const form = new URLSearchParams(String(init?.body))
        assert.equal(form.get('to'), phone, 'OTP destination must come from the linked guardian record')
        assert.match(form.get('message') || '', /WITHDRAW consent/)
        issuedCode = (form.get('message') || '').match(/Code (\d{6})/)?.[1] || ''
        assert.match(issuedCode, /^\d{6}$/)
        return Response.json({ SMSMessageData: { Recipients: [{ number: phone, statusCode: 102,
          status: 'Success', messageId: 'synthetic-provider-id' }] } })
      }
      assert.equal(url.hostname, 'synthetic.supabase.co', 'Never contact real services from this test')
      if (url.pathname === '/auth/v1/user') return Response.json({ id: authId, phone,
        phone_confirmed_at: '2026-01-01T00:00:00Z' })
      const table = url.pathname.split('/').at(-1)!
      if (table === 'success_wishes_take_attempt') return Response.json(true)
      if (table === 'success_wish_record_receiver_consent') {
        const body = JSON.parse(String(init?.body))
        assert.equal(body.p_action, 'withdraw'); assert.equal(body.p_role, 'guardian')
        assert.equal(body.p_receiver, receiver); assert.equal(body.p_challenge, challenge)
        assert.equal(body.p_notice, 'receiver-2026-10-26-v1')
        const accepted = body.p_digest === storedDigest
        if (accepted) consentCount++
        return Response.json(accepted)
      }
      if (table === 'success_wish_receiver_challenges') {
        if (init?.method === 'DELETE') return new Response(null, { status: 204 })
        const body = JSON.parse(String(init?.body))
        assert.equal(body.purpose, 'withdraw_guardian')
        storedDigest = body.code_hash
        return Response.json({ id: challenge })
      }
      if (table === 'success_wish_sms_deliveries') return init?.method === 'POST'
        ? Response.json({ id: challenge }) : new Response(null, { status: 204 })
      let data = rows[table] || []
      for (const [key, value] of url.searchParams) {
        if (value.startsWith('eq.')) data = data.filter(row => String(row[key]) === value.slice(3))
      }
      return Response.json(data)
    }) as typeof fetch

    const unauthenticated = await GET(request('GET', undefined, false))
    assert.equal(unauthenticated.status, 401)
    assert.equal(Object.hasOwn(await unauthenticated.json(), 'recipients'), false)
    const listed = await GET(request('GET'))
    assert.equal(listed.status, 200)
    assert.deepEqual((await listed.json()).recipients, [{ id: receiver, name: 'Synthetic learner' }])

    authId = stranger
    const deniedList = await GET(request('GET'))
    assert.deepEqual((await deniedList.json()).recipients, [])
    const deniedChange = await POST(request('POST', { action: 'begin', receiverId: receiver }))
    assert.equal(deniedChange.status, 404)
    assert.equal(smsCount, 0); assert.equal(consentCount, 0)

    authId = guardian
    process.env.SUCCESS_WISHES_RECEIVER_SMS_ENABLED = 'false'
    const stopped = await POST(request('POST', { action: 'begin', receiverId: receiver }))
    assert.equal(stopped.status, 503)
    assert.equal(smsCount, 0, 'Rights path must preserve SMS-specific kill switch')
    process.env.SUCCESS_WISHES_RECEIVER_SMS_ENABLED = 'true'
    const begin = await POST(request('POST', { action: 'begin', receiverId: receiver }))
    assert.equal(begin.status, 200)
    assert.equal((await begin.json()).challengeId, challenge)
    assert.equal(smsCount, 1)
    assert.equal(storedDigest, otpDigest(receiver, issuedCode))

    const wrong = issuedCode === '000000' ? '111111' : '000000'
    const rejectedCode = await POST(request('POST', { action: 'confirm', receiverId: receiver, challengeId: challenge, code: wrong }))
    assert.equal(rejectedCode.status, 401); assert.equal(consentCount, 0)
    const confirmed = await POST(request('POST', { action: 'confirm', receiverId: receiver, challengeId: challenge, code: issuedCode }))
    assert.equal(confirmed.status, 200)
    assert.equal((await confirmed.json()).revoked, true)
    assert.equal(consentCount, 1); assert.equal(smsCount, 1)
  } finally {
    globalThis.fetch = previousFetch
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key]
    Object.assign(process.env, previousEnv)
  }
})
