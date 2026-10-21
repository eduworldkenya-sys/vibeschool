import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { DELETE } from '../../app/api/success-wishes/session/route'
import { SESSION_COOKIE } from './security'

const url = 'https://vibeschool.example/api/success-wishes/session'
const sessionCookie = `${SESSION_COOKIE}=${'a'.repeat(64)}`

test('sign-out clears guest cookie even when disabled database cannot revoke the session', async () => {
  const before = process.env.SUCCESS_WISHES_ENABLED
  process.env.SUCCESS_WISHES_ENABLED = 'false'
  try {
    const req = new NextRequest(url, {
      method: 'DELETE',
      headers: { origin: 'https://vibeschool.example', cookie: sessionCookie },
    })
    const response = await DELETE(req)
    assert.equal(response.status, 503)
    assert.equal(response.cookies.get(SESSION_COOKIE)?.value, '')
    assert.equal(response.cookies.get(SESSION_COOKIE)?.maxAge, 0)
    assert.equal(response.cookies.get(SESSION_COOKIE)?.httpOnly, true)
  } finally {
    if (before === undefined) delete process.env.SUCCESS_WISHES_ENABLED
    else process.env.SUCCESS_WISHES_ENABLED = before
  }
})

test('cross-origin sign-out requests cannot clear a valid browser session', async () => {
  const req = new NextRequest(url, {
    method: 'DELETE',
    headers: { origin: 'https://unknown.example', cookie: sessionCookie },
  })
  const response = await DELETE(req)
  assert.equal(response.status, 403)
  assert.equal(response.cookies.get(SESSION_COOKIE), undefined)
})
