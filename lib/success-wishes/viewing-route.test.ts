import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET as staffGet, POST as staffPost } from '../../app/api/success-wishes/viewing-windows/route'
import { GET as candidateGet } from '../../app/api/success-wishes/my-viewing-times/route'

const url = 'https://vibeschool.example/api/success-wishes/viewing-windows'
const valid = {
  schoolId: '11111111-1111-4111-8111-111111111111',
  weekday: 2, startsAt: '15:00', endsAt: '16:00', venue: 'School library',
}

function post(body: unknown, origin = 'https://vibeschool.example') {
  return new NextRequest(url, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('school-device scheduler rejects forged cross-origin writes before account lookup', async () => {
  const response = await staffPost(post(valid, 'https://attacker.example'))
  assert.equal(response.status, 403)
  assert.match(response.headers.get('cache-control') || '', /no-store/)
})

test('school-device scheduler rejects invalid days and time windows before database access', async () => {
  const invalid = [
    { ...valid, weekday: -1 },
    { ...valid, weekday: 7 },
    { ...valid, weekday: 'Monday' },
    { ...valid, startsAt: '25:30' },
    { ...valid, endsAt: '15:00' },
    { ...valid, endsAt: '14:00' },
    { ...valid, venue: '<' },
    { ...valid, guidance: 'x'.repeat(321) },
    { ...valid, isActive: 'true' },
  ]
  for (const body of invalid) {
    const response = await staffPost(post(body))
    assert.equal(response.status, 400, 'invalid payload must be rejected')
  }
})

test('closed staff setup exposes no viewing schedule without login', async () => {
  const previous = process.env.SUCCESS_WISHES_STAFF_SETUP_ENABLED
  const oldService = process.env.SUCCESS_WISHES_ENABLED
  try {
    process.env.SUCCESS_WISHES_STAFF_SETUP_ENABLED = 'false'
    process.env.SUCCESS_WISHES_ENABLED = 'false'
    const response = await staffGet(new NextRequest(url + '?schoolId=' + valid.schoolId))
    assert.equal(response.status, 503)
    assert.equal(Object.hasOwn(await response.json(), 'windows'), false)
  } finally {
    if (previous === undefined) delete process.env.SUCCESS_WISHES_STAFF_SETUP_ENABLED
    else process.env.SUCCESS_WISHES_STAFF_SETUP_ENABLED = previous
    if (oldService === undefined) delete process.env.SUCCESS_WISHES_ENABLED
    else process.env.SUCCESS_WISHES_ENABLED = oldService
  }
})

test('candidate viewing times require valid private inbox cookie', async () => {
  const response = await candidateGet(new NextRequest('https://vibeschool.example/api/success-wishes/my-viewing-times'))
  assert.equal(response.status, 401)
  const body = await response.json()
  assert.equal(Object.hasOwn(body, 'windows'), false)
  assert.match(response.headers.get('cache-control') || '', /no-store/)
})
