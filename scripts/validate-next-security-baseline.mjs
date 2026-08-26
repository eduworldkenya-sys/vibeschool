#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const PATCH_FLOORS = new Map([
  [15, [15, 5, 24]],
  [16, [16, 3, 3]],
])

function parseExactVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`Next.js must use an exact stable version, received: ${version}`)
  return match.slice(1).map(Number)
}

function compare(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

export function isPatchedNextVersion(version) {
  const parsed = parseExactVersion(version)
  const major = parsed[0]
  if (major > 16) return true
  const floor = PATCH_FLOORS.get(major)
  return Boolean(floor && compare(parsed, floor) >= 0)
}

async function validateRepository() {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const packageLock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'))
  const declared = packageJson.dependencies?.next
  const eslintDeclared = packageJson.devDependencies?.['eslint-config-next']
  const locked = packageLock.packages?.['node_modules/next']
  const eslintLocked = packageLock.packages?.['node_modules/eslint-config-next']

  assert.equal(typeof declared, 'string', 'Next.js must be declared in dependencies')
  assert.ok(isPatchedNextVersion(declared), `${declared} is vulnerable to GHSA-2xp9-vwfh-vxw4 and GHSA-p293-qw3h-jr36`)
  assert.equal(locked?.version, declared, 'package-lock.json must resolve the exact declared Next.js version')
  assert.match(locked?.resolved ?? '', /^https:\/\/registry\.npmjs\.org\/next\/-\/next-/)
  assert.match(locked?.integrity ?? '', /^sha512-/)
  assert.equal(eslintDeclared, declared, 'eslint-config-next must match the Next.js version')
  assert.equal(eslintLocked?.version, declared, 'package-lock.json must resolve the matching eslint-config-next version')

  console.log(`Next.js security baseline passed: ${declared}`)
}

function selfTest() {
  for (const vulnerable of ['14.2.35', '15.5.23', '16.3.2']) {
    assert.equal(isPatchedNextVersion(vulnerable), false, `expected ${vulnerable} to be rejected`)
  }
  for (const patched of ['15.5.24', '15.6.0', '16.3.3', '17.0.0']) {
    assert.equal(isPatchedNextVersion(patched), true, `expected ${patched} to be accepted`)
  }
  assert.throws(() => isPatchedNextVersion('^15.5.24'), /exact stable version/)
  console.log('Next.js security baseline self-test passed')
}

if (process.argv.includes('--self-test')) selfTest()
await validateRepository()
