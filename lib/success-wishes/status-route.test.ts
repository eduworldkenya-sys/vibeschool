import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { POST } from '../../app/api/success-wishes/status/route'

const url = 'https://vibeschool.example/api/success-wishes/status'
const input = {
  reference: '11111111-1111-4111-8111-111111111111',
  managementToken: 'a'.repeat(64),
}

function req(origin: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('sender status rejects cross-site capability requests before any database access', async () => {
  const response = await POST(req('https://attacker.example', input))
  assert.equal(response.status, 403)
  assert.match(response.headers.get('cache-control') || '', /no-store/)
  assert.equal(JSON.stringify(await response.json()).includes(input.managementToken), false)
})

test('sender status validates capability shape and refuses invalid tokens', async () => {
  const response = await POST(req('https://vibeschool.example', {
    ...input, managementToken: 'not-a-private-code',
  }))
  assert.equal(response.status, 400)
  assert.equal(JSON.stringify(await response.json()).includes(input.reference), false)
})

test('sender status cannot reveal data while Success Wishes is disabled', async () => {
  const old = process.env.SUCCESS_WISHES_ENABLED
  process.env.SUCCESS_WISHES_ENABLED = 'false'
  try {
    const response = await POST(req('https://vibeschool.example', input))
    assert.equal(response.status, 503)
    assert.match(response.headers.get('cache-control') || '', /no-store/)
    const body = await response.json()
    assert.equal(Object.hasOwn(body, 'reference'), false)
    assert.equal(Object.hasOwn(body, 'paymentStatus'), false)
  } finally {
    if (old === undefined) delete process.env.SUCCESS_WISHES_ENABLED
    else process.env.SUCCESS_WISHES_ENABLED = old
  }
})
