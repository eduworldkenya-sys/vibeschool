import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveSelfServiceBindings } from '../lib/twin/self-service-bindings.ts'

const id = '00000000-0000-4000-8000-000000000001'
const active = role => ({ role, account_status: 'active', is_anonymized: false })
const roles = result => result.map(binding => binding.role)

test('parent without a linked school or child gets only a self-owned parent workspace', () => {
  const result = deriveSelfServiceBindings(id, active('parent'), new Set())
  assert.deepEqual(roles(result), ['parent'])
  assert.equal(result[0].scopeId, id)
  assert.equal(result[0].schoolId, null)
  assert.deepEqual(result[0].resourceIds, [])
})

test('independent teacher gets teacher workspace with zero school authority', () => {
  const result = deriveSelfServiceBindings(id, active('teacher'), new Set())
  assert.deepEqual(roles(result), ['teacher'])
  assert.equal(result[0].schoolId, null)
  assert.deepEqual(result[0].resourceIds, [])
})

test('teacher parent profile switch does not give access to canonical students or schools', () => {
  const result = deriveSelfServiceBindings(id, active('teacher'), new Set(), 2)
  assert.deepEqual(roles(result), ['teacher', 'parent'])
  assert.ok(result.every(binding => binding.schoolId === null && binding.scopeId === id))
  assert.ok(result.every(binding => binding.resourceIds.length === 0))
})

test('existing role bindings are never duplicated', () => {
  assert.deepEqual(deriveSelfServiceBindings(id, active('parent'), new Set(['parent'])), [])
  assert.deepEqual(roles(deriveSelfServiceBindings(id, active('teacher'), new Set(['teacher']), 1)), ['parent'])
})

test('revoked, unverified, anonymized, missing or manipulated access cannot confer a role', () => {
  for (const value of [
    null, {}, [], { role: 'teacher', account_status: 'inactive', is_anonymized: false },
    { role: 'parent', account_status: 'active', is_anonymized: true },
    { role: 'teacher', account_status: 'active' },
    { role: 'student', account_status: 'active', is_anonymized: false },
    { role: 'admin', account_status: 'active', is_anonymized: false },
  ]) {
    assert.deepEqual(deriveSelfServiceBindings(id, value, new Set(), 2), [])
  }
})

test('invalid and absent guardian records cannot elevate teacher to parent', () => {
  for (const n of [0, -1, 1.5, NaN, Infinity]) {
    assert.deepEqual(roles(deriveSelfServiceBindings(id, active('teacher'), new Set(), n)), ['teacher'])
  }
})
