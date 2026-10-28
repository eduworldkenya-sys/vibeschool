import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { PATCH } from '../../app/api/success-wishes/verify-sender/route'

// Regression guard: one noisy source must not exhaust the shared sender-verify
// bucket for every sender. The route is exercised for real; only PostgREST is
// stubbed, and the rate-limit RPC counts like the database function does.
const secret = 'synthetic-verification-secret-0123456789abcdef'

test('one noisy source is throttled per source while other sources still reach code checks', async () => {
  const saved = { ...process.env }
  const original = globalThis.fetch
  const counts = new Map<string, number>()
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    assert.equal(url.hostname, 'synthetic.supabase.co', 'No real network permitted')
    const method = init?.method || 'GET'
    if (url.pathname.includes('/rpc/success_wishes_take_attempt') && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { p_key_hash: string; p_limit: number }
      const n = (counts.get(body.p_key_hash) || 0) + 1
      counts.set(body.p_key_hash, n)
      return Response.json(n <= body.p_limit)
    }
    // No challenge exists for these synthetic identities, so a non-throttled
    // request ends in a 401 ("invalid or expired"), never a 429.
    return Response.json(null)
  }) as typeof fetch

  const request = (ip: string, email: string) => new NextRequest('https://sender.example/api/success-wishes/verify-sender', {
    method: 'PATCH',
    headers: { origin: 'https://sender.example', 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify({ email, code: '000000' }),
  })

  try {
    Object.assign(process.env, {
      SUCCESS_WISHES_ENABLED: 'true',
      SUCCESS_WISHES_SENDER_VERIFICATION_ENABLED: 'true',
      SUCCESS_WISHES_VERIFICATION_SECRET: secret,
      SUCCESS_WISHES_RESEND_API_KEY: 'synthetic-resend-key',
      SUCCESS_WISHES_EMAIL_FROM: 'VibeSchool <noreply@example.test>',
      NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-only',
    })

    // Noisy source: distinct emails so the per-identity bucket never trips.
    // The per-source bucket allows 60 per hour; the 61st must be throttled.
    for (let i = 0; i < 60; i++) {
      const res = await PATCH(request('198.51.100.7', `noisy${i}@example.test`))
      assert.equal(res.status, 401, `request ${i + 1} from the noisy source should reach the code check`)
    }
    const throttled = await PATCH(request('198.51.100.7', 'noisy60@example.test'))
    assert.equal(throttled.status, 429, 'the 61st request from one source must be throttled per source')

    // A different source must still reach the code check, so the shared
    // global bucket was not drained by the noisy source.
    const other = await PATCH(request('203.0.113.9', 'legit@example.test'))
    assert.equal(other.status, 401, 'a different source must not be blocked by the noisy source')
  } finally {
    globalThis.fetch = original
    process.env = saved
  }
})
